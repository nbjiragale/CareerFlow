// CAREERFLOW: Phase 2 — route tests for src/app/api/usage/route.ts.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/ai/usage", () => ({ getUsageSummary: vi.fn() }));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

import { GET } from "@/app/api/usage/route";
import { auth } from "@/auth";
import { getUsageSummary } from "@/lib/ai/usage";

const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const summaryMock = getUsageSummary as unknown as ReturnType<typeof vi.fn>;

function req(days?: string | null) {
  const url = new URL("http://localhost/api/usage");
  if (days !== undefined && days !== null) {
    url.searchParams.set("days", days);
  }
  return { nextUrl: url } as unknown as Parameters<typeof GET>[0];
}

const emptySummary = {
  rangeDays: 30,
  totals: { calls: 0, costUsd: 0 },
  daily: [],
  byModel: [],
  byFeature: [],
};

describe("GET /api/usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "u1" } });
    summaryMock.mockResolvedValue(emptySummary);
  });

  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("uses the default 30-day window when days param is omitted", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(summaryMock).toHaveBeenCalledWith("u1", 30);
  });

  it("respects an explicit days param", async () => {
    const res = await GET(req("7"));
    expect(res.status).toBe(200);
    expect(summaryMock).toHaveBeenCalledWith("u1", 7);
  });

  it("clamps days to a hard ceiling of 365", async () => {
    const res = await GET(req("9999"));
    expect(res.status).toBe(200);
    expect(summaryMock).toHaveBeenCalledWith("u1", 365);
  });

  it("rejects non-numeric days param", async () => {
    const res = await GET(req("banana"));
    expect(res.status).toBe(400);
    expect(summaryMock).not.toHaveBeenCalled();
  });

  it("rejects days < 1", async () => {
    const res = await GET(req("0"));
    expect(res.status).toBe(400);
    expect(summaryMock).not.toHaveBeenCalled();
  });

  it("returns 500 when the aggregator throws", async () => {
    summaryMock.mockRejectedValue(new Error("aggregation failed"));
    const res = await GET(req());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("aggregation failed");
  });
});
