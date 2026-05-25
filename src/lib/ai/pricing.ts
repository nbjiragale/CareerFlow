// CAREERFLOW: Phase 2 — static AI pricing table for cost estimation. Used by
// src/lib/ai/audit.ts to compute a USD figure per call from the Vercel AI SDK's
// usage object. Unknown models return { costUsd: 0, warning: "Unknown model" }
// so calls still appear in Settings → Usage even when we can't price them.
//
// Pricing source: each provider's published rates as of 2026-05. Prices drift
// frequently and are NOT intended to be authoritative — they exist so the user
// has a rough running tally, not a billable invoice.

import "server-only";

export interface ModelPricing {
  // USD per 1,000,000 input tokens.
  input: number;
  // USD per 1,000,000 output tokens.
  output: number;
}

// Provider IDs match PROVIDER_REGISTRY ids in provider-registry.ts. Ollama is
// intentionally omitted — it runs locally, so we report cost as 0 unconditionally.
export const MODEL_PRICING_USD_PER_1M_TOKENS: Record<string, ModelPricing> = {
  // OpenAI
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "gpt-4": { input: 30, output: 60 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
  "o1-preview": { input: 15, output: 60 },
  "o1-mini": { input: 3, output: 12 },

  // DeepSeek
  "deepseek-chat": { input: 0.27, output: 1.1 },
  "deepseek-reasoner": { input: 0.55, output: 2.19 },

  // Google Gemini
  "gemini-1.5-pro": { input: 1.25, output: 5 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  "gemini-1.5-flash-8b": { input: 0.0375, output: 0.15 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },

  // OpenRouter — a handful of common picks, addressed by their OpenRouter slug.
  "anthropic/claude-3.5-sonnet": { input: 3, output: 15 },
  "anthropic/claude-3-opus": { input: 15, output: 75 },
  "anthropic/claude-3-haiku": { input: 0.25, output: 1.25 },
  "openai/gpt-4o": { input: 2.5, output: 10 },
  "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
  "meta-llama/llama-3.1-70b-instruct": { input: 0.35, output: 0.4 },
  "meta-llama/llama-3.1-8b-instruct": { input: 0.05, output: 0.05 },
};

export interface CostEstimate {
  costUsd: number;
  warning?: string;
}

export interface UsageTokens {
  promptTokens?: number;
  completionTokens?: number;
}

/**
 * Estimate the USD cost of a single AI call.
 *
 * Returns a `warning` when the model isn't in our pricing table so callers can
 * surface the gap to the user (and so we don't silently report $0 for paid calls).
 */
export function estimateCost(
  provider: string,
  model: string,
  usage: UsageTokens,
): CostEstimate {
  if (provider === "ollama") {
    return { costUsd: 0 };
  }

  const pricing = MODEL_PRICING_USD_PER_1M_TOKENS[model];
  if (!pricing) {
    return {
      costUsd: 0,
      warning: `Unknown model "${model}" — cost not tracked. Add it to src/lib/ai/pricing.ts to include it in Settings → Usage totals.`,
    };
  }

  const promptTokens = usage.promptTokens ?? 0;
  const completionTokens = usage.completionTokens ?? 0;
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return { costUsd: inputCost + outputCost };
}

/**
 * True if we have a price entry for the given model. UI surfaces use this to
 * decide whether to show "Unknown model" copy next to a usage row.
 */
export function isKnownModel(model: string): boolean {
  return model in MODEL_PRICING_USD_PER_1M_TOKENS;
}
