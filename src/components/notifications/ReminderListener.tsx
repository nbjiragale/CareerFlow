// CAREERFLOW: Phase 3 — mounts the reminder SSE subscription app-wide (from the
// dashboard layout). Renders nothing; it just wires the stream to native
// notifications, falling back to an in-app toast when permission isn't granted.
"use client";

import { useReminderStream } from "@/hooks/useReminderStream";
import { toast } from "../ui/use-toast";

export default function ReminderListener() {
  useReminderStream({
    onFallback: (reminder) => {
      toast({
        title: reminder.payload?.taskTitle ?? "Reminder",
        description: reminder.payload?.taskDescription ?? undefined,
      });
    },
  });

  return null;
}
