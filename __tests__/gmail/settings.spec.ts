import {
  GMAIL_DEFAULTS,
  getGmailSettings,
  markGmailSynced,
  updateGmailSettings,
} from "@/lib/gmail/settings";

vi.mock("@/lib/db", () => {
  const mockPrisma = {
    userSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  };
  return { default: mockPrisma };
});

import prisma from "@/lib/db";

describe("getGmailSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns defaults when no UserSettings row exists", async () => {
    (prisma.userSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const out = await getGmailSettings("u1");
    expect(out).toEqual(GMAIL_DEFAULTS);
  });

  it("returns defaults when the settings blob is malformed JSON", async () => {
    (prisma.userSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      settings: "{not json",
    });
    const out = await getGmailSettings("u1");
    expect(out).toEqual(GMAIL_DEFAULTS);
  });

  it("merges a partial gmail blob over defaults and clamps the threshold", async () => {
    (prisma.userSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      settings: JSON.stringify({
        gmail: {
          classificationThreshold: 1.5,
          excludedEmails: ["noreply@indeed.com", 5, "  bot@x.com  "],
          lastSyncedAt: "2025-01-01T00:00:00.000Z",
        },
      }),
    });
    const out = await getGmailSettings("u1");
    expect(out.classificationThreshold).toBeLessThanOrEqual(0.95);
    expect(out.excludedEmails).toEqual(["noreply@indeed.com", "bot@x.com"]);
    expect(out.lastSyncedAt).toBe("2025-01-01T00:00:00.000Z");
    expect(out.initialLookbackDays).toBe(GMAIL_DEFAULTS.initialLookbackDays);
  });
});

describe("updateGmailSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts a merged blob preserving non-gmail keys", async () => {
    (prisma.userSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      settings: JSON.stringify({
        ai: { provider: "openai" },
        gmail: { classificationThreshold: 0.8 },
      }),
    });
    (prisma.userSettings.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await updateGmailSettings("u1", {
      excludedEmails: ["@indeed.com"],
    });

    expect(prisma.userSettings.upsert).toHaveBeenCalledTimes(1);
    const call = (prisma.userSettings.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const written = JSON.parse(call.create.settings);
    expect(written.ai).toEqual({ provider: "openai" });
    expect(written.gmail.classificationThreshold).toBe(0.8);
    expect(written.gmail.excludedEmails).toEqual(["@indeed.com"]);
  });
});

describe("markGmailSynced", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores lastSyncedAt as an ISO string", async () => {
    (prisma.userSettings.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.userSettings.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await markGmailSynced("u1");

    const call = (prisma.userSettings.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const blob = JSON.parse(call.create.settings);
    expect(typeof blob.gmail.lastSyncedAt).toBe("string");
    expect(new Date(blob.gmail.lastSyncedAt).toISOString()).toBe(
      blob.gmail.lastSyncedAt,
    );
  });
});
