// CAREERFLOW: Phase 2 — Draft Reply drawer. Opens from a GmailThreadRow.
// Intent radio + Generate button + editable textarea + Copy / mailto buttons.
// Never sends — copy-only by design (PRD §9.5).
"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Circle,
  CircleDot,
  Copy,
  ExternalLink,
  Loader2,
  Sparkles,
} from "lucide-react";

import { Button } from "../ui/button";
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
  REPLY_DRAFT_INTENTS,
  type AiReplyDraftResponse,
  type ReplyDraftIntent,
} from "@/models/ai.schemas";

const INTENT_LABELS: Record<ReplyDraftIntent, string> = {
  reply: "Reply",
  "follow-up": "Follow-up",
  "thank-you": "Thank you",
  confirm: "Confirm",
  custom: "Custom",
};

const CUSTOM_PROMPT_MAX = 2_000;

const LOADING_PHASE_MS = 1_400;

const DEFAULT_LOADING_PHASES = [
  "Reading the email thread…",
  "Pulling job + resume context…",
  "Drafting the reply…",
  "Humanizing the tone…",
  "Polishing the wording…",
  "Almost there…",
];

const CUSTOM_LOADING_PHASES = [
  "Reading your instruction…",
  "Reading the email thread…",
  "Refining your note into an email…",
  "Humanizing the tone…",
  "Polishing the wording…",
  "Almost there…",
];

function getLoadingPhases(intent: ReplyDraftIntent): string[] {
  return intent === "custom" ? CUSTOM_LOADING_PHASES : DEFAULT_LOADING_PHASES;
}

interface GenerationStatusProps {
  phases: string[];
  currentIndex: number;
  startedAt: number | null;
}

function GenerationStatus({
  phases,
  currentIndex,
  startedAt,
}: GenerationStatusProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (startedAt === null) return;
    setElapsedMs(Date.now() - startedAt);
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 250);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const elapsedSeconds = (elapsedMs / 1000).toFixed(1);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 text-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="font-medium">{phases[currentIndex]}</span>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {elapsedSeconds}s
        </span>
      </div>
      <ol className="flex flex-col gap-1 text-xs text-muted-foreground">
        {phases.map((phase, idx) => {
          const status =
            idx < currentIndex
              ? "done"
              : idx === currentIndex
                ? "active"
                : "pending";
          const Icon =
            status === "done" ? Check : status === "active" ? CircleDot : Circle;
          return (
            <li
              key={phase}
              className={`flex items-center gap-2 ${
                status === "active"
                  ? "text-foreground"
                  : status === "done"
                    ? "opacity-60 line-through"
                    : "opacity-50"
              }`}
            >
              <Icon
                className={`h-3 w-3 flex-none ${
                  status === "active" ? "text-primary" : ""
                }`}
              />
              <span>{phase}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

interface DraftReplyDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emailThreadId: string;
  fromAddress: string;
  subject: string;
}

interface DraftRow {
  id: string;
  draftType: string;
  subject: string | null;
  content: string;
  tone: string | null;
  createdAt: string;
}

export default function DraftReplyDrawer({
  open,
  onOpenChange,
  emailThreadId,
  fromAddress,
  subject,
}: DraftReplyDrawerProps) {
  const [intent, setIntent] = useState<ReplyDraftIntent>("reply");
  const [customPrompt, setCustomPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(
    null,
  );
  const [draft, setDraft] = useState<AiReplyDraftResponse | null>(null);
  const [editedBody, setEditedBody] = useState("");
  const [editedSubject, setEditedSubject] = useState("");
  const [history, setHistory] = useState<DraftRow[]>([]);
  const [bodyWasAvailable, setBodyWasAvailable] = useState<boolean | null>(
    null,
  );

  const customPromptTrimmed = customPrompt.trim();
  const customMissing = intent === "custom" && customPromptTrimmed.length === 0;
  const loadingPhases = getLoadingPhases(intent);

  // Rotate the loading-phase label while the request is in flight, so the
  // drawer doesn't look frozen during long LLM round-trips. We stop on the
  // last phase rather than looping forever — once the model is "almost
  // there" we just keep that label until the response arrives.
  useEffect(() => {
    if (!generating) return;
    const id = window.setInterval(() => {
      setPhaseIndex((prev) =>
        prev < loadingPhases.length - 1 ? prev + 1 : prev,
      );
    }, LOADING_PHASE_MS);
    return () => window.clearInterval(id);
  }, [generating, loadingPhases.length]);

  // Load history when the drawer opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/drafts?emailThreadId=${encodeURIComponent(emailThreadId)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setHistory(data.drafts ?? []);
      } catch {
        // history is a nice-to-have; swallow.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, emailThreadId]);

  const onGenerate = async () => {
    if (customMissing) {
      toast({
        variant: "destructive",
        title: "Tell us what to say",
        description: "Type a short instruction so the AI can refine it.",
      });
      return;
    }
    setGenerating(true);
    setPhaseIndex(0);
    setGenerationStartedAt(Date.now());
    setDraft(null);
    try {
      const res = await fetch("/api/drafts/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailThreadId,
          intent,
          customPrompt: intent === "custom" ? customPromptTrimmed : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // CAREERFLOW: when the selected provider/model can't return
        // structured output, the server returns a 422 with
        // code="structured_output_unsupported". Surface a model-switch
        // hint rather than the raw SDK message.
        if (data.code === "structured_output_unsupported") {
          toast({
            variant: "destructive",
            title: "This model can't return structured output",
            description:
              "Switch to a stronger model in Settings → AI Provider (e.g. openai/gpt-4o-mini or anthropic/claude-3.5-sonnet) and try again.",
          });
          return;
        }
        toast({
          variant: "destructive",
          title: "Draft generation failed",
          description: data.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      setDraft(data.draft);
      setEditedBody(data.draft.body);
      setEditedSubject(data.draft.subject ?? "");
      setBodyWasAvailable(Boolean(data.bodyWasAvailable));
      // Optimistically prepend the new draft into the history list.
      setHistory((prev) => [
        {
          id: data.draftId,
          draftType: intent,
          subject: data.draft.subject ?? null,
          content: data.draft.body,
          tone: data.draft.tone ?? null,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Draft generation failed",
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
    if (editedSubject) params.set("subject", editedSubject);
    else params.set("subject", `Re: ${subject}`);
    params.set("body", editedBody);
    return `mailto:${encodeURIComponent(fromAddress)}?${params.toString()}`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Draft reply</SheetTitle>
          <SheetDescription>
            To: <span className="font-medium">{fromAddress}</span>
            <br />
            Re: {subject}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Intent</Label>
            <div className="flex flex-wrap gap-2">
              {REPLY_DRAFT_INTENTS.map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={intent === value ? "default" : "outline"}
                  onClick={() => setIntent(value)}
                  disabled={generating}
                >
                  {INTENT_LABELS[value]}
                </Button>
              ))}
            </div>
          </div>

          {intent === "custom" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="custom-prompt">What do you want to say?</Label>
              <textarea
                id="custom-prompt"
                className="min-h-[100px] w-full rounded-md border border-input bg-background p-3 text-sm"
                placeholder="e.g. Politely decline the on-site interview for now but ask if we can revisit in Q3."
                value={customPrompt}
                onChange={(e) =>
                  setCustomPrompt(e.target.value.slice(0, CUSTOM_PROMPT_MAX))
                }
                disabled={generating}
                maxLength={CUSTOM_PROMPT_MAX}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  The AI will refine your note into a polished email body.
                </span>
                <span>
                  {customPrompt.length}/{CUSTOM_PROMPT_MAX}
                </span>
              </div>
            </div>
          )}

          <Button
            onClick={onGenerate}
            disabled={generating || customMissing}
            aria-busy={generating}
          >
            {generating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {generating ? "Generating…" : "Generate draft"}
          </Button>

          {generating && (
            <GenerationStatus
              phases={loadingPhases}
              currentIndex={Math.min(phaseIndex, loadingPhases.length - 1)}
              startedAt={generationStartedAt}
            />
          )}

          {draft && (
            <div className="flex flex-col gap-3 rounded-md border p-3">
              {bodyWasAvailable === false && (
                <div className="rounded-md border border-yellow-500/40 bg-yellow-500/5 p-2 text-xs">
                  Drafted without the email body. Reconnect Gmail in Settings
                  for higher-fidelity replies.
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="draft-subject">Subject</Label>
                <input
                  id="draft-subject"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  placeholder="(no subject)"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="draft-body">Body</Label>
                <textarea
                  id="draft-body"
                  className="min-h-[260px] w-full rounded-md border border-input bg-background p-3 text-sm"
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                />
                <div className="text-xs text-muted-foreground">
                  Tone: <span className="font-medium">{draft.tone}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={onCopy} size="sm">
                  <Copy className="mr-2 h-4 w-4" /> Copy
                </Button>
                <a href={mailtoHref()}>
                  <Button size="sm" variant="outline">
                    <ExternalLink className="mr-2 h-4 w-4" /> Open in mail client
                  </Button>
                </a>
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>History</Label>
              <div className="flex flex-col gap-1.5">
                {history.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="flex flex-col gap-0.5 rounded-md border p-2 text-left text-xs hover:bg-muted/50"
                    onClick={() => {
                      setEditedBody(row.content);
                      setEditedSubject(row.subject ?? "");
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {INTENT_LABELS[row.draftType as ReplyDraftIntent] ??
                          row.draftType}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(row.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="line-clamp-2 text-muted-foreground">
                      {row.content}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
