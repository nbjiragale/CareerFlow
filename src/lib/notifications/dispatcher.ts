// CAREERFLOW: Phase 3 — reminder dispatcher. Run every minute by the scheduler
// (src/lib/scheduler/index.ts). Selects Tasks whose remindAt has elapsed and
// that haven't fired yet, fans out to the configured channels, then stamps
// remindedAt so the same reminder never double-fires.

import "server-only";

import db from "@/lib/db";
import { SCHEDULER_CONSTANTS } from "@/lib/constants";
import type { TaskReminderPayload } from "@/lib/email/templates/task-reminder";
import { dispatchBrowserReminder } from "./transports/browser";
import { dispatchEmailReminder } from "./transports/email";

// Tasks in a terminal state never get a reminder fired.
const TERMINAL_STATUSES = ["complete", "cancelled"];
const VALID_CHANNELS = ["browser", "email"] as const;
type Channel = (typeof VALID_CHANNELS)[number];

export interface ReminderDispatchSummary {
  attempted: number;
  browser: number;
  email: number;
  skipped: number;
  failed: number;
}

function parseChannels(raw: string): Channel[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return ["browser"];
    const filtered = parsed.filter(
      (c): c is Channel => typeof c === "string" && (VALID_CHANNELS as readonly string[]).includes(c),
    );
    return filtered.length > 0 ? filtered : ["browser"];
  } catch {
    return ["browser"];
  }
}

export async function runDueReminders(
  now: Date = new Date(),
): Promise<ReminderDispatchSummary> {
  const summary: ReminderDispatchSummary = {
    attempted: 0,
    browser: 0,
    email: 0,
    skipped: 0,
    failed: 0,
  };

  const dueTasks = await db.task.findMany({
    where: {
      remindAt: { lte: now },
      remindedAt: null,
      status: { notIn: TERMINAL_STATUSES },
    },
    orderBy: { remindAt: "asc" },
    take: SCHEDULER_CONSTANTS.MAX_REMINDERS_PER_TICK,
    include: { user: { select: { email: true } } },
  });

  for (const task of dueTasks) {
    summary.attempted++;
    const channels = parseChannels(task.remindChannels);
    const payload: TaskReminderPayload = {
      taskTitle: task.title,
      taskDescription: task.description,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      remindAt: task.remindAt ? task.remindAt.toISOString() : null,
      link: "/dashboard/tasks",
    };

    try {
      if (channels.includes("browser")) {
        await dispatchBrowserReminder({
          userId: task.userId,
          taskId: task.id,
          payloadJson: JSON.stringify(payload),
        });
        summary.browser++;
      }

      if (channels.includes("email")) {
        const result = await dispatchEmailReminder({
          userId: task.userId,
          taskId: task.id,
          to: task.user?.email ?? null,
          payload,
        });
        if (result.status === "sent") summary.email++;
        else if (result.status === "skipped") summary.skipped++;
        else summary.failed++;
      }

      await db.task.update({
        where: { id: task.id },
        data: { remindedAt: now },
      });
    } catch (err) {
      summary.failed++;
      console.error(
        `[Reminders] Failed dispatch for task ${task.id}:`,
        err instanceof Error ? err.message : err,
      );
      // Stamp remindedAt regardless so a persistently failing task doesn't
      // re-fire on every tick. The Reminder/EmailLog rows record the failure.
      try {
        await db.task.update({
          where: { id: task.id },
          data: { remindedAt: now },
        });
      } catch {
        // best-effort; next tick will retry the stamp
      }
    }
  }

  console.log(
    `[Reminders] tick: attempted=${summary.attempted} browser=${summary.browser} email=${summary.email} skipped=${summary.skipped} failed=${summary.failed}`,
  );

  return summary;
}
