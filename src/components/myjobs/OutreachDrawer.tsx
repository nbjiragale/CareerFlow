// CAREERFLOW: Recruiter / LinkedIn outreach drawer. Opens from the job detail
// action bar. Intent buttons + optional recipient fields + Generate + editable
// message + Copy / Open LinkedIn / mailto. Never sends — copy-only by design
// (PRD §9.5).
"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink, Linkedin, Loader2, Sparkles } from "lucide-react";

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
  AiProgressStatus,
  useAiProgressPhase,
} from "../common/AiProgressStatus";
import {
  OUTREACH_INTENTS,
  type AiReplyDraftResponse,
  type OutreachIntent,
} from "@/models/ai.schemas";

const INTENT_LABELS: Record<OutreachIntent, string> = {
  connection: "Connection request",
  inmail: "InMail",
  referral: "Referral ask",
  "follow-up": "Follow-up",
};

const OUTREACH_PHASES = [
  "Reading the job context…",
  "Pulling your resume highlights…",
  "Drafting the message…",
  "Humanizing the tone…",
  "Polishing the wording…",
  "Almost there…",
];

// LinkedIn connection-request notes are capped at 300 characters.
const CONNECTION_CHAR_LIMIT = 300;

interface OutreachDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  company: string;
  role: string;
}

interface DraftRow {
  id: string;
  draftType: string;
  subject: string | null;
  content: string;
  tone: string | null;
  createdAt: string;
}

export default function OutreachDrawer({
  open,
  onOpenChange,
  jobId,
  company,
  role,
}: OutreachDrawerProps) {
  const [intent, setIntent] = useState<OutreachIntent>("connection");
  const [recipientName, setRecipientName] = useState("");
  const [recipientRole, setRecipientRole] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(
    null,
  );
  const [draft, setDraft] = useState<AiReplyDraftResponse | null>(null);
  const [editedBody, setEditedBody] = useState("");
  const [editedSubject, setEditedSubject] = useState("");
  const [history, setHistory] = useState<DraftRow[]>([]);

  const [phaseIndex, setPhaseIndex] = useAiProgressPhase(
    generating,
    OUTREACH_PHASES.length,
  );

  // Load history when the drawer opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/drafts?jobId=${encodeURIComponent(jobId)}`,
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
  }, [open, jobId]);

  const onGenerate = async () => {
    setGenerating(true);
    setPhaseIndex(0);
    setGenerationStartedAt(Date.now());
    setDraft(null);
    try {
      const res = await fetch("/api/drafts/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          intent,
          recipientName: recipientName.trim() || null,
          recipientRole: recipientRole.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
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
          title: "Outreach draft failed",
          description: data.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      setDraft(data.draft);
      setEditedBody(data.draft.body);
      setEditedSubject(data.draft.subject ?? "");
      setHistory((prev) => [
        {
          id: data.draftId,
          draftType: `outreach-${intent}`,
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
        title: "Outreach draft failed",
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

  const linkedInHref = () => {
    const keywords = [recipientName.trim(), company].filter(Boolean).join(" ");
    return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
      keywords || company,
    )}`;
  };

  const mailtoHref = () => {
    const params = new URLSearchParams();
    params.set("subject", editedSubject || `Regarding the ${role} role`);
    params.set("body", editedBody);
    return `mailto:?${params.toString()}`;
  };

  const isConnection = intent === "connection";
  const overLimit = isConnection && editedBody.length > CONNECTION_CHAR_LIMIT;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Outreach with AI</SheetTitle>
          <SheetDescription>
            {role}
            {company ? (
              <>
                {" · "}
                <span className="font-medium">{company}</span>
              </>
            ) : null}
            <br />
            Drafts a message you copy and send yourself — nothing is sent for you.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Message type</Label>
            <div className="flex flex-wrap gap-2">
              {OUTREACH_INTENTS.map((value) => (
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="outreach-recipient-name">
                Recipient name{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <input
                id="outreach-recipient-name"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Priya"
                disabled={generating}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="outreach-recipient-role">
                Their role{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <input
                id="outreach-recipient-role"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={recipientRole}
                onChange={(e) => setRecipientRole(e.target.value)}
                placeholder="e.g. Technical Recruiter"
                disabled={generating}
              />
            </div>
          </div>

          <Button onClick={onGenerate} disabled={generating} aria-busy={generating}>
            {generating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {generating ? "Generating…" : "Generate message"}
          </Button>

          {generating && (
            <AiProgressStatus
              phases={OUTREACH_PHASES}
              currentIndex={phaseIndex}
              startedAt={generationStartedAt}
            />
          )}

          {draft && (
            <div className="flex flex-col gap-3 rounded-md border p-3">
              {intent === "inmail" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="outreach-subject">Subject</Label>
                  <input
                    id="outreach-subject"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editedSubject}
                    onChange={(e) => setEditedSubject(e.target.value)}
                    placeholder="(no subject)"
                  />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="outreach-body">Message</Label>
                <textarea
                  id="outreach-body"
                  className="min-h-[220px] w-full rounded-md border border-input bg-background p-3 text-sm"
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Tone: <span className="font-medium">{draft.tone}</span>
                  </span>
                  <span className={overLimit ? "font-medium text-destructive" : ""}>
                    {editedBody.length}
                    {isConnection ? ` / ${CONNECTION_CHAR_LIMIT}` : ""}
                  </span>
                </div>
                {overLimit && (
                  <p className="text-xs text-destructive">
                    Over LinkedIn&apos;s {CONNECTION_CHAR_LIMIT}-character
                    connection-note limit — trim before sending.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={onCopy} size="sm">
                  <Copy className="mr-2 h-4 w-4" /> Copy
                </Button>
                <a href={linkedInHref()} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline">
                    <Linkedin className="mr-2 h-4 w-4" /> Open LinkedIn
                  </Button>
                </a>
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
                        {INTENT_LABELS[
                          row.draftType.replace("outreach-", "") as OutreachIntent
                        ] ?? row.draftType}
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
