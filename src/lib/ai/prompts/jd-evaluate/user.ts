// CAREERFLOW: Phase 2 — JD evaluation user prompt builder. Truncates inputs
// to keep us inside short-context windows (cheap Ollama models in particular).

import "server-only";

import type { Archetype } from "@/models/ai.schemas";

const MAX_JD_CHARS = 8_000;
const MAX_RESUME_CHARS = 2_000;

export interface BuildJdEvaluatePromptArgs {
  jdText: string;
  archetypeHint?: Archetype | "auto-detect";
  resumeSummary?: string | null;
}

export function buildJdEvaluatePrompt(args: BuildJdEvaluatePromptArgs): string {
  const { jdText, archetypeHint, resumeSummary } = args;

  const jd = jdText.slice(0, MAX_JD_CHARS);
  const resume =
    (resumeSummary ?? "").slice(0, MAX_RESUME_CHARS).trim() ||
    "(no resume summary provided — base your evaluation on the JD alone, and call out the absence of candidate context where relevant)";

  const hintLine =
    !archetypeHint || archetypeHint === "auto-detect"
      ? "The user did not pick an archetype hint. Detect the closest archetype yourself."
      : `Archetype hint from user: ${archetypeHint}. Use it as a starting frame but override if the JD clearly fits a different archetype better.`;

  return [
    `${hintLine}`,
    "",
    "=== CANDIDATE RESUME SUMMARY (may be truncated) ===",
    resume,
    "",
    "=== JOB DESCRIPTION (may be truncated) ===",
    jd,
    "",
    "Now produce the structured evaluation per the schema.",
  ].join("\n");
}
