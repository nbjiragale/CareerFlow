// CAREERFLOW: Phase 3 — subscribes to the reminder SSE stream and fires a
// native browser Notification when permission is granted, otherwise hands the
// reminder to a fallback (an in-app toast). Safe on the server (no-op) and
// degrades gracefully when EventSource / Notification are unavailable.
"use client";

import { useEffect, useRef, useState } from "react";

export interface ReminderPayload {
  taskTitle?: string;
  taskDescription?: string | null;
  link?: string | null;
}

export interface StreamedReminder {
  id: string;
  taskId: string;
  payload: ReminderPayload;
}

type PermissionState = NotificationPermission | "unsupported";

function currentPermission(): PermissionState {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }
  return Notification.permission;
}

export function useReminderStream(options?: {
  enabled?: boolean;
  // Fires for every reminder received, regardless of how it's surfaced
  // (native notification vs. in-app fallback). Use for badge counts etc.
  onReminder?: (reminder: StreamedReminder) => void;
  onFallback?: (reminder: StreamedReminder) => void;
}) {
  const enabled = options?.enabled ?? true;
  const onReminderRef = useRef(options?.onReminder);
  onReminderRef.current = options?.onReminder;
  const onFallbackRef = useRef(options?.onFallback);
  onFallbackRef.current = options?.onFallback;

  const [permission, setPermission] = useState<PermissionState>("unsupported");

  useEffect(() => {
    setPermission(currentPermission());
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return;
    }

    const source = new EventSource("/api/reminders/stream");

    const handleReminder = (event: MessageEvent) => {
      let reminder: StreamedReminder;
      try {
        reminder = JSON.parse(event.data) as StreamedReminder;
      } catch {
        return;
      }

      onReminderRef.current?.(reminder);

      const title = reminder.payload?.taskTitle ?? "CareerFlow reminder";
      const body = reminder.payload?.taskDescription ?? undefined;

      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification(title, { body: body ?? undefined });
          return;
        } catch {
          // fall through to the in-app fallback
        }
      }
      onFallbackRef.current?.(reminder);
    };

    source.addEventListener("reminder", handleReminder as EventListener);

    return () => {
      source.removeEventListener("reminder", handleReminder as EventListener);
      source.close();
    };
  }, [enabled]);

  const requestPermission = async (): Promise<PermissionState> => {
    if (typeof Notification === "undefined") return "unsupported";
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  };

  return { permission, requestPermission };
}
