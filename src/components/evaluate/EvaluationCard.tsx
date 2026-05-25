// CAREERFLOW: Phase 2 — renders a JdEvaluationResponse. Used by both the
// /dashboard/evaluate page (with full panel) and the per-Job detail view.
"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import GradeChip from "../design/GradeChip";
import type { JdEvaluationResponse } from "@/models/ai.schemas";

interface EvaluationCardProps {
  evaluation: JdEvaluationResponse;
  evaluatedAt?: Date | string | null;
  provider?: string;
  model?: string;
}

// CAREERFLOW: redesign (PR D) — dimension fill color keyed to the 1–5 score.
function dimensionColor(score: number): string {
  if (score >= 4.5) return "var(--grade-a)";
  if (score >= 4) return "var(--grade-b)";
  if (score >= 3.5) return "var(--grade-c)";
  if (score >= 3) return "var(--grade-d)";
  return "var(--grade-f)";
}

const ARCHETYPE_LABELS: Record<string, string> = {
  "ai-platform-llmops": "AI Platform / LLMOps",
  agentic: "Agentic Systems",
  "ai-pm": "AI Product Manager",
  "solutions-architect": "Solutions Architect",
  "forward-deployed": "Forward-Deployed Engineer",
  transformation: "AI Transformation",
  hybrid: "Hybrid",
};

function DimensionBar({ label, score }: { label: string; score: number }) {
  const pct = ((score - 1) / 4) * 100;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">{score.toFixed(1)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-1.5 rounded-full"
          style={{ width: `${pct}%`, background: dimensionColor(score) }}
        />
      </div>
    </div>
  );
}

function CollapsibleBlock({
  title,
  body,
  defaultOpen,
}: {
  title: string;
  body: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <div className="rounded-md border">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-muted/50"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          {title}
        </span>
      </button>
      {open && (
        <div className="border-t px-3 py-2 text-sm whitespace-pre-wrap">
          {body}
        </div>
      )}
    </div>
  );
}

export default function EvaluationCard({
  evaluation,
  evaluatedAt,
  provider,
  model,
}: EvaluationCardProps) {
  const archetypeLabel =
    evaluation.detectedArchetype === "hybrid" && evaluation.hybridArchetypes
      ? `Hybrid: ${evaluation.hybridArchetypes
          .map((a) => ARCHETYPE_LABELS[a] ?? a)
          .join(" / ")}`
      : ARCHETYPE_LABELS[evaluation.detectedArchetype] ??
        evaluation.detectedArchetype;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <GradeChip
              grade={evaluation.grade}
              className="h-12 w-12 rounded-lg text-2xl"
            />
            <div>
              <CardTitle>JD Evaluation</CardTitle>
              <div className="mt-1 text-sm text-muted-foreground">
                {archetypeLabel} · global score{" "}
                <span className="tabular-nums font-medium text-foreground">
                  {evaluation.globalScore.toFixed(2)}
                </span>{" "}
                / 5
              </div>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {evaluatedAt && (
              <div>{new Date(evaluatedAt).toLocaleString()}</div>
            )}
            {provider && model && (
              <div>
                {provider} · {model}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
          <DimensionBar
            label="Match with CV"
            score={evaluation.dimensionScores.matchWithCv}
          />
          <DimensionBar
            label="North Star"
            score={evaluation.dimensionScores.northStarAlignment}
          />
          <DimensionBar
            label="Comp (advisory)"
            score={evaluation.dimensionScores.comp}
          />
          <DimensionBar
            label="Culture signals"
            score={evaluation.dimensionScores.culturalSignals}
          />
          <DimensionBar
            label="Red flags (inverted)"
            score={evaluation.dimensionScores.redFlags}
          />
        </div>

        <div className="flex flex-col gap-2">
          <CollapsibleBlock
            title="Role summary"
            body={evaluation.blocks.roleSummary}
            defaultOpen
          />
          <CollapsibleBlock
            title="Match with your CV"
            body={evaluation.blocks.matchWithCv}
          />
          <CollapsibleBlock
            title="Leveling & positioning"
            body={evaluation.blocks.levelStrategy}
          />
          <CollapsibleBlock
            title="Comp & demand (advisory)"
            body={evaluation.blocks.compDemand}
          />
          <CollapsibleBlock
            title="Customization plan"
            body={evaluation.blocks.customizationPlan}
          />
          <CollapsibleBlock
            title="Interview plan"
            body={evaluation.blocks.interviewPlan}
          />
        </div>

        {evaluation.keywords.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium">ATS keywords</div>
            <div className="flex flex-wrap gap-1.5">
              {evaluation.keywords.map((kw) => (
                <Badge key={kw} variant="secondary">
                  {kw}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
