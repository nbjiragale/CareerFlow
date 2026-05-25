// CAREERFLOW: Phase 2 — unit tests for src/lib/ai/evaluate.ts.
//
// runJdEvaluation should:
//   - Reject empty JD text
//   - Resolve provider/model from UserSettings
//   - Throw a clean error when settings are missing / partial
//   - Call generateObject with the JD evaluate system prompt + user prompt
//   - Normalize the grade from globalScore
//   - Persist the result onto Job when jobId is provided
//   - Write a success AiAuditLog row
//   - Write an error AiAuditLog row and re-throw on failures

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  default: {
    userSettings: { findUnique: vi.fn() },
    job: { update: vi.fn() },
    aiAuditLog: { create: vi.fn() },
  },
}));

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@/lib/ai/providers", () => ({
  getModel: vi.fn(),
}));

import db from "@/lib/db";
import { generateObject } from "ai";
import { getModel } from "@/lib/ai/providers";
import { runJdEvaluation } from "@/lib/ai/evaluate";
import {
  JD_EVALUATE_SYSTEM_PROMPT,
} from "@/lib/ai/prompts/jd-evaluate";

const findSettings = db.userSettings.findUnique as unknown as ReturnType<
  typeof vi.fn
>;
const updateJob = db.job.update as unknown as ReturnType<typeof vi.fn>;
const createAudit = db.aiAuditLog.create as unknown as ReturnType<typeof vi.fn>;
const generateObjectMock = generateObject as unknown as ReturnType<typeof vi.fn>;
const getModelMock = getModel as unknown as ReturnType<typeof vi.fn>;

function settingsRow(overrides: Record<string, unknown> = {}) {
  return {
    userId: "u1",
    settings: JSON.stringify({
      ai: { provider: "openai", model: "gpt-4o-mini" },
      ...overrides,
    }),
  };
}

function evaluationObject(globalScore: number, overrides: Record<string, unknown> = {}) {
  return {
    detectedArchetype: "ai-platform-llmops",
    grade: "F", // intentionally wrong so we can verify normalization
    globalScore,
    dimensionScores: {
      matchWithCv: 4,
      northStarAlignment: 4,
      comp: 3,
      culturalSignals: 4,
      redFlags: 5,
    },
    blocks: {
      roleSummary: "x",
      matchWithCv: "x",
      levelStrategy: "x",
      compDemand: "Advisory — verify externally: x",
      customizationPlan: "x",
      interviewPlan: "x",
    },
    keywords: Array.from({ length: 15 }, (_, i) => `keyword-${i}`),
    ...overrides,
  };
}

describe("runJdEvaluation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getModelMock.mockResolvedValue({ id: "fake-model" });
    createAudit.mockResolvedValue({ id: "audit-row" });
  });

  it("throws when jdText is empty / whitespace", async () => {
    findSettings.mockResolvedValue(settingsRow());
    await expect(
      runJdEvaluation({ userId: "u1", jdText: "   " }),
    ).rejects.toThrow(/jdText is required/);
    expect(generateObjectMock).not.toHaveBeenCalled();
  });

  it("throws when the user has no UserSettings row", async () => {
    findSettings.mockResolvedValue(null);
    await expect(
      runJdEvaluation({ userId: "u1", jdText: "a real JD body here" }),
    ).rejects.toThrow(/AI settings not configured/);
  });

  it("throws when provider/model are not picked", async () => {
    findSettings.mockResolvedValue({
      userId: "u1",
      settings: JSON.stringify({ ai: { provider: "openai" } }),
    });
    await expect(
      runJdEvaluation({ userId: "u1", jdText: "a real JD body" }),
    ).rejects.toThrow(/provider\/model not selected/);
  });

  it("throws when UserSettings JSON is corrupt", async () => {
    findSettings.mockResolvedValue({ userId: "u1", settings: "{not json" });
    await expect(
      runJdEvaluation({ userId: "u1", jdText: "JD body" }),
    ).rejects.toThrow(/UserSettings JSON is corrupt/);
  });

  it("calls generateObject with the JD evaluate system prompt", async () => {
    findSettings.mockResolvedValue(settingsRow());
    generateObjectMock.mockResolvedValue({
      object: evaluationObject(4.2),
      usage: { inputTokens: 1000, outputTokens: 500 },
    });

    await runJdEvaluation({ userId: "u1", jdText: "JD text here for eval" });

    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    const call = generateObjectMock.mock.calls[0][0];
    expect(call.system).toBe(JD_EVALUATE_SYSTEM_PROMPT);
    expect(call.schema).toBeDefined();
    expect(call.temperature).toBeDefined();
  });

  it("normalizes grade from globalScore (B for 4.2)", async () => {
    findSettings.mockResolvedValue(settingsRow());
    generateObjectMock.mockResolvedValue({
      object: evaluationObject(4.2),
      usage: { inputTokens: 100, outputTokens: 50 },
    });

    const result = await runJdEvaluation({
      userId: "u1",
      jdText: "JD",
    });
    expect(result.evaluation.grade).toBe("B");
  });

  it("normalizes grade from globalScore (F for 2.4)", async () => {
    findSettings.mockResolvedValue(settingsRow());
    generateObjectMock.mockResolvedValue({
      object: evaluationObject(2.4),
      usage: { inputTokens: 100, outputTokens: 50 },
    });
    const result = await runJdEvaluation({
      userId: "u1",
      jdText: "JD",
    });
    expect(result.evaluation.grade).toBe("F");
  });

  it("persists the normalized result on Job when jobId is provided", async () => {
    findSettings.mockResolvedValue(settingsRow());
    generateObjectMock.mockResolvedValue({
      object: evaluationObject(4.6),
      usage: { inputTokens: 100, outputTokens: 50 },
    });
    updateJob.mockResolvedValue({});

    await runJdEvaluation({
      userId: "u1",
      jdText: "JD body for persistence",
      jobId: "job-123",
    });

    expect(updateJob).toHaveBeenCalledTimes(1);
    const arg = updateJob.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "job-123" });
    expect(arg.data.evaluationGrade).toBe("A");
    expect(arg.data.evaluationJson).toContain("\"detectedArchetype\"");
    expect(arg.data.evaluatedAt).toBeInstanceOf(Date);
  });

  it("does NOT persist on Job when jobId is omitted", async () => {
    findSettings.mockResolvedValue(settingsRow());
    generateObjectMock.mockResolvedValue({
      object: evaluationObject(3.8),
      usage: { inputTokens: 100, outputTokens: 50 },
    });

    await runJdEvaluation({ userId: "u1", jdText: "JD" });
    expect(updateJob).not.toHaveBeenCalled();
  });

  it("writes a success AiAuditLog row with feature=evaluate", async () => {
    findSettings.mockResolvedValue(settingsRow());
    generateObjectMock.mockResolvedValue({
      object: evaluationObject(4.0),
      usage: { inputTokens: 800, outputTokens: 400 },
    });

    await runJdEvaluation({
      userId: "u1",
      jdText: "JD body for audit",
      jobId: "job-1",
    });

    expect(createAudit).toHaveBeenCalledTimes(1);
    const data = createAudit.mock.calls[0][0].data;
    expect(data.userId).toBe("u1");
    expect(data.feature).toBe("evaluate");
    expect(data.provider).toBe("openai");
    expect(data.model).toBe("gpt-4o-mini");
    expect(data.promptTokens).toBe(800);
    expect(data.completionTokens).toBe(400);
    expect(data.status).toBe("success");
    expect(data.jobId).toBe("job-1");
  });

  it("writes an error AiAuditLog row and re-throws when the LLM call fails", async () => {
    findSettings.mockResolvedValue(settingsRow());
    generateObjectMock.mockRejectedValue(new Error("LLM blew up"));

    await expect(
      runJdEvaluation({ userId: "u1", jdText: "JD" }),
    ).rejects.toThrow("LLM blew up");

    expect(createAudit).toHaveBeenCalledTimes(1);
    const data = createAudit.mock.calls[0][0].data;
    expect(data.feature).toBe("evaluate");
    expect(data.status).toBe("error");
    expect(data.errorMessage).toBe("LLM blew up");
    expect(data.totalTokens).toBe(0);
  });
});
