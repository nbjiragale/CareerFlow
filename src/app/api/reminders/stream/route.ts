// CAREERFLOW: Phase 3 — GET /api/reminders/stream. Server-Sent Events endpoint
// the dashboard subscribes to. Drains pending "browser" Reminder rows for the
// current user, marks them sent, and pushes them down the stream. A heartbeat
// keeps the connection alive; the client closes/reconnects on idle.

import "server-only";

import { auth } from "@/auth";
import {
  drainPendingBrowserReminders,
  formatSseEvent,
} from "@/lib/notifications/stream";

const HEARTBEAT_MS = 30_000;
const POLL_MS = 5_000;

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let beatTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const flush = async () => {
        if (closed) return;
        try {
          const reminders = await drainPendingBrowserReminders(userId);
          for (const reminder of reminders) {
            controller.enqueue(encoder.encode(formatSseEvent("reminder", reminder)));
          }
        } catch {
          // keep the stream alive; the next poll retries
        }
      };

      controller.enqueue(encoder.encode(formatSseEvent("ready", { ts: Date.now() })));
      await flush();

      // The consumer may have cancelled while the first flush awaited; don't
      // start timers we'd then leak.
      if (closed) return;

      pollTimer = setInterval(flush, POLL_MS);
      beatTimer = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, HEARTBEAT_MS);
    },
    cancel() {
      closed = true;
      if (pollTimer) clearInterval(pollTimer);
      if (beatTimer) clearInterval(beatTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
