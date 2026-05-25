// CAREERFLOW: Phase 3 (PR #9) — route tests for POST /api/settings/delete-account.
// Cascade correctness itself is covered by phase-3-cascade-integration.spec.ts
// (real temp SQLite); these tests cover the route's auth + confirmation logic.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/db", () => {
  const mockPrisma = {
    user: { delete: vi.fn() },
  };
  return { default: mockPrisma };
});

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

import { POST } from "@/app/api/settings/delete-account/route";
import { auth } from "@/auth";
import prisma from "@/lib/db";

const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const userDelete = prisma.user.delete as unknown as ReturnType<typeof vi.fn>;

function req(body: unknown): { json: () => Promise<unknown> } {
  return { json: async () => body };
}

describe("POST /api/settings/delete-account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "u1", email: "ada@example.com" } });
    userDelete.mockResolvedValue({ id: "u1" });
  });

  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(req({ confirmEmail: "ada@example.com" }) as never);
    expect(res.status).toBe(401);
    expect(userDelete).not.toHaveBeenCalled();
  });

  it("returns 400 when the confirmation email does not match", async () => {
    const res = await POST(req({ confirmEmail: "wrong@example.com" }) as never);
    expect(res.status).toBe(400);
    expect(userDelete).not.toHaveBeenCalled();
  });

  it("matches the email case-insensitively and deletes the user", async () => {
    const res = await POST(req({ confirmEmail: "  ADA@Example.com " }) as never);
    expect(res.status).toBe(200);
    expect(userDelete).toHaveBeenCalledWith({ where: { id: "u1" } });
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("is idempotent when the user is already gone (P2025)", async () => {
    userDelete.mockRejectedValue({ code: "P2025" });
    const res = await POST(req({ confirmEmail: "ada@example.com" }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.alreadyDeleted).toBe(true);
  });

  it("returns 500 on an unexpected delete error", async () => {
    userDelete.mockRejectedValue(new Error("db exploded"));
    const res = await POST(req({ confirmEmail: "ada@example.com" }) as never);
    expect(res.status).toBe(500);
  });

  it("returns 400 when no confirmEmail is provided", async () => {
    const res = await POST(req({}) as never);
    expect(res.status).toBe(400);
  });
});
