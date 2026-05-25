// CAREERFLOW: Phase 3 — a single row in the unified job timeline.
"use client";

import { format } from "date-fns";
import { Activity, Mail, Sparkles, type LucideIcon } from "lucide-react";

import { Badge } from "../ui/badge";
import type { TimelineEvent, TimelineEventSource } from "@/lib/timeline/aggregate";

const SOURCE_META: Record<
  TimelineEventSource,
  { icon: LucideIcon; label: string }
> = {
  email: { icon: Mail, label: "Email" },
  ai_draft: { icon: Sparkles, label: "AI draft" },
  activity: { icon: Activity, label: "Activity" },
};

function safeFormat(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : format(date, "PPp");
}

export default function TimelineEventRow({ event }: { event: TimelineEvent }) {
  const meta = SOURCE_META[event.source];
  const Icon = meta.icon;

  return (
    <li className="relative flex gap-3 pb-6 last:pb-0">
      <div className="flex flex-col items-center">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </span>
        <span className="mt-1 w-px flex-1 bg-border last:hidden" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="capitalize">
            {meta.label}
          </Badge>
          {event.kind && (
            <Badge variant="secondary" className="capitalize">
              {event.kind.replace(/_/g, " ")}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {safeFormat(event.occurredAt)}
          </span>
        </div>
        <p className="mt-1 truncate font-medium">{event.title}</p>
        {event.description && (
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
            {event.description}
          </p>
        )}
      </div>
    </li>
  );
}
