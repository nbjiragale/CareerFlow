// CAREERFLOW: unit tests for src/lib/ai/outreach.ts.
//
// generateOutreachDraft should:
//   - Throw when the job is missing
//   - Generate a draft, persist an AiDraft (draftType "outreach-<intent>", jobId), audit
//   - Write an error AiAuditLog row and re-throw on LLM failure

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  default: {
    job: { findUnique: vi.fn() },
    aiDraft: { create: vi.fn() },
  },
}));
vi.mock("@/lib/ai/resolve-settings", () => ({
  resolveUserAiSettings: vi.fn(),
}));
vi.mock("@/lib/ai/providers", () => ({ getModel: vi.fn() }));
vi.mock("@/lib/ai/structured", () => ({ generateStructuredObject: vi.fn() }));
vi.mock("@/lib/ai/audit", () => ({ recordAiUsage: vi.fn() }));
vi.mock("@/lib/ai", () => ({
  convertResumeToText: vi.fn(),
  removeHtmlTags: (s: string) => s,
}));
vi.mock("@/actions/profile.actions", () => ({ getResumeById: vi.fn() }));

import db from "@/lib/db";
import { resolveUserAiSettings } from "@/lib/ai/resolve-settings";
import { getModel } from "@/lib/ai/providers";
import { generateStructuredObject } from "@/lib/ai/structured";
import { recordAiUsage } from "@/lib/ai/audit";
import { generateOutreachDraft } from "@/lib/ai/outreach";

const mc = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;
const findJob = mc(db.job.findUnique);
const createDraft = mc(db.aiDraft.create);
const resolve = mc(resolveUserAiSettings);
const getModelMock = mc(getModel);
const genMock = mc(generateStructuredObject);
const audit = mc(recordAiUsage);

function jobRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    userId: "u1",
    description: "<p>Senior Backend Engineer with Go and Postgres.</p>",
    resumeId: null,
    JobTitle: { label: "Senior Backend Engineer" },
    Company: { label: "Acme" },
    ...overrides,
  };
}

const draftObject = {
  subject: "Interested in the Senior Backend Engineer role",
  body: "Hi Priya, I came across the Senior Backend Engineer role at Acme and would love to connect.",
  tone: "warm",
};

describe("generateOutreachDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolve.mockResolvedValue({ provider: "openai", model: "gpt-4o-mini" });
    getModelMock.mockResolvedValue({ id: "fake-model" });
    audit.mockResolvedValue({ costUsd: 0.004 });
    genMock.mockResolvedValue({
      object: draftObject,
      usage: { inputTokens: 280, outputTokens: 120 },
    });
    createDraft.mockResolvedValue({ id: "draft-1" });
  });

  it("throws when the job is not found", async () => {
    findJob.mockResolvedValue(null);
    await expect(
      generateOutreachDraft({ userId: "u1", jobId: "missing", intent: "connection" }),
    ).rejects.toThrow(/not found/i);
    expect(genMock).not.toHaveBeenCalled();
  });

  it("generates, persists an AiDraft, and audits", async () => {
    findJob.mockResolvedValue(jobRow());

    const result = await generateOutreachDraft({
      userId: "u1",
      jobId: "job-1",
      intent: "connection",
      recipientName: "Priya",
    });

    expect(result.draftId).toBe("draft-1");
    expect(result.draft.body).toContain("Acme");

    const draftData = createDraft.mock.calls[0][0].data;
    expect(draftData.draftType).toBe("outreach-connection");
    expect(draftData.jobId).toBe("job-1");
    expect(draftData.userId).toBe("u1");
    expect(draftData.content).toBe(draftObject.body);

    const auditData = audit.mock.calls[0][0];
    expect(auditData.feature).toBe("outreach-draft");
    expect(auditData.status).toBe("success");
    expect(auditData.jobId).toBe("job-1");
  });

  it("encodes the intent into draftType for each message type", async () => {
    findJob.mockResolvedValue(jobRow());

    await generateOutreachDraft({ userId: "u1", jobId: "job-1", intent: "inmail" });
    expect(createDraft.mock.calls[0][0].data.draftType).toBe("outreach-inmail");
  });

  it("writes an error audit row and re-throws on LLM failure", async () => {
    findJob.mockResolvedValue(jobRow());
    genMock.mockRejectedValue(new Error("LLM blew up"));

    await expect(
      generateOutreachDraft({ userId: "u1", jobId: "job-1", intent: "referral" }),
    ).rejects.toThrow("LLM blew up");

    expect(createDraft).not.toHaveBeenCalled();
    expect(audit.mock.calls[0][0].status).toBe("error");
  });
});
