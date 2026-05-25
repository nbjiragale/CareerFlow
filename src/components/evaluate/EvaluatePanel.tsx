// CAREERFLOW: Phase 2 — top-level Evaluate panel. JD textarea + archetype
// picker + Evaluate button + result card.
// CAREERFLOW: redesign (PR D) — card restyle, sample JD loader, clear control.
"use client";

import { useState } from "react";
import { FileText, Loader2, Sparkles, X } from "lucide-react";

import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Label } from "../ui/label";
import { toast } from "../ui/use-toast";

import { ArchetypePicker, type ArchetypePickerValue } from "./ArchetypePicker";
import EvaluationCard from "./EvaluationCard";
import type { JdEvaluationResponse } from "@/models/ai.schemas";

interface EvaluateResponse {
  evaluation: JdEvaluationResponse;
  provider: string;
  model: string;
  costUsd: number;
  warning?: string;
  msElapsed: number;
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

export default function EvaluatePanel() {
  const [jdText, setJdText] = useState("");
  const [archetype, setArchetype] = useState<ArchetypePickerValue>(
    "auto-detect",
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EvaluateResponse | null>(null);

  const onEvaluate = async () => {
    if (jdText.trim().length < 20) {
      toast({
        variant: "destructive",
        title: "JD too short",
        description: "Paste a full job description (at least 20 characters).",
      });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jdText,
          archetypeHint: archetype,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // CAREERFLOW: when the selected provider/model can't handle the
        // JdEvaluationSchema, the server returns a 422 with
        // code="structured_output_unsupported". Show a more actionable
        // toast pointing the user at a known-good model.
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
          title: "Evaluation failed",
          description: data.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      setResult(data);
      if (data.warning) {
        toast({
          title: "Heads up",
          description: data.warning,
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Evaluation failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
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
                disabled={loading}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => setJdText(SAMPLE_JD)}
              disabled={loading}
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
              disabled={loading}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs tabular-nums text-muted-foreground">
                {jdText.length.toLocaleString()} characters
              </span>
              {jdText.length > 0 && (
                <button
                  type="button"
                  onClick={() => setJdText("")}
                  disabled={loading}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={onEvaluate} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Evaluate
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <EvaluationCard
          evaluation={result.evaluation}
          provider={result.provider}
          model={result.model}
        />
      )}
    </div>
  );
}
