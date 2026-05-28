// CAREERFLOW: route tests for src/app/api/edge/route.ts.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/ai/rate-limiter", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/ai/edge", () => ({ generateCareerEdge: vi.fn() }));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

import { POST } from "@/app/api/edge/route";
import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import { generateCareerEdge } from "@/lib/ai/edge";
import { StructuredOutputUnsupportedError } from "@/lib/ai/structured";

const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const rateMock = checkRateLimit as unknown as ReturnType<typeof vi.fn>;
const edgeMock = generateCareerEdge as unknown as ReturnType<typeof vi.fn>;

describe("POST /api/edge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "u1" } });
    rateMock.mockReturnValue({ allowed: true, remaining: 9, resetIn: 60_000 });
  });

  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
    expect(edgeMock).not.toHaveBeenCalled();
  });

  it("returns 429 when rate-limited", async () => {
    rateMock.mockReturnValue({ allowed: false, remaining: 0, resetIn: 30_000 });
    const res = await POST();
    expect(res.status).toBe(429);
    expect(edgeMock).not.toHaveBeenCalled();
  });

  it("passes through the learning state with 200", async () => {
    edgeMock.mockResolvedValue({ status: "learning", facts: {} });
    const res = await POST();
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("learning");
  });

  it("returns the generated insights on success", async () => {
    edgeMock.mockResolvedValue({
      status: "ok",
      facts: {},
      insights: { headline: "hi", insights: [], nextActions: [] },
      provider: "openai",
      model: "gpt-4o-mini",
      costUsd: 0.001,
      msElapsed: 200,
    });
    const res = await POST();
    expect(res.status).toBe(200);
    expect((await res.json()).insights.headline).toBe("hi");
  });

  it("maps StructuredOutputUnsupportedError to 422 with a code", async () => {
    edgeMock.mockRejectedValue(new StructuredOutputUnsupportedError("nope"));
    const res = await POST();
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("structured_output_unsupported");
  });

  it("maps 'not configured' errors to 412", async () => {
    edgeMock.mockRejectedValue(new Error("AI settings not configured."));
    const res = await POST();
    expect(res.status).toBe(412);
  });

  it("maps generic errors to 500", async () => {
    edgeMock.mockRejectedValue(new Error("provider 500"));
    const res = await POST();
    expect(res.status).toBe(500);
  });
});
