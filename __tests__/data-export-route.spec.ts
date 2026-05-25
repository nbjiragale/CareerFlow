// CAREERFLOW: Phase 3 (PR #9) — route tests for GET /api/settings/data-export.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/export/collect", () => ({ collectUserExport: vi.fn() }));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

import { GET } from "@/app/api/settings/data-export/route";
import { auth } from "@/auth";
import { collectUserExport } from "@/lib/export/collect";

const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const collectMock = collectUserExport as unknown as ReturnType<typeof vi.fn>;

describe("GET /api/settings/data-export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "u1" } });
  });

  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(collectMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the user can't be found", async () => {
    collectMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns the export as a JSON attachment", async () => {
    const payload = { _meta: { userId: "u1" }, jobs: [{ id: "j1" }] };
    collectMock.mockResolvedValue(payload);

    const res = await GET();

    expect(collectMock).toHaveBeenCalledWith("u1");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toMatch(/^attachment; filename="careerflow-export-\d{4}-\d{2}-\d{2}\.json"$/);

    const body = await res.json();
    expect(body).toEqual(payload);
  });
});
