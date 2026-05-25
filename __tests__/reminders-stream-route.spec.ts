// CAREERFLOW: Phase 3 — tests for GET /api/reminders/stream and its helpers.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/db", () => {
  const mockPrisma = {
    reminder: { findMany: vi.fn(), updateMany: vi.fn() },
  };
  return { default: mockPrisma };
});

import { GET } from "@/app/api/reminders/stream/route";
import {
  drainPendingBrowserReminders,
  formatSseEvent,
} from "@/lib/notifications/stream";
import { auth } from "@/auth";
import prisma from "@/lib/db";

const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const findMany = prisma.reminder.findMany as unknown as ReturnType<typeof vi.fn>;
const updateMany = prisma.reminder.updateMany as unknown as ReturnType<typeof vi.fn>;

describe("formatSseEvent", () => {
  it("emits a well-formed SSE frame", () => {
    const frame = formatSseEvent("reminder", { id: "r1" });
    expect(frame).toBe('event: reminder\ndata: {"id":"r1"}\n\n');
  });
});

describe("drainPendingBrowserReminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns [] and marks nothing when there are no pending reminders", async () => {
    findMany.mockResolvedValue([]);
    const result = await drainPendingBrowserReminders("u1");
    expect(result).toEqual([]);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("marks pending browser reminders sent and parses the payload", async () => {
    findMany.mockResolvedValue([
      { id: "r1", taskId: "t1", payloadJson: '{"taskTitle":"Ping"}' },
      { id: "r2", taskId: "t2", payloadJson: "broken" },
    ]);
    updateMany.mockResolvedValue({ count: 2 });

    const result = await drainPendingBrowserReminders("u1");

    expect(findMany.mock.calls[0][0].where).toMatchObject({
      userId: "u1",
      channel: "browser",
      status: "pending",
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["r1", "r2"] } },
      data: { status: "sent", sentAt: expect.any(Date) },
    });
    expect(result).toEqual([
      { id: "r1", taskId: "t1", payload: { taskTitle: "Ping" } },
      { id: "r2", taskId: "t2", payload: {} },
    ]);
  });
});

describe("GET /api/reminders/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns a text/event-stream response when authenticated", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    findMany.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    // release the stream so its timers are cleared
    await res.body?.cancel();
  });
});
