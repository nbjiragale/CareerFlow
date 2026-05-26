// CAREERFLOW: result panel for the one-shot Match & Tailor flow — composes the
// existing EvaluationCard with a compact match summary and a tailored-resume
// banner, plus per-step error notices when a step fails but others succeed.
"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  FileText,
} from "lucide-react";

import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import EvaluationCard from "./EvaluationCard";
import type { JdEvaluationResponse, JobMatchResponse } from "@/models/ai.schemas";

export interface MatchTailorResultData {
  jobId: string;
  evaluation: JdEvaluationResponse | null;
  evaluationError?: string;
  match: JobMatchResponse | null;
  matchError?: string;
  tailoredResumeId: string | null;
  tailoredResumeTitle: string | null;
  tailorError?: string;
  provider: string;
  model: string;
  totalCostUsd: number;
}

function StepError({ label, message }: { label: string; message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>
        <span className="font-medium">{label} skipped:</span> {message}
      </span>
    </div>
  );
}

function KeywordBadges({
  items,
  variant,
}: {
  items: string[];
  variant: "secondary" | "outline" | "destructive";
}) {
  if (!items || items.length === 0) {
    return <span className="text-xs text-muted-foreground">None</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((k) => (
        <Badge key={k} variant={variant} className="font-normal">
          {k}
        </Badge>
      ))}
    </div>
  );
}

function MatchSummary({ match }: { match: JobMatchResponse }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Resume match
            </p>
            <p className="mt-0.5 text-sm capitalize text-muted-foreground">
              {match.recommendation}
            </p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-semibold tabular-nums">
              {Math.round(match.matchScore)}
            </span>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>
        </div>

        <p className="text-sm leading-relaxed">{match.summary}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Matched skills
            </p>
            <KeywordBadges items={match.skills.matched} variant="secondary" />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Missing keywords
            </p>
            <KeywordBadges items={match.keywords.missing} variant="outline" />
          </div>
        </div>

        {match.dealBreakers && match.dealBreakers.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Deal breakers
            </p>
            <KeywordBadges items={match.dealBreakers} variant="destructive" />
          </div>
        )}

        {match.tailoringTips && match.tailoringTips.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Tailoring tips
            </p>
            <ul className="flex flex-col gap-1.5 text-sm">
              {match.tailoringTips.map((tip, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-medium">{tip.section}:</span>
                  <span className="text-muted-foreground">{tip.action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MatchTailorResult({
  data,
}: {
  data: MatchTailorResultData;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Tailored-resume + application banner */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <p className="text-sm font-medium">
              Tracked application created
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/myjobs/${data.jobId}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              <ArrowUpRight className="h-3.5 w-3.5" /> View application
            </Link>
            {data.tailoredResumeId ? (
              <Link
                href={`/dashboard/profile/resume/${data.tailoredResumeId}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
              >
                <FileText className="h-3.5 w-3.5" />
                {data.tailoredResumeTitle
                  ? `Open “${data.tailoredResumeTitle}”`
                  : "Open tailored resume"}
              </Link>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {data.evaluationError && (
        <StepError label="Evaluation" message={data.evaluationError} />
      )}
      {data.evaluation && (
        <EvaluationCard
          evaluation={data.evaluation}
          provider={data.provider}
          model={data.model}
        />
      )}

      {data.matchError && (
        <StepError label="Resume match" message={data.matchError} />
      )}
      {data.match && <MatchSummary match={data.match} />}

      {data.tailorError && (
        <StepError label="Resume tailoring" message={data.tailorError} />
      )}
    </div>
  );
}
