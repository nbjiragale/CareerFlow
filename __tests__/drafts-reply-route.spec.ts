// CAREERFLOW: Phase 2 — route tests for src/app/api/drafts/reply/route.ts.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/ai/rate-limiter", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/ai/drafts", () => ({ generateReplyDraft: vi.fn() }));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

import { POST } from "@/app/api/drafts/reply/route";
import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import { generateReplyDraft } from "@/lib/ai/drafts";

const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const rateMock = checkRateLimit as unknown as ReturnType<typeof vi.fn>;
const draftMock = generateReplyDraft as unknown as ReturnType<typeof vi.fn>;

function req(body: unknown): { json: () => Promise<unknown> } {
  return { json: async () => body };
}

describe("POST /api/drafts/reply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "u1" } });
    rateMock.mockReturnValue({ allowed: true, remaining: 9, resetIn: 60_000 });
  });

  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(
      req({ emailThreadId: "t1", intent: "reply" }) as never,
    );
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    rateMock.mockReturnValue({ allowed: false, remaining: 0, resetIn: 30_000 });
    const res = await POST(
      req({ emailThreadId: "t1", intent: "reply" }) as never,
    );
    expect(res.status).toBe(429);
    expect(draftMock).not.toHaveBeenCalled();
  });

  it("returns 400 when intent is not one of the four allowed values", async () => {
    const res = await POST(
      req({ emailThreadId: "t1", intent: "rant" }) as never,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when emailThreadId is missing", async () => {
    const res = await POST(req({ intent: "reply" }) as never);
    expect(res.status).toBe(400);
  });

  it("forwards a valid request and returns the generated draft", async () => {
    draftMock.mockResolvedValue({
      draft: { body: "hi", tone: "warm" },
      draftId: "d1",
      provider: "openai",
      model: "gpt-4o-mini",
      costUsd: 0.0005,
      bodyWasAvailable: true,
      msElapsed: 250,
    });
    const res = await POST(
      req({
        emailThreadId: "t1",
        intent: "follow-up",
        resumeSummary: "...",
      }) as never,
    );
    expect(res.status).toBe(200);
    expect(draftMock).toHaveBeenCalledWith({
      userId: "u1",
      emailThreadId: "t1",
      intent: "follow-up",
      resumeSummary: "...",
    });
    const body = await res.json();
    expect(body.draftId).toBe("d1");
  });

  it("maps 'thread not found' errors to 404", async () => {
    draftMock.mockRejectedValue(new Error("Email thread not found."));
    const res = await POST(
      req({ emailThreadId: "t-missing", intent: "reply" }) as never,
    );
    expect(res.status).toBe(404);
  });

  it("maps 'not configured' errors to 412", async () => {
    draftMock.mockRejectedValue(new Error("AI settings not configured."));
    const res = await POST(
      req({ emailThreadId: "t1", intent: "reply" }) as never,
    );
    expect(res.status).toBe(412);
  });

  it("maps generic errors to 500", async () => {
    draftMock.mockRejectedValue(new Error("provider 500"));
    const res = await POST(
      req({ emailThreadId: "t1", intent: "reply" }) as never,
    );
    expect(res.status).toBe(500);
  });

  it("accepts all four intents", async () => {
    draftMock.mockResolvedValue({
      draft: { body: "hi", tone: "x" },
      draftId: "d1",
      provider: "openai",
      model: "gpt-4o",
      costUsd: 0,
      bodyWasAvailable: true,
      msElapsed: 1,
    });
    for (const intent of ["reply", "follow-up", "thank-you", "confirm"]) {
      const res = await POST(
        req({ emailThreadId: "t1", intent }) as never,
      );
      expect(res.status, `intent=${intent}`).toBe(200);
    }
  });
});
