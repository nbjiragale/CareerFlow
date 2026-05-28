// CAREERFLOW: route tests for src/app/api/status-suggestions/route.ts.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/gmail/status-suggestions", () => ({
  applyStatusSuggestion: vi.fn(),
  dismissStatusSuggestion: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

import { POST } from "@/app/api/status-suggestions/route";
import { auth } from "@/auth";
import {
  applyStatusSuggestion,
  dismissStatusSuggestion,
} from "@/lib/gmail/status-suggestions";

const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const applyMock = applyStatusSuggestion as unknown as ReturnType<typeof vi.fn>;
const dismissMock = dismissStatusSuggestion as unknown as ReturnType<
  typeof vi.fn
>;

function req(body: unknown): { json: () => Promise<unknown> } {
  return { json: async () => body };
}

describe("POST /api/status-suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "u1" } });
  });

  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(req({ threadId: "t1", action: "apply" }) as never);
    expect(res.status).toBe(401);
    expect(applyMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an unknown action", async () => {
    const res = await POST(req({ threadId: "t1", action: "nuke" }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when threadId is missing", async () => {
    const res = await POST(req({ action: "apply" }) as never);
    expect(res.status).toBe(400);
  });

  it("applies and returns the new status", async () => {
    applyMock.mockResolvedValue({
      ok: true,
      jobId: "j1",
      newStatusValue: "interview",
      newStatusLabel: "Interview",
    });
    const res = await POST(req({ threadId: "t1", action: "apply" }) as never);
    expect(res.status).toBe(200);
    expect(applyMock).toHaveBeenCalledWith("u1", "t1");
    expect((await res.json()).newStatusValue).toBe("interview");
  });

  it("passes through the stale (no-op) apply result", async () => {
    applyMock.mockResolvedValue({ ok: false, reason: "stale" });
    const res = await POST(req({ threadId: "t1", action: "apply" }) as never);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(false);
  });

  it("dismisses", async () => {
    dismissMock.mockResolvedValue({ ok: true });
    const res = await POST(req({ threadId: "t1", action: "dismiss" }) as never);
    expect(res.status).toBe(200);
    expect(dismissMock).toHaveBeenCalledWith("u1", "t1");
    expect(applyMock).not.toHaveBeenCalled();
  });

  it("maps 'not found' errors to 404", async () => {
    applyMock.mockRejectedValue(new Error("Suggestion not found."));
    const res = await POST(req({ threadId: "missing", action: "apply" }) as never);
    expect(res.status).toBe(404);
  });

  it("maps other errors to 500", async () => {
    dismissMock.mockRejectedValue(new Error("db exploded"));
    const res = await POST(req({ threadId: "t1", action: "dismiss" }) as never);
    expect(res.status).toBe(500);
  });
});
