// CAREERFLOW: Phase 2 — JD evaluation library. Single entry point used by the
// /api/evaluate route and (in tests) directly. Wires together the JD eval
// prompts, the user's configured provider/model, the Vercel AI SDK's
// generateObject, and AiAuditLog persistence.

import "server-only";

import { generateObject, generateText, NoObjectGeneratedError } from "ai";
import { z } from "zod";

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
 * Pull a JSON object out of a free-text model response. Handles ```json fenced
 * blocks and leading/trailing prose by slicing from the first `{` to the last
 * `}`. Throws if nothing parseable is found.
 */
function extractJsonObject(text: string): unknown {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidate = fenced[1].trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start !== -1 && end > start) {
    candidate = candidate.slice(start, end + 1);
  }
  return JSON.parse(candidate);
}

interface GeneratedEvaluation {
  object: JdEvaluationResponse;
  usage?: { inputTokens?: number; outputTokens?: number };
}

/**
 * Produce a schema-valid evaluation object.
 *
 * Fast path: `generateObject`, which uses the provider's native structured
 * output (json_schema / tool calling). That fails with NoObjectGeneratedError
 * on OpenRouter models that don't support response_format json_schema — the
 * model returns prose/markdown the SDK can't coerce. In that case we fall back
 * to a plain `generateText` call with the JSON Schema injected into the prompt,
 * then extract + Zod-validate the JSON ourselves. Providers that already
 * support structured output never hit the fallback.
 */
async function generateEvaluationObject(
  aiModel: Awaited<ReturnType<typeof getModel>>,
  system: string,
  prompt: string,
): Promise<GeneratedEvaluation> {
  try {
    const { object, usage } = await generateObject({
      model: aiModel,
      schema: JdEvaluationSchema,
      system,
      prompt,
      temperature: 0.3,
    });
    return { object, usage };
  } catch (err) {
    if (!NoObjectGeneratedError.isInstance(err)) throw err;

    const jsonSchema = z.toJSONSchema(JdEvaluationSchema);
    const { text, usage } = await generateText({
      model: aiModel,
      system,
      prompt: `${prompt}\n\nReturn ONLY a single valid JSON object — no markdown code fences, no commentary before or after — conforming exactly to this JSON Schema:\n${JSON.stringify(
        jsonSchema,
      )}`,
      temperature: 0.3,
    });

    let object: JdEvaluationResponse;
    try {
      object = JdEvaluationSchema.parse(extractJsonObject(text));
    } catch {
      throw new Error(
        "The selected model did not return a valid evaluation. Try a model that supports structured/JSON output (e.g. openai/gpt-4o, anthropic/claude-3.5-sonnet).",
      );
    }
    return { object, usage };
  }
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

    const { object: evaluation, usage } = await generateEvaluationObject(
      aiModel,
      JD_EVALUATE_SYSTEM_PROMPT,
      buildJdEvaluatePrompt({ jdText, archetypeHint, resumeSummary }),
    );

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
