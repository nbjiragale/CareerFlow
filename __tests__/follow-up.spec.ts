// CAREERFLOW: unit tests for src/lib/ai/follow-up.ts.
//
// generateFollowUpDraft should:
//   - Throw when the job is missing
//   - Generate a draft, persist an AiDraft (draftType "follow-up", jobId), audit
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
import { generateFollowUpDraft } from "@/lib/ai/follow-up";

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
    appliedDate: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    JobTitle: { label: "Senior Backend Engineer" },
    Company: { label: "Acme" },
    ...overrides,
  };
}

const draftObject = {
  subject: "Following up on my application",
  body: "Hi, I wanted to follow up on my application for the role. I remain very interested.",
  tone: "professional",
};

describe("generateFollowUpDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolve.mockResolvedValue({ provider: "openai", model: "gpt-4o-mini" });
    getModelMock.mockResolvedValue({ id: "fake-model" });
    audit.mockResolvedValue({ costUsd: 0.005 });
    genMock.mockResolvedValue({
      object: draftObject,
      usage: { inputTokens: 300, outputTokens: 150 },
    });
    createDraft.mockResolvedValue({ id: "draft-1" });
  });

  it("throws when the job is not found", async () => {
    findJob.mockResolvedValue(null);
    await expect(
      generateFollowUpDraft({ userId: "u1", jobId: "missing" }),
    ).rejects.toThrow(/not found/i);
    expect(genMock).not.toHaveBeenCalled();
  });

  it("generates, persists an AiDraft, and audits", async () => {
    findJob.mockResolvedValue(jobRow());

    const result = await generateFollowUpDraft({ userId: "u1", jobId: "job-1" });

    expect(result.draftId).toBe("draft-1");
    expect(result.draft.body).toContain("follow up");

    const draftData = createDraft.mock.calls[0][0].data;
    expect(draftData.draftType).toBe("follow-up");
    expect(draftData.jobId).toBe("job-1");
    expect(draftData.userId).toBe("u1");
    expect(draftData.content).toBe(draftObject.body);

    const auditData = audit.mock.calls[0][0];
    expect(auditData.feature).toBe("follow-up-draft");
    expect(auditData.status).toBe("success");
  });

  it("writes an error audit row and re-throws on LLM failure", async () => {
    findJob.mockResolvedValue(jobRow());
    genMock.mockRejectedValue(new Error("LLM blew up"));

    await expect(
      generateFollowUpDraft({ userId: "u1", jobId: "job-1" }),
    ).rejects.toThrow("LLM blew up");

    expect(createDraft).not.toHaveBeenCalled();
    expect(audit.mock.calls[0][0].status).toBe("error");
  });
});
