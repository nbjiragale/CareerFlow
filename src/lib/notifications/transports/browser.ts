// CAREERFLOW: Phase 3 — browser notification transport. Writes a pending
// Reminder row; the dashboard SSE stream (src/app/api/reminders/stream)
// drains pending rows, marks them sent, and fires the Notification API
// (or an in-app toast when permission is denied).

import "server-only";

import db from "@/lib/db";

export interface BrowserDispatchInput {
  userId: string;
  taskId: string;
  payloadJson: string;
}

export interface BrowserDispatchResult {
  channel: "browser";
  status: "pending";
  reminderId: string;
}

export async function dispatchBrowserReminder(
  input: BrowserDispatchInput,
): Promise<BrowserDispatchResult> {
  const reminder = await db.reminder.create({
    data: {
      userId: input.userId,
      taskId: input.taskId,
      channel: "browser",
      payloadJson: input.payloadJson,
      status: "pending",
    },
  });

  return { channel: "browser", status: "pending", reminderId: reminder.id };
}
