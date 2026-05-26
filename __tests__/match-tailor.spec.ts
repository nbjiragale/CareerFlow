// CAREERFLOW: unit tests for the Match & Tailor orchestrator
// (src/lib/ai/match-tailor.ts).
//
// runMatchAndTailor should:
//   - Resolve AI settings up front and fail (no Job created) when missing
//   - Auto-create a tracked Job from the JD (company/title/source/status)
//   - Sequence evaluate → match → tailor, all bound to the new jobId
//   - Aggregate per-step cost
//   - Capture per-step failures (match/tailor) instead of aborting
//   - Re-throw StructuredOutputUnsupportedError from the evaluate step

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  default: {
    company: { findFirst: vi.fn(), create: vi.fn() },
    jobTitle: { findFirst: vi.fn(), create: vi.fn() },
    jobSource: { findFirst: vi.fn(), create: vi.fn() },
    jobStatus: { findFirst: vi.fn(), create: vi.fn() },
    job: { create: vi.fn() },
  },
}));

vi.mock("@/lib/ai/resolve-settings", () => ({
  resolveUserAiSettings: vi.fn(),
}));
vi.mock("@/lib/ai/evaluate", () => ({ runJdEvaluation: vi.fn() }));
vi.mock("@/lib/ai/match", () => ({ runJobMatch: vi.fn() }));
vi.mock("@/lib/ai/tailor", () => ({ runResumeTailor: vi.fn() }));

import db from "@/lib/db";
import { resolveUserAiSettings } from "@/lib/ai/resolve-settings";
import { runJdEvaluation } from "@/lib/ai/evaluate";
import { runJobMatch } from "@/lib/ai/match";
import { runResumeTailor } from "@/lib/ai/tailor";
import { StructuredOutputUnsupportedError } from "@/lib/ai/structured";
import { runMatchAndTailor } from "@/lib/ai/match-tailor";

const mc = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

const resolve = mc(resolveUserAiSettings);
const evaluate = mc(runJdEvaluation);
const match = mc(runJobMatch);
const tailor = mc(runResumeTailor);
const companyFind = mc(db.company.findFirst);
const companyCreate = mc(db.company.create);
const titleFind = mc(db.jobTitle.findFirst);
const titleCreate = mc(db.jobTitle.create);
const sourceFind = mc(db.jobSource.findFirst);
const sourceCreate = mc(db.jobSource.create);
const statusFind = mc(db.jobStatus.findFirst);
const jobCreate = mc(db.job.create);

const baseArgs = {
  userId: "u1",
  jdText: "A long enough job description body for the flow.",
  company: "Acme",
  role: "Senior Backend Engineer",
  baseResumeId: "resume-1",
  archetypeHint: "auto-detect" as const,
};

function evalResult() {
  return {
    evaluation: { grade: "B", globalScore: 4.1 },
    provider: "openai",
    model: "gpt-4o-mini",
    costUsd: 0.01,
    msElapsed: 100,
  };
}
function matchResult() {
  return {
    match: { matchScore: 72 },
    provider: "openai",
    model: "gpt-4o-mini",
    costUsd: 0.02,
    msElapsed: 100,
  };
}
function tailorResult() {
  return {
    newResumeId: "resume-2",
    newResumeTitle: "Base — tailored",
    tailored: {},
    provider: "openai",
    model: "gpt-4o-mini",
    costUsd: 0.03,
    msElapsed: 100,
  };
}

describe("runMatchAndTailor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolve.mockResolvedValue({ provider: "openai", model: "gpt-4o-mini" });
    // find-or-create entity resolvers: nothing exists → create everything.
    companyFind.mockResolvedValue(null);
    companyCreate.mockResolvedValue({ id: "company-1" });
    titleFind.mockResolvedValue(null);
    titleCreate.mockResolvedValue({ id: "title-1" });
    sourceFind.mockResolvedValue(null);
    sourceCreate.mockResolvedValue({ id: "source-1" });
    statusFind.mockResolvedValue({ id: "status-1" });
    jobCreate.mockResolvedValue({ id: "job-1" });
    evaluate.mockResolvedValue(evalResult());
    match.mockResolvedValue(matchResult());
    tailor.mockResolvedValue(tailorResult());
  });

  it("fails before creating a Job when AI settings are missing", async () => {
    resolve.mockRejectedValue(new Error("AI settings not configured."));
    await expect(runMatchAndTailor(baseArgs)).rejects.toThrow(
      /AI settings not configured/,
    );
    expect(jobCreate).not.toHaveBeenCalled();
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("creates a tracked Job from the JD and runs all three steps", async () => {
    const result = await runMatchAndTailor(baseArgs);

    expect(jobCreate).toHaveBeenCalledTimes(1);
    const jobData = jobCreate.mock.calls[0][0].data;
    expect(jobData.userId).toBe("u1");
    expect(jobData.description).toBe(baseArgs.jdText);
    expect(jobData.companyId).toBe("company-1");
    expect(jobData.jobTitleId).toBe("title-1");
    expect(jobData.statusId).toBe("status-1");

    // Every step is bound to the new jobId.
    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-1", jdText: baseArgs.jdText }),
    );
    expect(match).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-1", resumeId: "resume-1" }),
    );
    expect(tailor).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-1", sourceResumeId: "resume-1" }),
    );

    expect(result.jobId).toBe("job-1");
    expect(result.tailoredResumeId).toBe("resume-2");
    // Aggregated cost: 0.01 + 0.02 + 0.03
    expect(result.totalCostUsd).toBeCloseTo(0.06, 5);
  });

  it("captures a match failure but still tailors", async () => {
    match.mockRejectedValue(new Error("Resume has no content"));

    const result = await runMatchAndTailor(baseArgs);

    expect(result.match).toBeNull();
    expect(result.matchError).toMatch(/no content/);
    expect(result.evaluation).not.toBeNull();
    expect(result.tailoredResumeId).toBe("resume-2");
    // Cost excludes the failed match step.
    expect(result.totalCostUsd).toBeCloseTo(0.04, 5);
  });

  it("captures a tailor failure without losing evaluate/match results", async () => {
    tailor.mockRejectedValue(new Error("Source resume has no experiences"));

    const result = await runMatchAndTailor(baseArgs);

    expect(result.tailoredResumeId).toBeNull();
    expect(result.tailorError).toMatch(/no experiences/);
    expect(result.evaluation).not.toBeNull();
    expect(result.match).not.toBeNull();
  });

  it("re-throws StructuredOutputUnsupportedError from the evaluate step", async () => {
    evaluate.mockRejectedValue(
      new StructuredOutputUnsupportedError("model can't do structured output"),
    );
    await expect(runMatchAndTailor(baseArgs)).rejects.toBeInstanceOf(
      StructuredOutputUnsupportedError,
    );
  });
});
