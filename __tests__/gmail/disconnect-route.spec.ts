vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/db", () => {
  const mockPrisma = {
    oAuthToken: { deleteMany: vi.fn() },
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

import { POST } from "@/app/api/gmail/disconnect/route";
import { auth } from "@/auth";
import prisma from "@/lib/db";

const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const deleteMany = prisma.oAuthToken.deleteMany as unknown as ReturnType<typeof vi.fn>;

describe("POST /api/gmail/disconnect", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("deletes the user's google OAuthToken row", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    deleteMany.mockResolvedValue({ count: 1 });

    const res = await POST();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", provider: "google" },
    });
  });
});
