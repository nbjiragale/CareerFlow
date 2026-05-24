vi.mock("@/lib/gmail/client", () => ({
  getAuthorizedGmail: vi.fn(),
  GmailNotConnectedError: class extends Error {
    constructor() {
      super("Gmail is not connected for this user.");
      this.name = "GmailNotConnectedError";
    }
  },
  GOOGLE_PROVIDER: "google",
}));

vi.mock("@/lib/gmail/settings", () => ({
  getGmailSettings: vi.fn(),
  markGmailSynced: vi.fn(),
}));

vi.mock("@/lib/gmail/classifier", () => ({
  classifyEmails: vi.fn(),
  getActiveClassifierKind: vi.fn().mockReturnValue("keyword"),
}));

vi.mock("@/lib/gmail/job-link", () => ({
  findOrCreateJobForClassification: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const mockPrisma = {
    emailThread: { upsert: vi.fn() },
  };
  return { default: mockPrisma };
});

import { runGmailSyncForUser } from "@/lib/gmail/sync";
import { getAuthorizedGmail } from "@/lib/gmail/client";
import { getGmailSettings, markGmailSynced } from "@/lib/gmail/settings";
import { classifyEmails } from "@/lib/gmail/classifier";
import { findOrCreateJobForClassification } from "@/lib/gmail/job-link";
import prisma from "@/lib/db";

const getAuth = getAuthorizedGmail as unknown as ReturnType<typeof vi.fn>;
const getSettings = getGmailSettings as unknown as ReturnType<typeof vi.fn>;
const markSynced = markGmailSynced as unknown as ReturnType<typeof vi.fn>;
const classify = classifyEmails as unknown as ReturnType<typeof vi.fn>;
const linkJob = findOrCreateJobForClassification as unknown as ReturnType<typeof vi.fn>;
const upsertThread = prisma.emailThread.upsert as unknown as ReturnType<typeof vi.fn>;

interface FakeGmailMessage {
  id: string;
  threadId: string;
  internalDate: string;
  snippet: string;
  payload: {
    headers: { name: string; value: string }[];
    mimeType: string;
    body: { data: string };
  };
}

function b64url(text: string): string {
  return Buffer.from(text, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fakeMessage(opts: {
  id: string;
  threadId?: string;
  from: string;
  subject: string;
  body: string;
  internalDate?: string;
  snippet?: string;
}): FakeGmailMessage {
  return {
    id: opts.id,
    threadId: opts.threadId ?? opts.id,
    internalDate: opts.internalDate ?? "1700000000000",
    snippet: opts.snippet ?? opts.body.slice(0, 50),
    payload: {
      headers: [
        { name: "From", value: opts.from },
        { name: "Subject", value: opts.subject },
      ],
      mimeType: "text/plain",
      body: { data: b64url(opts.body) },
    },
  };
}

function buildGmailMock(messages: FakeGmailMessage[]) {
  return {
    users: {
      messages: {
        list: vi.fn().mockResolvedValue({
          data: { messages: messages.map((m) => ({ id: m.id })) },
        }),
        get: vi.fn().mockImplementation(({ id }: { id: string }) => {
          const found = messages.find((m) => m.id === id);
          return Promise.resolve({ data: found });
        }),
      },
    },
  };
}

describe("runGmailSyncForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSettings.mockResolvedValue({
      classificationThreshold: 0.7,
      excludedEmails: [],
      lastSyncedAt: null,
      initialLookbackDays: 14,
    });
    markSynced.mockResolvedValue(undefined);
    upsertThread.mockResolvedValue({});
    linkJob.mockResolvedValue({ jobId: null, created: false });
  });

  it("returns a zero summary when Gmail returns no messages", async () => {
    getAuth.mockResolvedValue({ gmail: buildGmailMock([]), email: "u@x.com" });
    classify.mockResolvedValue({ kind: "keyword", results: [] });

    const summary = await runGmailSyncForUser("u1");
    expect(summary.fetched).toBe(0);
    expect(summary.classified).toBe(0);
    expect(upsertThread).not.toHaveBeenCalled();
    expect(markSynced).toHaveBeenCalledWith("u1");
  });

  it("filters out excluded senders before classification", async () => {
    getSettings.mockResolvedValue({
      classificationThreshold: 0.7,
      excludedEmails: ["@indeed.com"],
      lastSyncedAt: null,
      initialLookbackDays: 14,
    });

    const messages = [
      fakeMessage({
        id: "m1",
        from: "Indeed <noreply@indeed.com>",
        subject: "New jobs you might like",
        body: "Daily digest",
      }),
      fakeMessage({
        id: "m2",
        from: "Acme HR <hr@acme.test>",
        subject: "Application received",
        body: "Thanks for applying to Acme.",
      }),
    ];
    getAuth.mockResolvedValue({ gmail: buildGmailMock(messages), email: "u@x.com" });
    classify.mockResolvedValue({
      kind: "keyword",
      results: [{ label: "Applied", confidence: 0.6 }],
    });

    const summary = await runGmailSyncForUser("u1");
    expect(summary.fetched).toBe(1);
    expect(classify).toHaveBeenCalledTimes(1);
    const [texts] = classify.mock.calls[0];
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain("Application received");
  });

  it("routes low-confidence results into the Needs Review queue (no auto-link)", async () => {
    getAuth.mockResolvedValue({
      gmail: buildGmailMock([
        fakeMessage({
          id: "m1",
          from: "Acme <hr@acme.test>",
          subject: "Application received",
          body: "Thanks for applying to Acme.",
        }),
      ]),
      email: "u@x.com",
    });
    classify.mockResolvedValue({
      kind: "keyword",
      results: [{ label: "Applied", confidence: 0.6, company: "Acme" }],
    });

    const summary = await runGmailSyncForUser("u1");

    expect(summary.fetched).toBe(1);
    expect(summary.needsReview).toBe(1);
    expect(summary.jobsCreated).toBe(0);
    expect(summary.jobsLinked).toBe(0);
    expect(linkJob).not.toHaveBeenCalled();

    const call = upsertThread.mock.calls[0][0];
    expect(call.create.needsReview).toBe(true);
    expect(call.create.label).toBe("Applied");
  });

  it("auto-creates a Job for high-confidence results", async () => {
    getAuth.mockResolvedValue({
      gmail: buildGmailMock([
        fakeMessage({
          id: "m1",
          from: "Acme <hr@acme.test>",
          subject: "Offer letter",
          body: "Excited to extend an offer to you.",
        }),
      ]),
      email: "u@x.com",
    });
    classify.mockResolvedValue({
      kind: "huggingface",
      results: [{ label: "Offer", confidence: 0.92, company: "Acme", role: "SWE" }],
    });
    linkJob.mockResolvedValue({ jobId: "job-1", created: true });

    const summary = await runGmailSyncForUser("u1");

    expect(summary.fetched).toBe(1);
    expect(summary.needsReview).toBe(0);
    expect(summary.jobsCreated).toBe(1);
    expect(summary.jobsLinked).toBe(0);

    const call = upsertThread.mock.calls[0][0];
    expect(call.create.needsReview).toBe(false);
    expect(call.create.jobId).toBe("job-1");
    expect(call.create.label).toBe("Offer");
  });

  it("links to an existing Job when confidence is high but no new Job was created", async () => {
    getAuth.mockResolvedValue({
      gmail: buildGmailMock([
        fakeMessage({
          id: "m1",
          from: "Acme <hr@acme.test>",
          subject: "Interview",
          body: "We'd like to schedule a phone interview.",
        }),
      ]),
      email: "u@x.com",
    });
    classify.mockResolvedValue({
      kind: "huggingface",
      results: [{ label: "Interview", confidence: 0.9, company: "Acme" }],
    });
    linkJob.mockResolvedValue({ jobId: "job-existing", created: false });

    const summary = await runGmailSyncForUser("u1");
    expect(summary.jobsLinked).toBe(1);
    expect(summary.jobsCreated).toBe(0);
  });

  it("does not auto-link NotJobRelated threads even at full confidence", async () => {
    getAuth.mockResolvedValue({
      gmail: buildGmailMock([
        fakeMessage({
          id: "m1",
          from: "Newsletter <news@x.com>",
          subject: "Weekly update",
          body: "Here's what's new this week.",
        }),
      ]),
      email: "u@x.com",
    });
    classify.mockResolvedValue({
      kind: "keyword",
      results: [{ label: "NotJobRelated", confidence: 0.0 }],
    });

    const summary = await runGmailSyncForUser("u1");
    expect(summary.jobThreads).toBe(0);
    expect(summary.needsReview).toBe(0);
    expect(linkJob).not.toHaveBeenCalled();

    const call = upsertThread.mock.calls[0][0];
    expect(call.create.label).toBe("NotJobRelated");
    expect(call.create.needsReview).toBe(false);
    expect(call.create.jobId).toBeNull();
  });
});
