// CAREERFLOW: "Edge" win-loop — orchestrator. Public entry points:
//
//   getEdgeReadiness(userId)   — cheap, LLM-free. How much decided data exists
//                                and whether insights are unlocked. Safe to call
//                                on every dashboard load.
//   generateCareerEdge(userId) — runs the deterministic aggregator, and ONLY if
//                                enough data exists, spends one LLM call to turn
//                                the stats into grounded insights.
//
// The split keeps the dashboard free of surprise AI spend: we never call the
// model until the user explicitly asks AND the data clears the threshold.

import "server-only";

import { getModel, type ProviderType } from "@/lib/ai/providers";
import {
  CAREER_EDGE_SYSTEM_PROMPT,
  buildCareerEdgePrompt,
} from "@/lib/ai/prompts/career-edge";
import {
  CareerEdgeSchema,
  type CareerEdgeResponse,
} from "@/models/ai.schemas";
import { generateStructuredObject } from "../structured";
import { recordAiUsage } from "../audit";
import { resolveUserAiSettings } from "../resolve-settings";
import { collectApplications } from "./collect";
import { buildEdgeFacts, type EdgeFacts } from "./aggregate";

export interface EdgeReadiness {
  hasEnoughData: boolean;
  decided: number;
  decidedNeeded: number;
  totalApplications: number;
}

export async function getEdgeReadiness(userId: string): Promise<EdgeReadiness> {
  const facts = buildEdgeFacts(await collectApplications(userId));
  return {
    hasEnoughData: facts.hasEnoughData,
    decided: facts.totals.decided,
    decidedNeeded: facts.decidedNeeded,
    totalApplications: facts.totals.total,
  };
}

export type GenerateCareerEdgeResult =
  | {
      status: "learning";
      facts: EdgeFacts;
    }
  | {
      status: "ok";
      facts: EdgeFacts;
      insights: CareerEdgeResponse;
      provider: ProviderType;
      model: string;
      costUsd: number;
      warning?: string;
      msElapsed: number;
    };

export async function generateCareerEdge(
  userId: string,
): Promise<GenerateCareerEdgeResult> {
  const facts = buildEdgeFacts(await collectApplications(userId));

  // Cost-free short circuit: not enough decided applications yet.
  if (!facts.hasEnoughData) {
    return { status: "learning", facts };
  }

  const { provider, model } = await resolveUserAiSettings(userId);
  const startedAt = Date.now();

  try {
    const aiModel = await getModel(provider, model, userId);

    const { object: insights, usage } = await generateStructuredObject({
      model: aiModel,
      schema: CareerEdgeSchema,
      system: CAREER_EDGE_SYSTEM_PROMPT,
      prompt: buildCareerEdgePrompt(facts),
      temperature: 0.4,
    });

    const msElapsed = Date.now() - startedAt;

    const audit = await recordAiUsage({
      userId,
      feature: "career-edge",
      provider,
      model,
      usage: {
        promptTokens: usage?.inputTokens,
        completionTokens: usage?.outputTokens,
      },
      msElapsed,
      status: "success",
    });

    return {
      status: "ok",
      facts,
      insights,
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
      feature: "career-edge",
      provider,
      model,
      msElapsed,
      status: "error",
      errorMessage: message,
    });
    throw err;
  }
}
