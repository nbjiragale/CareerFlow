// CAREERFLOW: Phase 2 — route tests for src/app/api/evaluate/route.ts.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/ai/rate-limiter", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/ai/evaluate", () => ({ runJdEvaluation: vi.fn() }));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

import { POST } from "@/app/api/evaluate/route";
import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import { runJdEvaluation } from "@/lib/ai/evaluate";

const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const rateMock = checkRateLimit as unknown as ReturnType<typeof vi.fn>;
const evalMock = runJdEvaluation as unknown as ReturnType<typeof vi.fn>;

function req(body: unknown): { json: () => Promise<unknown> } {
  return { json: async () => body };
}

const validJd = "A".repeat(40);

describe("POST /api/evaluate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "u1" } });
    rateMock.mockReturnValue({ allowed: true, remaining: 9, resetIn: 60_000 });
  });

  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(req({ jdText: validJd }) as never);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    rateMock.mockReturnValue({ allowed: false, remaining: 0, resetIn: 12_000 });
    const res = await POST(req({ jdText: validJd }) as never);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/Rate limit/);
    expect(evalMock).not.toHaveBeenCalled();
  });

  it("returns 400 when jdText is too short", async () => {
    const res = await POST(req({ jdText: "short" }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid request body/);
  });

  it("returns 400 when archetypeHint is invalid", async () => {
    const res = await POST(
      req({ jdText: validJd, archetypeHint: "made-up-role" }) as never,
    );
    expect(res.status).toBe(400);
  });

  it("forwards a valid request to runJdEvaluation and returns its result", async () => {
    evalMock.mockResolvedValue({
      evaluation: { grade: "B", globalScore: 4.2 },
      provider: "openai",
      model: "gpt-4o-mini",
      costUsd: 0.01,
      msElapsed: 1234,
    });
    const res = await POST(
      req({
        jdText: validJd,
        archetypeHint: "ai-pm",
        resumeSummary: "summary",
        jobId: "j-1",
      }) as never,
    );
    expect(res.status).toBe(200);
    expect(evalMock).toHaveBeenCalledWith({
      userId: "u1",
      jdText: validJd,
      archetypeHint: "ai-pm",
      resumeSummary: "summary",
      jobId: "j-1",
    });
    const data = await res.json();
    expect(data.evaluation.grade).toBe("B");
  });

  it("accepts auto-detect as a valid archetypeHint", async () => {
    evalMock.mockResolvedValue({
      evaluation: { grade: "C" },
      provider: "openai",
      model: "gpt-4o-mini",
      costUsd: 0,
      msElapsed: 1,
    });
    const res = await POST(
      req({ jdText: validJd, archetypeHint: "auto-detect" }) as never,
    );
    expect(res.status).toBe(200);
  });

  it("maps 'not configured' errors to 412 Precondition Failed", async () => {
    evalMock.mockRejectedValue(new Error("AI settings not configured."));
    const res = await POST(req({ jdText: validJd }) as never);
    expect(res.status).toBe(412);
  });

  it("maps 'not selected' errors to 412", async () => {
    evalMock.mockRejectedValue(
      new Error("AI provider/model not selected."),
    );
    const res = await POST(req({ jdText: validJd }) as never);
    expect(res.status).toBe(412);
  });

  it("maps generic errors to 500", async () => {
    evalMock.mockRejectedValue(new Error("LLM exploded"));
    const res = await POST(req({ jdText: validJd }) as never);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("LLM exploded");
  });
});
