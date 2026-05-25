// CAREERFLOW: Phase 3 — helpers for the reminder SSE endpoint. Kept out of the
// route file because Next.js route modules may only export request handlers
// (GET/POST/…) and a fixed set of config fields.

import "server-only";

import db from "@/lib/db";

const DRAIN_BATCH = 50;

export interface StreamedReminder {
  id: string;
  taskId: string;
  payload: unknown;
}

// Atomically collect pending browser reminders and mark them sent so a
// reconnecting client never receives the same reminder twice.
export async function drainPendingBrowserReminders(
  userId: string,
): Promise<StreamedReminder[]> {
  const pending = await db.reminder.findMany({
    where: { userId, channel: "browser", status: "pending" },
    orderBy: { createdAt: "asc" },
    take: DRAIN_BATCH,
  });

  if (pending.length === 0) return [];

  await db.reminder.updateMany({
    where: { id: { in: pending.map((r) => r.id) } },
    data: { status: "sent", sentAt: new Date() },
  });

  return pending.map((r) => {
    let payload: unknown = {};
    try {
      payload = JSON.parse(r.payloadJson);
    } catch {
      payload = {};
    }
    return { id: r.id, taskId: r.taskId, payload };
  });
}

export function formatSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
