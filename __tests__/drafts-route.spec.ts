// CAREERFLOW: Phase 2 — route tests for src/app/api/drafts/route.ts.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/ai/drafts", () => ({ listDraftsForThread: vi.fn() }));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

import { GET } from "@/app/api/drafts/route";
import { auth } from "@/auth";
import { listDraftsForThread } from "@/lib/ai/drafts";

const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const listMock = listDraftsForThread as unknown as ReturnType<typeof vi.fn>;

function req(emailThreadId?: string | null) {
  const url = new URL("http://localhost/api/drafts");
  if (emailThreadId !== undefined && emailThreadId !== null) {
    url.searchParams.set("emailThreadId", emailThreadId);
  }
  return { nextUrl: url } as unknown as Parameters<typeof GET>[0];
}

describe("GET /api/drafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "u1" } });
  });

  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(req("t1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when emailThreadId is missing", async () => {
    const res = await GET(req());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/emailThreadId/);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("returns the drafts list scoped to the user + thread", async () => {
    listMock.mockResolvedValue([
      { id: "d2", content: "second" },
      { id: "d1", content: "first" },
    ]);
    const res = await GET(req("thread-1"));
    expect(res.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith("u1", "thread-1");
    const body = await res.json();
    expect(body.drafts).toHaveLength(2);
    expect(body.drafts[0].id).toBe("d2");
  });

  it("returns 500 when the underlying query throws", async () => {
    listMock.mockRejectedValue(new Error("db down"));
    const res = await GET(req("thread-1"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("db down");
  });
});
