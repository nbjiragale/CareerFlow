// CAREERFLOW: "Update from your inbox" card. CareerFlow already classifies your
// recruiter emails — this closes the loop by suggesting the matching status
// change for the linked application. Confirm-first: nothing moves until you
// click Apply. Dismiss stops the nudge for good.
"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Inbox, Loader2, X } from "lucide-react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { toast } from "../ui/use-toast";
import type { StatusSuggestion } from "@/lib/gmail/status-suggestions/rules";

export default function StatusSuggestions({
  items,
}: {
  items: StatusSuggestion[];
}) {
  const [list, setList] = useState<StatusSuggestion[]>(items);
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (list.length === 0) return null;

  const remove = (threadId: string) =>
    setList((prev) => prev.filter((s) => s.threadId !== threadId));

  const act = async (
    suggestion: StatusSuggestion,
    action: "apply" | "dismiss",
  ) => {
    setPendingId(suggestion.threadId);
    try {
      const res = await fetch("/api/status-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: suggestion.threadId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't update",
          description: data.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      remove(suggestion.threadId);
      if (action === "apply") {
        if (data.ok) {
          toast({
            variant: "success",
            title: `Moved to ${suggestion.suggestedStatusLabel}`,
            description: `${suggestion.role}${
              suggestion.company ? ` · ${suggestion.company}` : ""
            }`,
          });
        } else {
          // Stale (status already changed elsewhere) — removed quietly.
          toast({
            title: "Already up to date",
            description: "That application's status had already changed.",
          });
        }
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't update",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Inbox className="h-4 w-4" />
          Update from your inbox
          <Badge variant="secondary" className="font-normal">
            {list.length}
          </Badge>
        </h2>
        <span className="text-xs text-muted-foreground">
          Detected from your recruiter emails
        </span>
      </div>

      <ul className="flex flex-col divide-y divide-border">
        {list.map((s) => {
          const busy = pendingId === s.threadId;
          const isRejection = s.suggestedStatusValue === "rejected";
          return (
            <li
              key={s.threadId}
              className="flex flex-wrap items-center justify-between gap-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/dashboard/myjobs/${s.jobId}`}
                  className="truncate text-sm font-medium hover:underline"
                >
                  {s.role}
                </Link>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {s.company ? <span className="truncate">{s.company}</span> : null}
                  <span className="flex items-center gap-1">
                    <Badge variant="outline" className="font-normal">
                      {s.currentStatusLabel}
                    </Badge>
                    <ArrowRight className="h-3 w-3" />
                    <Badge
                      variant={isRejection ? "destructive" : "default"}
                      className="font-normal"
                    >
                      {s.suggestedStatusLabel}
                    </Badge>
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground/80">
                  {s.emailSubject}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => act(s, "apply")}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Apply
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5"
                  onClick={() => act(s, "dismiss")}
                  disabled={busy}
                >
                  <X className="h-3.5 w-3.5" />
                  Dismiss
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
