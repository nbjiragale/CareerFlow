// CAREERFLOW: proactive follow-up nudge on the dashboard. Lists applications
// that are overdue for a follow-up (computed server-side) and, on one click,
// generates a ready-to-send follow-up email — copy or open in the mail client.
// Draft-only by design (PRD §9.5): never sends.
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  MailPlus,
  Send,
} from "lucide-react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Label } from "../ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { toast } from "../ui/use-toast";
import {
  AiProgressStatus,
  useAiProgressPhase,
} from "../common/AiProgressStatus";
import type { AiReplyDraftResponse } from "@/models/ai.schemas";

const FOLLOW_UP_PHASES = [
  "Reading the application context…",
  "Pulling job + resume context…",
  "Drafting the follow-up…",
  "Humanizing the tone…",
  "Almost there…",
];

export interface FollowUpItem {
  id: string;
  company: string;
  role: string;
  daysSince: number;
}

export default function FollowUpsDue({ items }: { items: FollowUpItem[] }) {
  const [drafted, setDrafted] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<FollowUpItem | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(
    null,
  );
  const [draft, setDraft] = useState<AiReplyDraftResponse | null>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");

  const [phaseIndex, setPhaseIndex] = useAiProgressPhase(
    generating,
    FOLLOW_UP_PHASES.length,
  );

  if (!items || items.length === 0) return null;

  const generate = async (item: FollowUpItem) => {
    setActive(item);
    setOpen(true);
    setGenerating(true);
    setPhaseIndex(0);
    setGenerationStartedAt(Date.now());
    setDraft(null);
    setEditedSubject("");
    setEditedBody("");
    try {
      const res = await fetch("/api/drafts/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: item.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "structured_output_unsupported") {
          toast({
            variant: "destructive",
            title: "This model can't return structured output",
            description:
              "Switch to a stronger model in Settings → AI Provider and try again.",
          });
          return;
        }
        toast({
          variant: "destructive",
          title: "Follow-up draft failed",
          description: data.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      setDraft(data.draft);
      setEditedSubject(data.draft.subject ?? `Following up — ${item.role}`);
      setEditedBody(data.draft.body);
      setDrafted((prev) => new Set(prev).add(item.id));
      if (data.warning) toast({ title: "Heads up", description: data.warning });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Follow-up draft failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setGenerating(false);
    }
  };

  const onCopy = async () => {
    if (!editedBody) return;
    try {
      await navigator.clipboard.writeText(editedBody);
      toast({ variant: "success", title: "Copied to clipboard" });
    } catch {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Your browser blocked clipboard access.",
      });
    }
  };

  const mailtoHref = () => {
    const params = new URLSearchParams();
    params.set("subject", editedSubject || "Following up");
    params.set("body", editedBody);
    return `mailto:?${params.toString()}`;
  };

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Send className="h-4 w-4" />
          Follow-ups due
          <Badge variant="secondary" className="font-normal">
            {items.length}
          </Badge>
        </h2>
        <span className="text-xs text-muted-foreground">
          Applied 7+ days ago, no response
        </span>
      </div>

      <ul className="flex flex-col divide-y divide-border">
        {items.map((item) => {
          const done = drafted.has(item.id);
          return (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 py-2"
            >
              <div className="min-w-0">
                <Link
                  href={`/dashboard/myjobs/${item.id}`}
                  className="truncate text-sm font-medium hover:underline"
                >
                  {item.role}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {[item.company, `applied ${item.daysSince} days ago`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Button
                size="sm"
                variant={done ? "ghost" : "outline"}
                className="h-8 shrink-0 gap-1.5"
                onClick={() => generate(item)}
                disabled={generating}
              >
                {done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <MailPlus className="h-3.5 w-3.5" />
                )}
                {done ? "View draft" : "Draft follow-up"}
              </Button>
            </li>
          );
        })}
      </ul>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Follow-up draft</SheetTitle>
            <SheetDescription>
              {active
                ? `${active.role}${active.company ? ` · ${active.company}` : ""}`
                : null}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 flex flex-col gap-4">
            {generating && !draft && (
              <AiProgressStatus
                phases={FOLLOW_UP_PHASES}
                currentIndex={phaseIndex}
                startedAt={generationStartedAt}
              />
            )}

            {draft && (
              <div className="flex flex-col gap-3 rounded-md border p-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="fu-subject">Subject</Label>
                  <input
                    id="fu-subject"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editedSubject}
                    onChange={(e) => setEditedSubject(e.target.value)}
                    placeholder="(no subject)"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="fu-body">Body</Label>
                  <textarea
                    id="fu-body"
                    className="min-h-[260px] w-full rounded-md border border-input bg-background p-3 text-sm"
                    value={editedBody}
                    onChange={(e) => setEditedBody(e.target.value)}
                  />
                  <div className="text-xs text-muted-foreground">
                    Tone: <span className="font-medium">{draft.tone}</span> ·
                    Add the recipient and your signature before sending.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={onCopy} size="sm">
                    <Copy className="mr-2 h-4 w-4" /> Copy
                  </Button>
                  <a href={mailtoHref()}>
                    <Button size="sm" variant="outline">
                      <ExternalLink className="mr-2 h-4 w-4" /> Open in mail
                      client
                    </Button>
                  </a>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
