// CAREERFLOW: Phase 3 — single app-wide reminder SSE subscription, shared via
// context. The reminder stream drains+marks rows server-side, so it must be
// subscribed exactly once (a second EventSource would steal reminders). This
// provider owns that one subscription: it surfaces each reminder as a native
// notification or toast fallback (the old ReminderListener job) AND tracks an
// unread count the Topbar bell badges off of.
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

import { useReminderStream } from "@/hooks/useReminderStream";
import { toast } from "@/components/ui/use-toast";

interface ReminderContextValue {
  unreadCount: number;
  clearUnread: () => void;
}

const ReminderContext = createContext<ReminderContextValue>({
  unreadCount: 0,
  clearUnread: () => {},
});

export function useReminders(): ReminderContextValue {
  return useContext(ReminderContext);
}

export function ReminderProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useReminderStream({
    onReminder: () => setUnreadCount((count) => count + 1),
    onFallback: (reminder) => {
      toast({
        title: reminder.payload?.taskTitle ?? "Reminder",
        description: reminder.payload?.taskDescription ?? undefined,
      });
    },
  });

  const clearUnread = useCallback(() => setUnreadCount(0), []);

  return (
    <ReminderContext.Provider value={{ unreadCount, clearUnread }}>
      {children}
    </ReminderContext.Provider>
  );
}
