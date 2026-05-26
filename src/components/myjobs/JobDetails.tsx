"use client";
import { format } from "date-fns";
import { Badge } from "../ui/badge";
import { formatUrl } from "@/lib/utils";
import { JobResponse } from "@/models/job.model";
import { TipTapContentViewer } from "../TipTapContentViewer";
import { Card, CardFooter } from "../ui/card";
import { Button } from "../ui/button";
import { ArrowLeft, ExternalLink, Sparkles } from "lucide-react";
// CAREERFLOW: redesign — detail header primitives.
import GradeChip from "../design/GradeChip";
import StatusPill from "../design/StatusPill";
import LogoMark from "../design/LogoMark";
import { useRouter } from "next/navigation";
import { AiJobMatchSection } from "../profile/AiJobMatchSection";
import { TailorResumeButton } from "../profile/TailorResumeButton";
import { NotesSection } from "./NotesSection";
import { useState, useMemo, useCallback } from "react";
import { DownloadFileButton } from "../profile/DownloadFileButton";
import { MatchDetails } from "../automations/MatchDetails";
import type { JobMatchResponse, JdEvaluationResponse } from "@/models/ai.schemas";
// CAREERFLOW: Phase 2 — JD evaluation card on the job detail surface.
import EvaluationCard from "../evaluate/EvaluationCard";
// CAREERFLOW: Phase 3 — unified per-job timeline.
import JobTimeline from "../timeline/JobTimeline";
// CAREERFLOW: Interview Copilot — auto-surfaced for interview-stage jobs.
import InterviewCopilot from "./InterviewCopilot";
import { Loader2 } from "lucide-react";
import { toast } from "../ui/use-toast";

function JobDetails({ job }: { job: JobResponse }) {
  const [aiSectionOpen, setAiSectionOpen] = useState(false);
  const [currentMatchScore, setCurrentMatchScore] = useState(job.matchScore);
  const [currentMatchData, setCurrentMatchData] = useState(job.matchData);
  // CAREERFLOW: Phase 2 — local mirror of the eval payload so the card can be
  // re-rendered after a Re-evaluate click without a full page refresh.
  const [evaluationJson, setEvaluationJson] = useState(job.evaluationJson ?? null);
  const [evaluatedAt, setEvaluatedAt] = useState<Date | string | null>(
    job.evaluatedAt ?? null,
  );
  const [evaluating, setEvaluating] = useState(false);
  const router = useRouter();
  const goBack = () => router.back();

  const parsedMatchData = useMemo(() => {
    if (!currentMatchData) return null;
    try {
      return JSON.parse(currentMatchData) as JobMatchResponse;
    } catch {
      return null;
    }
  }, [currentMatchData]);

  const parsedEvaluation = useMemo<JdEvaluationResponse | null>(() => {
    if (!evaluationJson) return null;
    try {
      return JSON.parse(evaluationJson) as JdEvaluationResponse;
    } catch {
      return null;
    }
  }, [evaluationJson]);

  const runEvaluate = useCallback(async () => {
    if (!job?.id || !job?.description?.trim()) {
      toast({
        variant: "destructive",
        title: "No description",
        description: "Add a job description before evaluating.",
      });
      return;
    }
    setEvaluating(true);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jdText: job.description,
          jobId: job.id,
          archetypeHint: "auto-detect",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Evaluation failed",
          description: data.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      setEvaluationJson(JSON.stringify(data.evaluation));
      setEvaluatedAt(new Date().toISOString());
      toast({ variant: "success", title: "Evaluation complete" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Evaluation failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setEvaluating(false);
    }
  }, [job?.id, job?.description]);

  const handleMatchSaved = useCallback(
    (matchScore: number, matchData: string) => {
      setCurrentMatchScore(matchScore);
      setCurrentMatchData(matchData);
    },
    [],
  );
  const getAiJobMatch = async () => {
    setAiSectionOpen(true);
  };
  const getJobType = (code: string) => {
    switch (code) {
      case "FT":
        return "Full-time";
      case "PT":
        return "Part-time";
      case "C":
        return "Contract";
      default:
        return "Unknown";
    }
  };
  const scoreOutOf100 =
    parsedEvaluation && typeof parsedEvaluation.globalScore === "number"
      ? Math.round(parsedEvaluation.globalScore * 20)
      : null;

  return (
    <div className="col-span-3 mx-auto flex w-full max-w-[960px] flex-col gap-4">
      {/* action bar */}
      <div className="flex items-center justify-between">
        <Button
          title="All applications"
          size="sm"
          variant="ghost"
          className="gap-1.5 px-2 text-muted-foreground"
          onClick={goBack}
        >
          <ArrowLeft className="h-4 w-4" /> All applications
        </Button>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={runEvaluate}
            disabled={evaluating}
          >
            {evaluating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {parsedEvaluation ? "Re-evaluate" : "Evaluate JD"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={getAiJobMatch}
          >
            <Sparkles className="h-3.5 w-3.5" /> Match with AI
          </Button>
          {job?.id && (
            <TailorResumeButton
              jobId={job.id}
              defaultResumeId={job?.Resume?.id ?? null}
            />
          )}
          {job?.jobUrl && (
            <a
              href={formatUrl(job.jobUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium transition-colors hover:bg-accent"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open JD
            </a>
          )}
        </div>
      </div>

      {/* stat trio + company header */}
      <Card className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <LogoMark name={job?.Company?.label || job?.JobTitle?.label || "?"} size="lg" />
            <div>
              <div className="text-sm text-muted-foreground">
                {[job?.Company?.label, job?.Location?.label, job?.salaryRange]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
                {job?.JobTitle?.label}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {job?.Status && (
                  <StatusPill
                    status={job.Status.value}
                    label={job.Status.label}
                  />
                )}
                {job.tags?.map((tag) => (
                  <Badge key={tag.id} variant="secondary">
                    {tag.label}
                  </Badge>
                ))}
              </div>
              {job?.appliedDate && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Applied {format(new Date(job.appliedDate), "PP")} ·{" "}
                  {getJobType(job?.jobType)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-stretch gap-2">
            <div className="flex min-w-[84px] flex-col items-center gap-1 rounded-lg border border-border bg-secondary p-3">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                AI Grade
              </span>
              {parsedEvaluation?.grade ? (
                <GradeChip grade={parsedEvaluation.grade} />
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
            <div className="flex min-w-[84px] flex-col items-center gap-1 rounded-lg border border-border bg-secondary p-3">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Score
              </span>
              <span className="text-xl font-semibold tabular-nums">
                {scoreOutOf100 != null ? scoreOutOf100 : "—"}
                <span className="text-xs text-muted-foreground">/100</span>
              </span>
            </div>
            <div className="flex min-w-[84px] flex-col items-center gap-1 rounded-lg border border-border bg-secondary p-3">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Resume
              </span>
              <span className="text-xl font-semibold tabular-nums">
                {currentMatchScore != null ? `${currentMatchScore}%` : "—"}
              </span>
            </div>
          </div>
        </div>

        {job?.Resume?.File?.filePath
          ? DownloadFileButton(
              job.Resume.File.filePath,
              job.Resume.title,
              job.Resume.File.fileName,
            )
          : null}
      </Card>

      {/* Interview Copilot — auto-surfaces at the interview stage, or whenever
          a brief has already been generated for this job. */}
      {job?.id &&
        (job.Status?.value === "interview" || job.interviewPrepJson) && (
          <InterviewCopilot
            jobId={job.id}
            initialPrepJson={job.interviewPrepJson ?? null}
            isInterviewStage={job.Status?.value === "interview"}
          />
        )}

      {/* AI evaluation */}
      {parsedEvaluation && (
        <EvaluationCard
          evaluation={parsedEvaluation}
          evaluatedAt={evaluatedAt ?? undefined}
        />
      )}

      {/* timeline */}
      {job?.id && <JobTimeline jobId={job.id} />}

      {/* resume match */}
      {parsedMatchData && (
        <Card className="p-4">
          <h4 className="mb-2 flex items-center gap-2 font-medium">
            <Sparkles className="h-4 w-4" />
            AI Match Analysis
            {currentMatchScore && (
              <Badge variant="default">{currentMatchScore}% Match</Badge>
            )}
          </h4>
          <MatchDetails matchData={parsedMatchData} />
        </Card>
      )}

      {/* job description */}
      <Card className="p-4">
        <h4 className="mb-2 font-medium">Job description</h4>
        <TipTapContentViewer content={job?.description} />
      </Card>

      {/* notes */}
      {job?.id && (
        <Card className="p-4">
          <NotesSection jobId={job.id} />
        </Card>
      )}

      <CardFooter className="p-0" />

      <AiJobMatchSection
        jobId={job?.id}
        aISectionOpen={aiSectionOpen}
        triggerChange={setAiSectionOpen}
        onMatchSaved={handleMatchSaved}
      />
    </div>
  );
}

export default JobDetails;
