// CAREERFLOW: "Edge" win-loop dashboard card. The standout feature: a private
// coach grounded in the user's own outcomes. Readiness (how much decided data
// exists) is computed server-side with no LLM cost; the model is only called
// when the user clicks "Reveal my Edge" AND the data has cleared the threshold.
"use client";

import { useState } from "react";
import { Gauge, Lightbulb, Lock, Sparkles, TrendingUp } from "lucide-react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { toast } from "../ui/use-toast";
import {
  AiProgressStatus,
  useAiProgressPhase,
} from "../common/AiProgressStatus";
import { EDGE_MIN_DECIDED } from "@/lib/ai/edge/aggregate";
import type {
  CareerEdgeInsight,
  CareerEdgeResponse,
} from "@/models/ai.schemas";

export interface EdgeReadinessProps {
  hasEnoughData: boolean;
  decided: number;
  decidedNeeded: number;
  totalApplications: number;
}

const EDGE_PHASES = [
  "Reading your application history…",
  "Crunching your funnel…",
  "Comparing what worked…",
  "Writing your insights…",
  "Almost there…",
];

const FACTOR_LABEL: Record<CareerEdgeInsight["factor"], string> = {
  archetype: "Archetype",
  grade: "Grade",
  match: "Match score",
  "follow-up": "Follow-up",
  resume: "Resume",
  timing: "Timing",
  general: "Overall",
};

const CONFIDENCE_VARIANT: Record<
  CareerEdgeInsight["confidence"],
  "default" | "secondary" | "outline"
> = {
  high: "default",
  medium: "secondary",
  low: "outline",
};

export default function CareerEdgeCard({
  readiness,
}: {
  readiness: EdgeReadinessProps;
}) {
  const [loading, setLoading] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [edge, setEdge] = useState<CareerEdgeResponse | null>(null);
  const [phaseIndex, setPhaseIndex] = useAiProgressPhase(
    loading,
    EDGE_PHASES.length,
  );

  const reveal = async () => {
    setLoading(true);
    setPhaseIndex(0);
    setStartedAt(Date.now());
    try {
      const res = await fetch("/api/edge", { method: "POST" });
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
          title: "Couldn't generate your Edge",
          description: data.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      if (data.status === "learning") {
        // Data slipped below threshold between page load and click — rare.
        toast({
          title: "Still learning",
          description: "Not enough decided applications yet.",
        });
        return;
      }
      setEdge(data.insights as CareerEdgeResponse);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't generate your Edge",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  // Locked state: not enough decided outcomes to say anything trustworthy yet.
  if (!readiness.hasEnoughData) {
    const progress = Math.min(
      100,
      Math.round((readiness.decided / EDGE_MIN_DECIDED) * 100),
    );
    return (
      <Card className="flex flex-col gap-3 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="h-4 w-4" />
          Your Edge
          <Badge variant="outline" className="gap-1 font-normal">
            <Lock className="h-3 w-3" /> Learning
          </Badge>
        </h2>
        <p className="text-sm text-muted-foreground">
          Once enough applications reach a decision, your Edge analyzes your own
          outcomes — by archetype, grade, match score, resume version, and
          follow-up — to tell you specifically what lands you interviews.
        </p>
        <div className="flex flex-col gap-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {readiness.decided} of {EDGE_MIN_DECIDED} decided applications ·{" "}
            <span className="font-medium text-foreground">
              {readiness.decidedNeeded} more
            </span>{" "}
            to unlock
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="h-4 w-4" />
          Your Edge
          <Badge variant="default" className="font-normal">
            {readiness.decided} decided
          </Badge>
        </h2>
        {!edge && (
          <Button
            size="sm"
            className="h-8 gap-1.5"
            onClick={reveal}
            disabled={loading}
            aria-busy={loading}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {loading ? "Analyzing…" : "Reveal my Edge"}
          </Button>
        )}
      </div>

      {!edge && !loading && (
        <p className="text-sm text-muted-foreground">
          Analyze your own outcomes to see what actually lands you interviews —
          grounded in your real funnel, never generic advice.
        </p>
      )}

      {loading && (
        <AiProgressStatus
          phases={EDGE_PHASES}
          currentIndex={phaseIndex}
          startedAt={startedAt}
        />
      )}

      {edge && (
        <div className="flex flex-col gap-4">
          <p className="rounded-md bg-muted/40 p-3 text-sm leading-relaxed">
            {edge.headline}
          </p>

          <ul className="flex flex-col gap-3">
            {edge.insights.map((ins, i) => (
              <li key={i} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Lightbulb className="h-3.5 w-3.5 text-primary" />
                    {ins.title}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="font-normal">
                      {FACTOR_LABEL[ins.factor]}
                    </Badge>
                    <Badge
                      variant={CONFIDENCE_VARIANT[ins.confidence]}
                      className="font-normal"
                    >
                      {ins.confidence} confidence
                    </Badge>
                  </div>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {ins.finding}
                </p>
                <p className="mt-1.5 text-sm">
                  <span className="font-medium">Do this: </span>
                  {ins.recommendation}
                </p>
              </li>
            ))}
          </ul>

          <section>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Gauge className="h-3.5 w-3.5" /> Next actions
            </p>
            <ul className="ml-4 list-disc text-sm">
              {edge.nextActions.map((a, i) => (
                <li key={i} className="mb-1">
                  {a}
                </li>
              ))}
            </ul>
          </section>

          <p className="text-xs text-muted-foreground">
            Grounded in your own application outcomes. Patterns reflect
            correlation, not proven cause — use them as direction, not gospel.
          </p>
        </div>
      )}
    </Card>
  );
}
