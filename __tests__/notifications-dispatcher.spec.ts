// CAREERFLOW: Phase 3 — tests for the reminder dispatcher.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  const mockPrisma = {
    task: { findMany: vi.fn(), update: vi.fn() },
  };
  return { default: mockPrisma };
});

vi.mock("@/lib/notifications/transports/browser", () => ({
  dispatchBrowserReminder: vi.fn(),
}));

vi.mock("@/lib/notifications/transports/email", () => ({
  dispatchEmailReminder: vi.fn(),
}));

import { runDueReminders } from "@/lib/notifications/dispatcher";
import prisma from "@/lib/db";
import { dispatchBrowserReminder } from "@/lib/notifications/transports/browser";
import { dispatchEmailReminder } from "@/lib/notifications/transports/email";

const findMany = prisma.task.findMany as unknown as ReturnType<typeof vi.fn>;
const update = prisma.task.update as unknown as ReturnType<typeof vi.fn>;
const browser = dispatchBrowserReminder as unknown as ReturnType<typeof vi.fn>;
const email = dispatchEmailReminder as unknown as ReturnType<typeof vi.fn>;

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    userId: "u1",
    title: "Follow up with recruiter",
    description: "ping them",
    status: "in-progress",
    dueDate: new Date("2026-02-01T00:00:00.000Z"),
    remindAt: new Date("2026-01-31T09:00:00.000Z"),
    remindChannels: JSON.stringify(["browser"]),
    user: { email: "user@example.com" },
    ...overrides,
  };
}

describe("runDueReminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browser.mockResolvedValue({ channel: "browser", status: "pending", reminderId: "r1" });
    email.mockResolvedValue({ channel: "email", status: "sent" });
    update.mockResolvedValue({});
  });

  it("queries only due, unsent, non-terminal tasks", async () => {
    findMany.mockResolvedValue([]);
    const now = new Date("2026-01-31T10:00:00.000Z");
    await runDueReminders(now);

    expect(findMany).toHaveBeenCalledTimes(1);
    const arg = findMany.mock.calls[0][0];
    expect(arg.where.remindAt).toEqual({ lte: now });
    expect(arg.where.remindedAt).toBeNull();
    expect(arg.where.status).toEqual({ notIn: ["complete", "cancelled"] });
  });

  it("dispatches to the browser channel and stamps remindedAt", async () => {
    findMany.mockResolvedValue([task()]);
    const now = new Date("2026-01-31T10:00:00.000Z");
    const summary = await runDueReminders(now);

    expect(browser).toHaveBeenCalledTimes(1);
    expect(email).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { remindedAt: now },
    });
    expect(summary).toMatchObject({ attempted: 1, browser: 1, email: 0, failed: 0 });
  });

  it("dispatches to both channels when configured", async () => {
    findMany.mockResolvedValue([task({ remindChannels: JSON.stringify(["browser", "email"]) })]);
    const summary = await runDueReminders(new Date());

    expect(browser).toHaveBeenCalledTimes(1);
    expect(email).toHaveBeenCalledTimes(1);
    expect(email.mock.calls[0][0]).toMatchObject({ to: "user@example.com" });
    expect(summary.browser).toBe(1);
    expect(summary.email).toBe(1);
  });

  it("counts a skipped email (no SMTP) without failing", async () => {
    email.mockResolvedValue({ channel: "email", status: "skipped" });
    findMany.mockResolvedValue([task({ remindChannels: JSON.stringify(["email"]) })]);
    const summary = await runDueReminders(new Date());

    expect(summary.skipped).toBe(1);
    expect(summary.email).toBe(0);
    expect(summary.failed).toBe(0);
  });

  it("falls back to the browser channel when remindChannels is malformed", async () => {
    findMany.mockResolvedValue([task({ remindChannels: "garbage" })]);
    await runDueReminders(new Date());
    expect(browser).toHaveBeenCalledTimes(1);
  });

  it("stamps remindedAt even when a transport throws (no re-fire)", async () => {
    browser.mockRejectedValue(new Error("db down"));
    findMany.mockResolvedValue([task()]);
    const now = new Date("2026-01-31T10:00:00.000Z");
    const summary = await runDueReminders(now);

    expect(summary.failed).toBe(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { remindedAt: now },
    });
  });
});
