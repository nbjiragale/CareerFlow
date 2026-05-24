vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/db", () => {
  const mockPrisma = {
    oAuthToken: { findUnique: vi.fn() },
    userSettings: { findUnique: vi.fn() },
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

import { GET } from "@/app/api/gmail/status/route";
import { auth } from "@/auth";
import prisma from "@/lib/db";

const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const findToken = prisma.oAuthToken.findUnique as unknown as ReturnType<typeof vi.fn>;
const findSettings = prisma.userSettings.findUnique as unknown as ReturnType<typeof vi.fn>;

const originalGoogle = {
  id: process.env.GOOGLE_CLIENT_ID,
  secret: process.env.GOOGLE_CLIENT_SECRET,
  redirect: process.env.GOOGLE_REDIRECT_URI,
};
const originalHf = process.env.HUGGINGFACE_SPACE_URL;

describe("GET /api/gmail/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "u1" } });
  });

  afterAll(() => {
    process.env.GOOGLE_CLIENT_ID = originalGoogle.id;
    process.env.GOOGLE_CLIENT_SECRET = originalGoogle.secret;
    process.env.GOOGLE_REDIRECT_URI = originalGoogle.redirect;
    if (originalHf === undefined) delete process.env.HUGGINGFACE_SPACE_URL;
    else process.env.HUGGINGFACE_SPACE_URL = originalHf;
  });

  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("reports disconnected + keyword classifier when nothing is configured", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
    delete process.env.HUGGINGFACE_SPACE_URL;
    findToken.mockResolvedValue(null);
    findSettings.mockResolvedValue(null);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.oauthConfigured).toBe(false);
    expect(data.classifier).toBe("keyword");
    expect(data.connected).toBe(false);
    expect(data.email).toBeNull();
    expect(data.settings.classificationThreshold).toBe(0.7);
  });

  it("reports connected + huggingface classifier when both are configured", async () => {
    process.env.GOOGLE_CLIENT_ID = "id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:3737/api/gmail/callback";
    process.env.HUGGINGFACE_SPACE_URL = "owner/space";
    findToken.mockResolvedValue({
      email: "user@example.com",
      lastUsedAt: new Date("2025-03-01T10:00:00Z"),
    });
    findSettings.mockResolvedValue({
      settings: JSON.stringify({
        gmail: { classificationThreshold: 0.8, lastSyncedAt: "2025-03-01T10:00:00Z" },
      }),
    });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.oauthConfigured).toBe(true);
    expect(data.classifier).toBe("huggingface");
    expect(data.connected).toBe(true);
    expect(data.email).toBe("user@example.com");
    expect(data.settings.classificationThreshold).toBe(0.8);
    expect(data.lastSyncedAt).toBe("2025-03-01T10:00:00Z");
  });
});
