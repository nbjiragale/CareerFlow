// CAREERFLOW: Phase 3 — tests for the email reminder transport. A fake
// MailSender is injected so nodemailer never needs to be installed in CI.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => {
  const mockPrisma = {
    reminder: { create: vi.fn() },
    emailLog: { create: vi.fn() },
  };
  return { default: mockPrisma };
});

import {
  dispatchEmailReminder,
  isEmailConfigured,
  type MailMessage,
} from "@/lib/notifications/transports/email";
import prisma from "@/lib/db";

const reminderCreate = prisma.reminder.create as unknown as ReturnType<typeof vi.fn>;
const emailLogCreate = prisma.emailLog.create as unknown as ReturnType<typeof vi.fn>;

const payload = {
  taskTitle: "Send thank-you note",
  taskDescription: "to the hiring manager",
  dueDate: "2026-02-01T00:00:00.000Z",
  link: "/dashboard/tasks",
};

const originalHost = process.env.SMTP_HOST;

describe("dispatchEmailReminder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reminderCreate.mockResolvedValue({});
    emailLogCreate.mockResolvedValue({});
  });

  afterEach(() => {
    if (originalHost === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = originalHost;
  });

  it("is a no-op when SMTP_HOST is unset", async () => {
    delete process.env.SMTP_HOST;
    const sender = vi.fn();
    const result = await dispatchEmailReminder(
      { userId: "u1", taskId: "t1", to: "user@example.com", payload },
      sender,
    );
    expect(result.status).toBe("skipped");
    expect(sender).not.toHaveBeenCalled();
    expect(reminderCreate).not.toHaveBeenCalled();
    expect(emailLogCreate).not.toHaveBeenCalled();
  });

  it("is a no-op when the recipient is missing", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    const sender = vi.fn();
    const result = await dispatchEmailReminder(
      { userId: "u1", taskId: "t1", to: null, payload },
      sender,
    );
    expect(result.status).toBe("skipped");
    expect(sender).not.toHaveBeenCalled();
  });

  it("sends and writes a sent Reminder + EmailLog when configured", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    let captured: MailMessage | null = null;
    const sender = vi.fn(async (m: MailMessage) => {
      captured = m;
    });

    const result = await dispatchEmailReminder(
      { userId: "u1", taskId: "t1", to: "user@example.com", payload },
      sender,
    );

    expect(result.status).toBe("sent");
    expect(sender).toHaveBeenCalledTimes(1);
    expect(captured!.to).toBe("user@example.com");
    expect(captured!.subject).toContain("Send thank-you note");
    expect(reminderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ channel: "email", status: "sent" }),
      }),
    );
    expect(emailLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          template: "task-reminder",
          status: "sent",
          toAddress: "user@example.com",
        }),
      }),
    );
  });

  it("records failure on a sender error", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    const sender = vi.fn(async () => {
      throw new Error("connection refused");
    });

    const result = await dispatchEmailReminder(
      { userId: "u1", taskId: "t1", to: "user@example.com", payload },
      sender,
    );

    expect(result.status).toBe("failed");
    expect(result.error).toContain("connection refused");
    expect(reminderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed" }),
      }),
    );
    expect(emailLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed" }),
      }),
    );
  });

  it("isEmailConfigured reflects SMTP_HOST", () => {
    process.env.SMTP_HOST = "smtp.example.com";
    expect(isEmailConfigured()).toBe(true);
    delete process.env.SMTP_HOST;
    expect(isEmailConfigured()).toBe(false);
  });
});
