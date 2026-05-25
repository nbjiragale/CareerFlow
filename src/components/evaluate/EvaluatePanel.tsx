// CAREERFLOW: Phase 2 — top-level Evaluate panel. JD textarea + archetype
// picker + Evaluate button + result card.
"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
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
        <CardHeader>
          <CardTitle>JD Evaluation</CardTitle>
          <CardDescription>
            Paste a job description below. CareerFlow grades it against your
            configured AI provider and surfaces a tailored customization plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="jd-text">Job description</Label>
            <textarea
              id="jd-text"
              className="min-h-[260px] w-full rounded-md border border-input bg-background p-3 text-sm font-mono"
              placeholder="Paste the full JD here..."
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              disabled={loading}
            />
            <div className="text-xs text-muted-foreground">
              {jdText.length.toLocaleString()} characters
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-2">
              <Label>Archetype</Label>
              <ArchetypePicker
                value={archetype}
                onChange={setArchetype}
                disabled={loading}
              />
            </div>
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
