// CAREERFLOW: Phase 2 — unit tests for src/lib/ai/audit.ts.
//
// recordAiUsage must:
//   - Write the correct row shape on success
//   - Compute costUsd from pricing.ts and totalTokens by hand
//   - Swallow DB failures (never re-throw) and return null

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  default: {
    aiAuditLog: {
      create: vi.fn(),
    },
  },
}));

import db from "@/lib/db";
import { recordAiUsage } from "@/lib/ai/audit";

describe("recordAiUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes a success row with computed cost and total tokens", async () => {
    (db.aiAuditLog.create as any).mockResolvedValue({ id: "row-1" });

    const result = await recordAiUsage({
      userId: "u1",
      feature: "evaluate",
      provider: "openai",
      model: "gpt-4o-mini",
      usage: { promptTokens: 1000, completionTokens: 500 },
      msElapsed: 1234,
      status: "success",
      jobId: "j1",
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe("row-1");
    // 1k input * 0.15/1M + 0.5k output * 0.6/1M
    expect(result?.costUsd).toBeCloseTo(
      (1000 / 1_000_000) * 0.15 + (500 / 1_000_000) * 0.6,
      8,
    );

    const arg = (db.aiAuditLog.create as any).mock.calls[0][0];
    expect(arg.data.userId).toBe("u1");
    expect(arg.data.feature).toBe("evaluate");
    expect(arg.data.provider).toBe("openai");
    expect(arg.data.model).toBe("gpt-4o-mini");
    expect(arg.data.promptTokens).toBe(1000);
    expect(arg.data.completionTokens).toBe(500);
    expect(arg.data.totalTokens).toBe(1500);
    expect(arg.data.msElapsed).toBe(1234);
    expect(arg.data.status).toBe("success");
    expect(arg.data.jobId).toBe("j1");
    expect(arg.data.emailThreadId).toBeNull();
  });

  it("records an error row with errorMessage and zero cost when usage is omitted", async () => {
    (db.aiAuditLog.create as any).mockResolvedValue({ id: "row-2" });

    const result = await recordAiUsage({
      userId: "u1",
      feature: "reply-draft",
      provider: "ollama",
      model: "llama3.1",
      msElapsed: 50,
      status: "error",
      errorMessage: "Model went sideways",
      emailThreadId: "t1",
    });

    expect(result?.costUsd).toBe(0);
    const arg = (db.aiAuditLog.create as any).mock.calls[0][0];
    expect(arg.data.status).toBe("error");
    expect(arg.data.errorMessage).toBe("Model went sideways");
    expect(arg.data.totalTokens).toBe(0);
    expect(arg.data.emailThreadId).toBe("t1");
  });

  it("propagates the pricing warning for unknown models", async () => {
    (db.aiAuditLog.create as any).mockResolvedValue({ id: "row-3" });

    const result = await recordAiUsage({
      userId: "u1",
      feature: "evaluate",
      provider: "openai",
      model: "future-model-9000",
      usage: { promptTokens: 1, completionTokens: 1 },
      msElapsed: 1,
      status: "success",
    });

    expect(result?.warning).toMatch(/Unknown model/);
  });

  it("returns null and does NOT throw when the DB write fails", async () => {
    (db.aiAuditLog.create as any).mockRejectedValue(new Error("disk full"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await recordAiUsage({
      userId: "u1",
      feature: "evaluate",
      provider: "openai",
      model: "gpt-4o",
      msElapsed: 10,
      status: "success",
    });

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
