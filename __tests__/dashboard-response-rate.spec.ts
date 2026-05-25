// CAREERFLOW: Phase 3 (PR #9) — tests for getResponseRateForUser.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@prisma/client", () => {
  const m = {
    emailThread: { findMany: vi.fn() },
    job: { count: vi.fn() },
    $transaction: vi.fn(),
  };
  return { PrismaClient: vi.fn(function () { return m; }) };
});

vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn() }));

import { getResponseRateForUser } from "@/actions/dashboard.actions";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const findMany = prisma.emailThread.findMany as unknown as ReturnType<typeof vi.fn>;

// Four applied jobs; positive replies land at increasing offsets so 30/60/90
// each pick up a different cumulative count.
function threads() {
  return [
    { jobId: "A", label: "Applied", receivedAt: "2026-01-01T00:00:00.000Z" },
    { jobId: "A", label: "Interview", receivedAt: "2026-01-15T00:00:00.000Z" }, // +14d
    { jobId: "B", label: "Applied", receivedAt: "2026-01-01T00:00:00.000Z" },
    { jobId: "B", label: "Offer", receivedAt: "2026-02-20T00:00:00.000Z" }, // +50d
    { jobId: "D", label: "Applied", receivedAt: "2026-01-01T00:00:00.000Z" },
    { jobId: "D", label: "NextPhase", receivedAt: "2026-04-01T00:00:00.000Z" }, // +90d
    { jobId: "C", label: "Applied", receivedAt: "2026-01-01T00:00:00.000Z" }, // no reply
    // not job-linked — must be ignored even if returned
    { jobId: null, label: "Applied", receivedAt: "2026-01-01T00:00:00.000Z" },
  ];
}

describe("getResponseRateForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes to the user and job-linked threads", async () => {
    findMany.mockResolvedValue([]);
    await getResponseRateForUser("u1");
    expect(findMany.mock.calls[0][0].where).toEqual({
      userId: "u1",
      jobId: { not: null },
    });
  });

  it("returns 0% for every window when there is no data", async () => {
    findMany.mockResolvedValue([]);
    const out = await getResponseRateForUser("u1");
    expect(out).toEqual([
      { windowDays: 30, appliedCount: 0, respondedCount: 0, rate: 0 },
      { windowDays: 60, appliedCount: 0, respondedCount: 0, rate: 0 },
      { windowDays: 90, appliedCount: 0, respondedCount: 0, rate: 0 },
    ]);
  });

  it("computes cumulative 30/60/90 response rates", async () => {
    findMany.mockResolvedValue(threads());
    const out = await getResponseRateForUser("u1");
    // 4 applied (the null-jobId one is ignored)
    expect(out[0]).toEqual({ windowDays: 30, appliedCount: 4, respondedCount: 1, rate: 25 });
    expect(out[1]).toEqual({ windowDays: 60, appliedCount: 4, respondedCount: 2, rate: 50 });
    expect(out[2]).toEqual({ windowDays: 90, appliedCount: 4, respondedCount: 3, rate: 75 });
  });

  it("does not divide by zero when there are replies but no applied threads", async () => {
    findMany.mockResolvedValue([
      { jobId: "X", label: "Interview", receivedAt: "2026-01-10T00:00:00.000Z" },
    ]);
    const out = await getResponseRateForUser("u1", [30]);
    expect(out).toEqual([
      { windowDays: 30, appliedCount: 0, respondedCount: 0, rate: 0 },
    ]);
  });
});
