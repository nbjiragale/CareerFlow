// CAREERFLOW: unit tests for src/lib/ai/interview-prep.ts.
//
// runInterviewPrep should:
//   - Throw when the job is missing or has no description
//   - Return the cached brief without calling the model (cost guard)
//   - Regenerate when force=true even if a cache exists
//   - Generate, persist (interviewPrepJson/At), and audit on a cache miss
//   - Write an error AiAuditLog row and re-throw on LLM failure

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  default: {
    job: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/ai/resolve-settings", () => ({
  resolveUserAiSettings: vi.fn(),
}));
vi.mock("@/lib/ai/providers", () => ({ getModel: vi.fn() }));
vi.mock("@/lib/ai/structured", () => ({ generateStructuredObject: vi.fn() }));
vi.mock("@/lib/ai/audit", () => ({ recordAiUsage: vi.fn() }));
vi.mock("@/lib/ai", () => ({ convertResumeToText: vi.fn() }));
vi.mock("@/actions/profile.actions", () => ({ getResumeById: vi.fn() }));

import db from "@/lib/db";
import { resolveUserAiSettings } from "@/lib/ai/resolve-settings";
import { getModel } from "@/lib/ai/providers";
import { generateStructuredObject } from "@/lib/ai/structured";
import { recordAiUsage } from "@/lib/ai/audit";
import { runInterviewPrep } from "@/lib/ai/interview-prep";

const mc = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;
const findJob = mc(db.job.findUnique);
const updateJob = mc(db.job.update);
const resolve = mc(resolveUserAiSettings);
const getModelMock = mc(getModel);
const genMock = mc(generateStructuredObject);
const audit = mc(recordAiUsage);

function prepObject() {
  return {
    companyOverview:
      "Based on general knowledge — verify on the company's site: Acme builds widgets.",
    roleFocus: "Expect distributed-systems depth and reliability questions.",
    likelyQuestions: [
      { category: "technical", question: "Q1", answerAngle: "A1" },
      { category: "behavioral", question: "Q2", answerAngle: "A2" },
      { category: "role-specific", question: "Q3", answerAngle: "A3" },
      { category: "culture-fit", question: "Q4", answerAngle: "A4" },
    ],
    talkingPoints: ["tp1", "tp2", "tp3"],
    questionsToAsk: ["qa1", "qa2", "qa3"],
    prepChecklist: ["c1", "c2", "c3"],
  };
}

function jobRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    userId: "u1",
    description: "A real JD body for the role.",
    resumeId: null,
    JobTitle: { label: "Senior Backend Engineer" },
    Company: { label: "Acme" },
    interviewPrepJson: null,
    interviewPreppedAt: null,
    ...overrides,
  };
}

describe("runInterviewPrep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolve.mockResolvedValue({ provider: "openai", model: "gpt-4o-mini" });
    getModelMock.mockResolvedValue({ id: "fake-model" });
    audit.mockResolvedValue({ costUsd: 0.01 });
    genMock.mockResolvedValue({
      object: prepObject(),
      usage: { inputTokens: 500, outputTokens: 300 },
    });
  });

  it("throws when the job is not found", async () => {
    findJob.mockResolvedValue(null);
    await expect(
      runInterviewPrep({ userId: "u1", jobId: "missing" }),
    ).rejects.toThrow(/not found/i);
  });

  it("throws when the job has no description", async () => {
    findJob.mockResolvedValue(jobRow({ description: "   " }));
    await expect(
      runInterviewPrep({ userId: "u1", jobId: "job-1" }),
    ).rejects.toThrow(/no description/i);
  });

  it("returns the cached brief without calling the model", async () => {
    findJob.mockResolvedValue(
      jobRow({
        interviewPrepJson: JSON.stringify(prepObject()),
        interviewPreppedAt: new Date("2026-05-26T00:00:00Z"),
      }),
    );

    const result = await runInterviewPrep({ userId: "u1", jobId: "job-1" });

    expect(result.cached).toBe(true);
    expect(result.costUsd).toBe(0);
    expect(resolve).not.toHaveBeenCalled();
    expect(genMock).not.toHaveBeenCalled();
    expect(updateJob).not.toHaveBeenCalled();
  });

  it("regenerates when force=true even with a cache present", async () => {
    findJob.mockResolvedValue(
      jobRow({ interviewPrepJson: JSON.stringify(prepObject()) }),
    );

    const result = await runInterviewPrep({
      userId: "u1",
      jobId: "job-1",
      force: true,
    });

    expect(result.cached).toBe(false);
    expect(genMock).toHaveBeenCalledTimes(1);
    expect(updateJob).toHaveBeenCalledTimes(1);
  });

  it("generates, persists, and audits on a cache miss", async () => {
    findJob.mockResolvedValue(jobRow());

    const result = await runInterviewPrep({ userId: "u1", jobId: "job-1" });

    expect(result.cached).toBe(false);
    expect(genMock).toHaveBeenCalledTimes(1);

    const persisted = updateJob.mock.calls[0][0];
    expect(persisted.where).toEqual({ id: "job-1", userId: "u1" });
    expect(persisted.data.interviewPrepJson).toContain("companyOverview");
    expect(persisted.data.interviewPreppedAt).toBeInstanceOf(Date);

    const auditData = audit.mock.calls[0][0];
    expect(auditData.feature).toBe("interview-prep");
    expect(auditData.status).toBe("success");
  });

  it("writes an error audit row and re-throws on LLM failure", async () => {
    findJob.mockResolvedValue(jobRow());
    genMock.mockRejectedValue(new Error("LLM blew up"));

    await expect(
      runInterviewPrep({ userId: "u1", jobId: "job-1" }),
    ).rejects.toThrow("LLM blew up");

    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0][0].status).toBe("error");
  });
});
