vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/db", () => {
  const mockPrisma = {
    userSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
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

import { GET, PUT } from "@/app/api/gmail/settings/route";
import { auth } from "@/auth";
import prisma from "@/lib/db";

const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const findUnique = (prisma.userSettings.findUnique as unknown) as ReturnType<typeof vi.fn>;
const upsert = (prisma.userSettings.upsert as unknown) as ReturnType<typeof vi.fn>;

function makeReq(body: unknown): { json: () => Promise<unknown> } {
  return {
    json: async () => body,
  };
}

describe("GET /api/gmail/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "u1" } });
  });

  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns defaults for a fresh user", async () => {
    findUnique.mockResolvedValue(null);
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.settings.classificationThreshold).toBe(0.7);
    expect(data.settings.excludedEmails).toEqual([]);
  });
});

describe("PUT /api/gmail/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "u1" } });
    findUnique.mockResolvedValue(null);
    upsert.mockResolvedValue({});
  });

  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await PUT(makeReq({}) as never);
    expect(res.status).toBe(401);
  });

  it("rejects out-of-range thresholds", async () => {
    const res = await PUT(makeReq({ classificationThreshold: 1.5 }) as never);
    expect(res.status).toBe(400);
  });

  it("rejects non-string entries in excludedEmails", async () => {
    const res = await PUT(makeReq({ excludedEmails: [1, 2, 3] }) as never);
    expect(res.status).toBe(400);
  });

  it("rejects a non-object body", async () => {
    const res = await PUT(makeReq(null) as never);
    expect(res.status).toBe(400);
  });

  it("persists a valid threshold + exclusion list", async () => {
    const res = await PUT(
      makeReq({
        classificationThreshold: 0.85,
        excludedEmails: ["@indeed.com", "noreply@x.com"],
      }) as never,
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.settings.classificationThreshold).toBe(0.85);
    expect(data.settings.excludedEmails).toEqual([
      "@indeed.com",
      "noreply@x.com",
    ]);
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});
