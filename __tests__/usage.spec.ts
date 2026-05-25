// CAREERFLOW: Phase 2 — unit tests for src/lib/ai/usage.ts.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  default: {
    aiAuditLog: {
      findMany: vi.fn(),
    },
  },
}));

import db from "@/lib/db";
import { getUsageSummary } from "@/lib/ai/usage";

function makeRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "1",
    userId: "u1",
    feature: "evaluate",
    provider: "openai",
    model: "gpt-4o-mini",
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
    costUsd: 0.02,
    msElapsed: 1000,
    status: "success",
    errorMessage: null,
    jobId: null,
    emailThreadId: null,
    createdAt: new Date(),
    ...over,
  };
}

describe("getUsageSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero totals when no rows", async () => {
    (db.aiAuditLog.findMany as any).mockResolvedValue([]);
    const summary = await getUsageSummary("u1", 30);
    expect(summary.rangeDays).toBe(30);
    expect(summary.totals.calls).toBe(0);
    expect(summary.totals.costUsd).toBe(0);
    expect(summary.byModel).toEqual([]);
    expect(summary.byFeature).toEqual([]);
    // Should still produce 30 daily buckets, all zero.
    expect(summary.daily).toHaveLength(30);
    expect(summary.daily.every((d) => d.calls === 0)).toBe(true);
  });

  it("aggregates calls + cost + tokens across rows", async () => {
    (db.aiAuditLog.findMany as any).mockResolvedValue([
      makeRow({ costUsd: 0.01, promptTokens: 100, completionTokens: 50, totalTokens: 150 }),
      makeRow({ costUsd: 0.02, promptTokens: 200, completionTokens: 100, totalTokens: 300, status: "error", errorMessage: "x" }),
      makeRow({ model: "gpt-4o", costUsd: 0.5, promptTokens: 1000, completionTokens: 500, totalTokens: 1500 }),
    ]);

    const summary = await getUsageSummary("u1", 7);
    expect(summary.totals.calls).toBe(3);
    expect(summary.totals.costUsd).toBeCloseTo(0.53, 6);
    expect(summary.totals.successCount).toBe(2);
    expect(summary.totals.errorCount).toBe(1);
    expect(summary.totals.promptTokens).toBe(1300);
    expect(summary.totals.completionTokens).toBe(650);
  });

  it("buckets by model and sorts by cost descending", async () => {
    (db.aiAuditLog.findMany as any).mockResolvedValue([
      makeRow({ model: "gpt-4o-mini", costUsd: 0.01 }),
      makeRow({ model: "gpt-4o", costUsd: 0.5 }),
      makeRow({ model: "gpt-4o-mini", costUsd: 0.01 }),
    ]);

    const summary = await getUsageSummary("u1", 7);
    expect(summary.byModel).toHaveLength(2);
    expect(summary.byModel[0].model).toBe("gpt-4o");
    expect(summary.byModel[0].calls).toBe(1);
    expect(summary.byModel[0].costUsd).toBeCloseTo(0.5, 6);
    expect(summary.byModel[1].model).toBe("gpt-4o-mini");
    expect(summary.byModel[1].calls).toBe(2);
    expect(summary.byModel[1].costUsd).toBeCloseTo(0.02, 6);
  });

  it("buckets by feature", async () => {
    (db.aiAuditLog.findMany as any).mockResolvedValue([
      makeRow({ feature: "evaluate", costUsd: 0.1 }),
      makeRow({ feature: "reply-draft", costUsd: 0.05 }),
      makeRow({ feature: "evaluate", costUsd: 0.2 }),
    ]);
    const summary = await getUsageSummary("u1", 7);
    expect(summary.byFeature[0].feature).toBe("evaluate");
    expect(summary.byFeature[0].calls).toBe(2);
    expect(summary.byFeature[0].costUsd).toBeCloseTo(0.3, 6);
    expect(summary.byFeature[1].feature).toBe("reply-draft");
    expect(summary.byFeature[1].calls).toBe(1);
  });

  it("clamps the range to [1, 365]", async () => {
    (db.aiAuditLog.findMany as any).mockResolvedValue([]);
    expect((await getUsageSummary("u1", 0)).rangeDays).toBe(1);
    expect((await getUsageSummary("u1", -10)).rangeDays).toBe(1);
    expect((await getUsageSummary("u1", 9999)).rangeDays).toBe(365);
  });

  it("queries with the correct since boundary", async () => {
    (db.aiAuditLog.findMany as any).mockResolvedValue([]);
    await getUsageSummary("u1", 7);
    const arg = (db.aiAuditLog.findMany as any).mock.calls[0][0];
    expect(arg.where.userId).toBe("u1");
    expect(arg.where.createdAt.gte).toBeInstanceOf(Date);
    const diffMs = Date.now() - arg.where.createdAt.gte.getTime();
    // Should be within a second of 7 days.
    expect(diffMs).toBeGreaterThan(7 * 24 * 60 * 60 * 1000 - 1000);
    expect(diffMs).toBeLessThan(7 * 24 * 60 * 60 * 1000 + 1000);
  });
});
