vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/db", () => {
  const mockPrisma = {
    emailThread: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    emailClassificationCorrection: {
      upsert: vi.fn(),
    },
    userSettings: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return { default: mockPrisma };
});

vi.mock("@/lib/gmail/job-link", () => ({
  findOrCreateJobForClassification: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

import { POST } from "@/app/api/gmail/threads/[id]/correct/route";
import { auth } from "@/auth";
import prisma from "@/lib/db";
import { findOrCreateJobForClassification } from "@/lib/gmail/job-link";

const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const findFirst = prisma.emailThread.findFirst as unknown as ReturnType<typeof vi.fn>;
const update = prisma.emailThread.update as unknown as ReturnType<typeof vi.fn>;
const upsert = prisma.emailClassificationCorrection.upsert as unknown as ReturnType<typeof vi.fn>;
const settingsFind = prisma.userSettings.findUnique as unknown as ReturnType<typeof vi.fn>;
const txn = prisma.$transaction as unknown as ReturnType<typeof vi.fn>;
const link = findOrCreateJobForClassification as unknown as ReturnType<typeof vi.fn>;

function makeReq(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0];
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) } as Parameters<typeof POST>[1];
}

describe("POST /api/gmail/threads/[id]/correct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "u1" } });
    settingsFind.mockResolvedValue(null);
    update.mockResolvedValue({
      id: "t1",
      label: "Interview",
      needsReview: false,
      jobId: "job1",
    });
    upsert.mockResolvedValue({});
    txn.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
    link.mockResolvedValue({ jobId: "job1", created: false });
  });

  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await POST(makeReq({ label: "Applied" }), ctx("t1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid label", async () => {
    const res = await POST(makeReq({ label: "Banana" }), ctx("t1"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the thread isn't owned by the user", async () => {
    findFirst.mockResolvedValue(null);
    const res = await POST(makeReq({ label: "Applied" }), ctx("t1"));
    expect(res.status).toBe(404);
  });

  it("writes an audit row + flips needsReview + relinks Job", async () => {
    findFirst.mockResolvedValue({
      id: "t1",
      userId: "u1",
      label: "NotJobRelated",
      confidence: 0.0,
      extractedCompany: "Acme",
      extractedRole: null,
      subject: "Phone screen",
      receivedAt: new Date("2025-03-01T10:00:00Z"),
      jobId: null,
    });

    const res = await POST(makeReq({ label: "Interview" }), ctx("t1"));

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t1" },
        data: expect.objectContaining({
          label: "Interview",
          needsReview: false,
        }),
      }),
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { emailThreadId: "t1" },
        create: expect.objectContaining({
          userId: "u1",
          emailThreadId: "t1",
          originalLabel: "NotJobRelated",
          correctedLabel: "Interview",
          originalConfidence: 0.0,
        }),
      }),
    );
    expect(link).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Interview",
        confidence: 1.0,
      }),
    );
  });

  it("unlinks the Job when corrected to NotJobRelated", async () => {
    findFirst.mockResolvedValue({
      id: "t1",
      userId: "u1",
      label: "Applied",
      confidence: 0.8,
      extractedCompany: "Acme",
      extractedRole: null,
      subject: "Update",
      receivedAt: new Date(),
      jobId: "job123",
    });

    update.mockResolvedValue({
      id: "t1",
      label: "NotJobRelated",
      needsReview: false,
      jobId: null,
    });

    const res = await POST(makeReq({ label: "NotJobRelated" }), ctx("t1"));
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ jobId: null }),
      }),
    );
    expect(link).not.toHaveBeenCalled();
  });
});
