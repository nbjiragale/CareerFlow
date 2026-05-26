// CAREERFLOW: Interview Copilot card on the job detail page. Auto-surfaces for
// interview-stage jobs; generates the prep brief on demand (one click) and the
// server caches it, so re-opening the job re-renders instantly without another
// LLM call. "Regenerate" forces a fresh brief.
"use client";

import { useState } from "react";
import {
  CalendarClock,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { toast } from "../ui/use-toast";
import type { InterviewPrepResponse } from "@/models/ai.schemas";

const CATEGORY_LABEL: Record<string, string> = {
  technical: "Technical",
  behavioral: "Behavioral",
  "role-specific": "Role-specific",
  "culture-fit": "Culture fit",
};

function parsePrep(json?: string | null): InterviewPrepResponse | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as InterviewPrepResponse;
  } catch {
    return null;
  }
}

export default function InterviewCopilot({
  jobId,
  initialPrepJson,
  isInterviewStage,
}: {
  jobId: string;
  initialPrepJson?: string | null;
  isInterviewStage: boolean;
}) {
  const [prep, setPrep] = useState<InterviewPrepResponse | null>(() =>
    parsePrep(initialPrepJson),
  );
  const [loading, setLoading] = useState(false);

  const generate = async (force: boolean) => {
    setLoading(true);
    try {
      const res = await fetch("/api/interview-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, force }),
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
          title: "Interview prep failed",
          description: data.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      setPrep(data.prep);
      if (!data.cached) {
        toast({ variant: "success", title: "Interview prep ready" });
      }
      if (data.warning) {
        toast({ title: "Heads up", description: data.warning });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Interview prep failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  const highlight = isInterviewStage && !prep;

  return (
    <Card className={`p-4 ${highlight ? "border-primary/40 bg-primary/5" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 font-medium">
          <CalendarClock className="h-4 w-4" />
          Interview Copilot
          {isInterviewStage && (
            <Badge variant="default" className="font-normal">
              Interview stage
            </Badge>
          )}
        </h4>
        <Button
          size="sm"
          variant={prep ? "outline" : "default"}
          className="h-8 gap-1.5"
          onClick={() => generate(!!prep)}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : prep ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {prep ? "Regenerate" : "Prep with AI"}
        </Button>
      </div>

      {!prep && !loading && (
        <p className="mt-2 text-sm text-muted-foreground">
          {isInterviewStage
            ? "You're at the interview stage. Generate a tailored prep brief — company context, likely questions, talking points, and a checklist — from this JD and your resume."
            : "Generate a tailored prep brief from this JD and your resume: likely questions, talking points, and questions to ask."}
        </p>
      )}

      {prep && (
        <div className="mt-4 flex flex-col gap-5">
          <section>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Company overview
            </p>
            <p className="mt-1 text-sm leading-relaxed">{prep.companyOverview}</p>
            <p className="mt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Likely focus
            </p>
            <p className="mt-1 text-sm leading-relaxed">{prep.roleFocus}</p>
          </section>

          <section>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <MessageSquareText className="h-3.5 w-3.5" /> Likely questions
            </p>
            <ul className="flex flex-col gap-3">
              {prep.likelyQuestions.map((q, i) => (
                <li key={i} className="rounded-md border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{q.question}</p>
                    <Badge variant="secondary" className="shrink-0 font-normal">
                      {CATEGORY_LABEL[q.category] ?? q.category}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {q.answerAngle}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <div className="grid gap-5 sm:grid-cols-2">
            <section>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Talking points
              </p>
              <ul className="ml-4 list-disc text-sm">
                {prep.talkingPoints.map((t, i) => (
                  <li key={i} className="mb-1">
                    {t}
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Questions to ask them
              </p>
              <ul className="ml-4 list-disc text-sm">
                {prep.questionsToAsk.map((q, i) => (
                  <li key={i} className="mb-1">
                    {q}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Prep checklist
            </p>
            <ul className="ml-4 list-disc text-sm">
              {prep.prepChecklist.map((c, i) => (
                <li key={i} className="mb-1">
                  {c}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Card>
  );
}
