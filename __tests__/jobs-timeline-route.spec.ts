// CAREERFLOW: Phase 3 — route tests for GET /api/jobs/:id/timeline.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/db", () => {
  const mockPrisma = {
    job: { findFirst: vi.fn() },
    emailThread: { findMany: vi.fn() },
    aiDraft: { findMany: vi.fn() },
    activity: { findMany: vi.fn() },
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

import { GET } from "@/app/api/jobs/[id]/timeline/route";
import { auth } from "@/auth";
import prisma from "@/lib/db";

const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const jobFindFirst = prisma.job.findFirst as unknown as ReturnType<typeof vi.fn>;
const threadFindMany = prisma.emailThread.findMany as unknown as ReturnType<typeof vi.fn>;
const draftFindMany = prisma.aiDraft.findMany as unknown as ReturnType<typeof vi.fn>;
const activityFindMany = prisma.activity.findMany as unknown as ReturnType<typeof vi.fn>;

function req(url = "http://localhost:3737/api/jobs/j1/timeline") {
  return { url } as never;
}
function ctx(id = "j1") {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/jobs/:id/timeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "u1" } });
    jobFindFirst.mockResolvedValue({ id: "j1" });
    threadFindMany.mockResolvedValue([]);
    draftFindMany.mockResolvedValue([]);
    activityFindMany.mockResolvedValue([]);
  });

  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET(req(), ctx());
    expect(res.status).toBe(401);
  });

  it("returns 404 when the job isn't owned by the user", async () => {
    jobFindFirst.mockResolvedValue(null);
    const res = await GET(req(), ctx());
    expect(res.status).toBe(404);
    // scoped by userId
    expect(jobFindFirst.mock.calls[0][0].where).toEqual({ id: "j1", userId: "u1" });
  });

  it("merges all three sources sorted DESC", async () => {
    threadFindMany.mockResolvedValue([
      {
        id: "t1",
        label: "Interview",
        confidence: 0.9,
        subject: "Interview invite",
        snippet: "...",
        fromAddress: "r@acme.com",
        receivedAt: "2026-01-03T00:00:00.000Z",
      },
    ]);
    draftFindMany.mockResolvedValue([
      {
        id: "d1",
        draftType: "reply",
        subject: "Re: invite",
        content: "thanks",
        createdAt: "2026-01-04T00:00:00.000Z",
      },
    ]);
    activityFindMany.mockResolvedValue([
      {
        id: "a1",
        activityName: "Applied",
        description: null,
        source: "manual",
        metadataJson: '{"jobId":"j1"}',
        startTime: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const res = await GET(req(), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events.map((e: { id: string }) => e.id)).toEqual([
      "ai_draft:d1",
      "email:t1",
      "activity:a1",
    ]);
    // Activity is scoped to the job via metadataJson contains.
    expect(activityFindMany.mock.calls[0][0].where).toMatchObject({
      userId: "u1",
      metadataJson: { contains: "j1" },
    });
  });

  it("honors the cursor across pages", async () => {
    const mkThreads = Array.from({ length: 3 }).map((_, i) => ({
      id: `t${i}`,
      label: "Applied",
      confidence: 0.8,
      subject: `s${i}`,
      snippet: "x",
      fromAddress: "a@b.com",
      receivedAt: new Date(2026, 0, i + 1).toISOString(),
    }));
    threadFindMany.mockResolvedValue(mkThreads);

    const first = await GET(req("http://localhost:3737/api/jobs/j1/timeline?limit=2"), ctx());
    const firstBody = await first.json();
    expect(firstBody.events).toHaveLength(2);
    expect(firstBody.hasMore).toBe(true);
    expect(firstBody.nextCursor).toBeTruthy();

    const second = await GET(
      req(`http://localhost:3737/api/jobs/j1/timeline?limit=2&cursor=${encodeURIComponent(firstBody.nextCursor)}`),
      ctx(),
    );
    const secondBody = await second.json();
    expect(secondBody.events).toHaveLength(1);
    expect(secondBody.hasMore).toBe(false);
  });
});
