// CAREERFLOW: Phase 3 (PR #9) — tests for getFunnelForUser.

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

import { getFunnelForUser } from "@/actions/dashboard.actions";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const count = prisma.job.count as unknown as ReturnType<typeof vi.fn>;
const transaction = prisma.$transaction as unknown as ReturnType<typeof vi.fn>;

describe("getFunnelForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts each stage scoped to the user and returns labelled stages", async () => {
    transaction.mockResolvedValue([5, 3, 1]);
    const out = await getFunnelForUser("u1");

    expect(out).toEqual([
      { stage: "applied", label: "Applied", count: 5 },
      { stage: "interview", label: "Interview", count: 3 },
      { stage: "offer", label: "Offer", count: 1 },
    ]);

    expect(count).toHaveBeenCalledTimes(3);
    expect(count).toHaveBeenNthCalledWith(1, {
      where: { userId: "u1", Status: { value: "applied" } },
    });
    expect(count).toHaveBeenNthCalledWith(2, {
      where: { userId: "u1", Status: { value: "interview" } },
    });
    expect(count).toHaveBeenNthCalledWith(3, {
      where: { userId: "u1", Status: { value: "offer" } },
    });
  });

  it("treats missing stage counts as 0", async () => {
    transaction.mockResolvedValue([2]); // only the first resolved
    const out = await getFunnelForUser("u1");
    expect(out.map((s) => s.count)).toEqual([2, 0, 0]);
  });
});
