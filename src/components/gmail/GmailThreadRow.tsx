// CAREERFLOW: Phase 1 — single Gmail thread row with optional inline
// correction controls. Confidence + label badges plus a link to the
// associated Job when one was auto-linked or auto-created.
"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { toast } from "../ui/use-toast";
// CAREERFLOW: Phase 2 — AI reply-draft drawer.
import DraftReplyDrawer from "./DraftReplyDrawer";

export interface ThreadRow {
  id: string;
  gmailThreadId: string;
  subject: string;
  snippet: string;
  fromAddress: string;
  receivedAt: string;
  label: string;
  confidence: number;
  needsReview: boolean;
  extractedCompany: string | null;
  extractedRole: string | null;
  job: {
    id: string;
    title: string | null;
    company: string | null;
  } | null;
}

const LABEL_OPTIONS = [
  "Applied",
  "Interview",
  "NextPhase",
  "Offer",
  "Rejected",
  "NotJobRelated",
] as const;

const LABEL_COLORS: Record<string, string> = {
  Applied: "bg-blue-500/20 text-blue-700 border-blue-500/30",
  Interview: "bg-purple-500/20 text-purple-700 border-purple-500/30",
  NextPhase: "bg-indigo-500/20 text-indigo-700 border-indigo-500/30",
  Offer: "bg-emerald-500/20 text-emerald-700 border-emerald-500/30",
  Rejected: "bg-red-500/20 text-red-700 border-red-500/30",
  NotJobRelated: "bg-muted text-muted-foreground",
};

interface GmailThreadRowProps {
  thread: ThreadRow;
  allowCorrection?: boolean;
  onCorrected?: (updated: ThreadRow) => void;
}

function GmailThreadRow({
  thread,
  allowCorrection,
  onCorrected,
}: GmailThreadRowProps) {
  const [correcting, setCorrecting] = useState<string | null>(null);
  // CAREERFLOW: Phase 2 — draft reply drawer toggle.
  const [draftOpen, setDraftOpen] = useState(false);

  const submitCorrection = async (label: string) => {
    setCorrecting(label);
    try {
      const res = await fetch(
        `/api/gmail/threads/${thread.id}/correct`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Correction failed",
          description: data.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      toast({ variant: "success", title: "Thread reclassified" });
      onCorrected?.({
        ...thread,
        label: data.thread.label,
        needsReview: data.thread.needsReview,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Correction failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setCorrecting(null);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={LABEL_COLORS[thread.label] ?? LABEL_COLORS.NotJobRelated}
            >
              {thread.label}
            </Badge>
            <span className="text-xs tabular-nums text-muted-foreground">
              confidence {(thread.confidence * 100).toFixed(0)}%
            </span>
            {thread.needsReview && (
              <Badge variant="outline" className="border-amber-500/40 text-amber-700">
                Needs review
              </Badge>
            )}
          </div>
          <div className="font-medium truncate" title={thread.subject}>
            {thread.subject || "(no subject)"}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            From {thread.fromAddress}
            {thread.extractedCompany ? ` · ${thread.extractedCompany}` : ""}
            {thread.extractedRole ? ` · ${thread.extractedRole}` : ""}
          </div>
          {thread.snippet && (
            <div className="text-sm text-muted-foreground line-clamp-2">
              {thread.snippet}
            </div>
          )}
        </div>
        <div className="text-right text-xs text-muted-foreground flex flex-col gap-1 shrink-0">
          <div>{new Date(thread.receivedAt).toLocaleString()}</div>
          {thread.job && (
            <Link
              href={`/dashboard/myjobs/${thread.job.id}`}
              className="text-primary hover:underline"
            >
              {thread.job.title ?? "Open job"}
              {thread.job.company ? ` @ ${thread.job.company}` : ""}
            </Link>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {allowCorrection &&
          LABEL_OPTIONS.map((option) => (
            <Button
              key={option}
              variant={option === thread.label ? "default" : "outline"}
              size="sm"
              disabled={Boolean(correcting)}
              onClick={() => submitCorrection(option)}
            >
              {correcting === option ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : null}
              {option}
            </Button>
          ))}
        {/* CAREERFLOW: Phase 2 — AI reply-draft button (always available). */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDraftOpen(true)}
        >
          <Sparkles className="mr-1 h-3 w-3" />
          Draft reply
        </Button>
      </div>

      <DraftReplyDrawer
        open={draftOpen}
        onOpenChange={setDraftOpen}
        emailThreadId={thread.id}
        fromAddress={thread.fromAddress}
        subject={thread.subject}
      />
    </div>
  );
}

export default GmailThreadRow;
