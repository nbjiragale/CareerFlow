// CAREERFLOW: Phase 2 — top-level Evaluate panel. JD textarea + archetype
// picker + Evaluate button + result card.
// CAREERFLOW: redesign (PR D) — card restyle, sample JD loader, clear control.
// CAREERFLOW: Match & Tailor — grew this panel into the one-shot
// evaluate → match → tailor flow. "Evaluate only" keeps the original
// no-side-effect grading; "Match & Tailor" auto-creates a tracked application,
// scores the chosen base resume, and generates a tailored version.
"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, Sparkles, Wand2, X } from "lucide-react";

import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { toast } from "../ui/use-toast";

import { ArchetypePicker, type ArchetypePickerValue } from "./ArchetypePicker";
import EvaluationCard from "./EvaluationCard";
import MatchTailorResult, {
  type MatchTailorResultData,
} from "./MatchTailorResult";
import type { JdEvaluationResponse } from "@/models/ai.schemas";
import { getResumeList } from "@/actions/profile.actions";

interface EvaluateResponse {
  evaluation: JdEvaluationResponse;
  provider: string;
  model: string;
  costUsd: number;
  warning?: string;
  msElapsed: number;
}

interface ResumeOption {
  id: string;
  title: string;
}

// CAREERFLOW: redesign (PR D) — a self-contained sample so the empty state is
// demoable in one click. Presentational only; no new data engine.
const SAMPLE_JD = `Senior Backend Engineer — Platform / Infrastructure
Remote (US) · $180k–$220k + equity

We're building the data platform that powers our AI products. You'll design
and operate high-throughput services in Go and TypeScript, own Postgres and
Kafka pipelines, and partner with ML teams to ship low-latency inference APIs.

What you'll do
- Design distributed services and event-driven pipelines at scale.
- Own reliability: SLOs, on-call, observability (OpenTelemetry, Grafana).
- Build the LLM serving layer — batching, caching, cost controls.

What we're looking for
- 5+ years backend experience, strong systems fundamentals.
- Production experience with Kubernetes, Terraform, and AWS or GCP.
- Bonus: vector databases, retrieval pipelines, or LLMOps tooling.`;

function structuredOutputToast() {
  toast({
    variant: "destructive",
    title: "This model can't return structured output",
    description:
      "Switch to a stronger model in Settings → AI Provider (e.g. openai/gpt-4o-mini or anthropic/claude-3.5-sonnet) and try again.",
  });
}

export default function EvaluatePanel() {
  const [jdText, setJdText] = useState("");
  const [archetype, setArchetype] = useState<ArchetypePickerValue>(
    "auto-detect",
  );
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [resumes, setResumes] = useState<ResumeOption[]>([]);
  const [baseResumeId, setBaseResumeId] = useState<string>();

  const [loading, setLoading] = useState<"none" | "evaluate" | "match-tailor">(
    "none",
  );
  const [result, setResult] = useState<EvaluateResponse | null>(null);
  const [matchTailor, setMatchTailor] = useState<MatchTailorResultData | null>(
    null,
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await getResumeList(1, 100);
        if (res?.data?.length) {
          setResumes(
            res.data.map((r: { id: string; title: string }) => ({
              id: r.id,
              title: r.title,
            })),
          );
        }
      } catch {
        // Non-fatal: the picker just stays empty and Match & Tailor is disabled.
      }
    })();
  }, []);

  const busy = loading !== "none";

  const onEvaluate = async () => {
    if (jdText.trim().length < 20) {
      toast({
        variant: "destructive",
        title: "JD too short",
        description: "Paste a full job description (at least 20 characters).",
      });
      return;
    }
    setLoading("evaluate");
    setResult(null);
    setMatchTailor(null);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText, archetypeHint: archetype }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "structured_output_unsupported") {
          structuredOutputToast();
          return;
        }
        toast({
          variant: "destructive",
          title: "Evaluation failed",
          description: data.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      setResult(data);
      if (data.warning) {
        toast({ title: "Heads up", description: data.warning });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Evaluation failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading("none");
    }
  };

  const onMatchTailor = async () => {
    if (jdText.trim().length < 20) {
      toast({
        variant: "destructive",
        title: "JD too short",
        description: "Paste a full job description (at least 20 characters).",
      });
      return;
    }
    if (!company.trim() || !role.trim()) {
      toast({
        variant: "destructive",
        title: "Company and role required",
        description: "These name the application Match & Tailor will create.",
      });
      return;
    }
    if (!baseResumeId) {
      toast({
        variant: "destructive",
        title: "Pick a base resume",
        description: "Match & Tailor scores and tailors from a base resume.",
      });
      return;
    }
    setLoading("match-tailor");
    setResult(null);
    setMatchTailor(null);
    try {
      const res = await fetch("/api/match-tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jdText,
          company,
          role,
          baseResumeId,
          archetypeHint: archetype,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "structured_output_unsupported") {
          structuredOutputToast();
          return;
        }
        toast({
          variant: "destructive",
          title: "Match & Tailor failed",
          description: data.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      setMatchTailor(data);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Match & Tailor failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading("none");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Archetype</Label>
              <ArchetypePicker
                value={archetype}
                onChange={setArchetype}
                disabled={busy}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => setJdText(SAMPLE_JD)}
              disabled={busy}
            >
              <FileText className="h-3.5 w-3.5" /> Load sample JD
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="jd-text" className="text-xs text-muted-foreground">
              Job description
            </Label>
            <textarea
              id="jd-text"
              className="min-h-[280px] w-full rounded-md border border-input bg-background p-3 font-mono text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Paste the full JD here…"
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              disabled={busy}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs tabular-nums text-muted-foreground">
                {jdText.length.toLocaleString()} characters
              </span>
              {jdText.length > 0 && (
                <button
                  type="button"
                  onClick={() => setJdText("")}
                  disabled={busy}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
          </div>

          {/* CAREERFLOW: Match & Tailor inputs — turn the JD into a tracked
              application scored + tailored against a base resume. */}
          <div className="grid gap-3 rounded-md border border-dashed border-input p-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mt-company" className="text-xs text-muted-foreground">
                Company
              </Label>
              <Input
                id="mt-company"
                placeholder="e.g. Acme"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mt-role" className="text-xs text-muted-foreground">
                Role
              </Label>
              <Input
                id="mt-role"
                placeholder="e.g. Senior Backend Engineer"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Base resume</Label>
              <Select
                value={baseResumeId}
                onValueChange={setBaseResumeId}
                disabled={busy || resumes.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      resumes.length === 0 ? "No resumes yet" : "Select a resume"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {resumes.map((r) => (
                      <SelectItem key={r.id} value={r.id} className="capitalize">
                        {r.title}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={onEvaluate} disabled={busy}>
              {loading === "evaluate" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Evaluate only
            </Button>
            <Button onClick={onMatchTailor} disabled={busy}>
              {loading === "match-tailor" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              Match &amp; Tailor
            </Button>
          </div>
        </CardContent>
      </Card>

      {matchTailor && <MatchTailorResult data={matchTailor} />}

      {result && !matchTailor && (
        <EvaluationCard
          evaluation={result.evaluation}
          provider={result.provider}
          model={result.model}
        />
      )}
    </div>
  );
}
