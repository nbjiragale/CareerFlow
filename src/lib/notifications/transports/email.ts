// CAREERFLOW: Phase 3 — email notification transport. nodemailer is an
// OPTIONAL dependency: self-hosters who don't set SMTP_HOST never need it
// installed, and the module is loaded lazily (and only when configured) so a
// missing package never breaks startup or the default build.
//
// The actual SMTP send is injected as `MailSender`, which keeps this unit
// testable without installing nodemailer — tests pass a fake sender.

import "server-only";

import db from "@/lib/db";
import {
  renderTaskReminderEmail,
  type TaskReminderPayload,
} from "@/lib/email/templates/task-reminder";

export interface MailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type MailSender = (message: MailMessage) => Promise<void>;

export interface EmailDispatchInput {
  userId: string;
  taskId: string;
  to: string | null | undefined;
  payload: TaskReminderPayload;
}

export type EmailDispatchStatus = "sent" | "failed" | "skipped";

export interface EmailDispatchResult {
  channel: "email";
  status: EmailDispatchStatus;
  error?: string;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

// Default sender: lazily imports nodemailer at call time. The specifier is a
// runtime variable so neither TypeScript nor the bundler statically resolves
// the optional (uninstalled-by-default) dependency; webpack emits a benign
// "Critical dependency" warning. Never invoked in tests (a fake sender is
// injected), so nodemailer is never required in CI.
export const defaultSmtpSender: MailSender = async (message) => {
  const moduleName = "nodemailer";
  const nodemailer = (await import(/* @vite-ignore */ moduleName)) as unknown as {
    createTransport: (opts: Record<string, unknown>) => {
      sendMail: (msg: MailMessage) => Promise<unknown>;
    };
  };

  const port = Number.parseInt(process.env.SMTP_PORT ?? "587", 10);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number.isFinite(port) ? port : 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" }
      : undefined,
  });

  await transporter.sendMail(message);
};

export async function dispatchEmailReminder(
  input: EmailDispatchInput,
  sender: MailSender = defaultSmtpSender,
): Promise<EmailDispatchResult> {
  if (!isEmailConfigured() || !input.to) {
    return { channel: "email", status: "skipped" };
  }

  const { subject, text, html } = renderTaskReminderEmail(input.payload);
  const message: MailMessage = {
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "careerflow@localhost",
    to: input.to,
    subject,
    text,
    html,
  };

  try {
    await sender(message);
    await db.reminder.create({
      data: {
        userId: input.userId,
        taskId: input.taskId,
        channel: "email",
        payloadJson: JSON.stringify(input.payload),
        status: "sent",
        sentAt: new Date(),
      },
    });
    await db.emailLog.create({
      data: {
        userId: input.userId,
        toAddress: input.to,
        subject,
        template: "task-reminder",
        status: "sent",
      },
    });
    return { channel: "email", status: "sent" };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await db.reminder.create({
      data: {
        userId: input.userId,
        taskId: input.taskId,
        channel: "email",
        payloadJson: JSON.stringify(input.payload),
        status: "failed",
        errorMessage: error,
      },
    });
    await db.emailLog.create({
      data: {
        userId: input.userId,
        toAddress: input.to,
        subject,
        template: "task-reminder",
        status: "failed",
        errorMessage: error,
      },
    });
    return { channel: "email", status: "failed", error };
  }
}
