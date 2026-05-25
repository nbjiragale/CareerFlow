// CAREERFLOW: Phase 2 — JD evaluation library. Single entry point used by the
// /api/evaluate route and (in tests) directly. Wires together the JD eval
// prompts, the user's configured provider/model, the Vercel AI SDK's
// generateObject, and AiAuditLog persistence.

import "server-only";

import db from "@/lib/db";
import { getModel, type ProviderType } from "@/lib/ai/providers";
import {
  JD_EVALUATE_SYSTEM_PROMPT,
  buildJdEvaluatePrompt,
} from "@/lib/ai/prompts/jd-evaluate";
import {
  JdEvaluationSchema,
  type JdEvaluationResponse,
  type Archetype,
} from "@/models/ai.schemas";
import { generateStructuredObject } from "./structured";
import { recordAiUsage } from "./audit";

export interface RunJdEvaluationArgs {
  userId: string;
  jdText: string;
  archetypeHint?: Archetype | "auto-detect";
  // Optional resume to use as candidate context. Currently we pass a flat
  // string summary; in a future phase we may swap to the structured Resume.
  resumeSummary?: string | null;
  // When provided, the result is persisted onto Job.evaluationJson +
  // evaluationGrade + evaluatedAt.
  jobId?: string | null;
}

export interface RunJdEvaluationResult {
  evaluation: JdEvaluationResponse;
  provider: ProviderType;
  model: string;
  costUsd: number;
  warning?: string;
  msElapsed: number;
}

interface ResolvedAiSettings {
  provider: ProviderType;
  model: string;
}

async function resolveAiSettings(
  userId: string,
): Promise<ResolvedAiSettings> {
  const row = await db.userSettings.findUnique({ where: { userId } });
  if (!row) {
    throw new Error(
      "AI settings not configured. Pick a provider and model in Settings \u2192 AI Provider first.",
    );
  }
  let parsed: { ai?: { provider?: string; model?: string } };
  try {
    parsed = JSON.parse(row.settings);
  } catch {
    throw new Error("UserSettings JSON is corrupt; cannot resolve AI provider.");
  }
  const provider = parsed.ai?.provider as ProviderType | undefined;
  const model = parsed.ai?.model;
  if (!provider || !model) {
    throw new Error(
      "AI provider/model not selected. Pick one in Settings \u2192 AI Provider.",
    );
  }
  return { provider, model };
}

function gradeFromScore(globalScore: number): "A" | "B" | "C" | "D" | "F" {
  if (globalScore >= 4.5) return "A";
  if (globalScore >= 4.0) return "B";
  if (globalScore >= 3.5) return "C";
  if (globalScore >= 3.0) return "D";
  return "F";
}

/**
 * Run a single JD evaluation. Throws on validation, auth, or LLM errors after
 * recording an `error` AiAuditLog row. Returns the structured evaluation plus
 * cost metadata on success.
 */
export async function runJdEvaluation(
  args: RunJdEvaluationArgs,
): Promise<RunJdEvaluationResult> {
  const { userId, jdText, archetypeHint, resumeSummary, jobId } = args;

  if (!jdText.trim()) {
    throw new Error("jdText is required.");
  }

  const { provider, model } = await resolveAiSettings(userId);
  const startedAt = Date.now();

  try {
    const aiModel = await getModel(provider, model, userId);

    const { object: evaluation, usage } = await generateStructuredObject({
      model: aiModel,
      schema: JdEvaluationSchema,
      system: JD_EVALUATE_SYSTEM_PROMPT,
      prompt: buildJdEvaluatePrompt({ jdText, archetypeHint, resumeSummary }),
      temperature: 0.3,
    });

    // Normalize grade in case the model drifted off the rubric.
    const grade = gradeFromScore(evaluation.globalScore);
    const normalized: JdEvaluationResponse = { ...evaluation, grade };

    const msElapsed = Date.now() - startedAt;

    const audit = await recordAiUsage({
      userId,
      feature: "evaluate",
      provider,
      model,
      usage: {
        promptTokens: usage?.inputTokens,
        completionTokens: usage?.outputTokens,
      },
      msElapsed,
      status: "success",
      jobId: jobId ?? null,
    });

    if (jobId) {
      await db.job.update({
        where: { id: jobId },
        data: {
          evaluationGrade: grade,
          evaluationJson: JSON.stringify(normalized),
          evaluatedAt: new Date(),
        },
      });
    }

    return {
      evaluation: normalized,
      provider,
      model,
      costUsd: audit?.costUsd ?? 0,
      warning: audit?.warning,
      msElapsed,
    };
  } catch (err) {
    const msElapsed = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : "Unknown error";
    await recordAiUsage({
      userId,
      feature: "evaluate",
      provider,
      model,
      msElapsed,
      status: "error",
      errorMessage: message,
      jobId: jobId ?? null,
    });
    throw err;
  }
}
