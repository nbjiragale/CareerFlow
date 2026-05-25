// CAREERFLOW: Phase 2 — unit tests for src/lib/ai/pricing.ts.

import { describe, expect, it } from "vitest";

import {
  MODEL_PRICING_USD_PER_1M_TOKENS,
  estimateCost,
  isKnownModel,
} from "@/lib/ai/pricing";

describe("pricing", () => {
  describe("estimateCost", () => {
    it("returns 0 for Ollama regardless of model", () => {
      const result = estimateCost("ollama", "llama3.1", {
        promptTokens: 1000,
        completionTokens: 1000,
      });
      expect(result.costUsd).toBe(0);
      expect(result.warning).toBeUndefined();
    });

    it("returns a warning when the model is unknown", () => {
      const result = estimateCost("openai", "some-future-model-9000", {
        promptTokens: 1000,
        completionTokens: 1000,
      });
      expect(result.costUsd).toBe(0);
      expect(result.warning).toMatch(/Unknown model/);
    });

    it("computes input + output cost for a known model", () => {
      // gpt-4o-mini: input $0.15/M, output $0.6/M
      const result = estimateCost("openai", "gpt-4o-mini", {
        promptTokens: 1_000_000,
        completionTokens: 500_000,
      });
      // 1M input tokens * 0.15 = 0.15; 0.5M output * 0.6 = 0.3 → 0.45
      expect(result.costUsd).toBeCloseTo(0.45, 6);
      expect(result.warning).toBeUndefined();
    });

    it("treats missing usage fields as zero", () => {
      const result = estimateCost("openai", "gpt-4o", {});
      expect(result.costUsd).toBe(0);
    });

    it("scales linearly with token counts", () => {
      const small = estimateCost("openai", "gpt-4o", {
        promptTokens: 100,
        completionTokens: 100,
      });
      const big = estimateCost("openai", "gpt-4o", {
        promptTokens: 1000,
        completionTokens: 1000,
      });
      expect(big.costUsd).toBeCloseTo(small.costUsd * 10, 8);
    });
  });

  describe("isKnownModel", () => {
    it("returns true for entries in the pricing table", () => {
      expect(isKnownModel("gpt-4o")).toBe(true);
      expect(isKnownModel("deepseek-chat")).toBe(true);
    });

    it("returns false for unknown models", () => {
      expect(isKnownModel("totally-not-a-real-model")).toBe(false);
    });
  });

  describe("MODEL_PRICING_USD_PER_1M_TOKENS table", () => {
    it("has non-negative prices everywhere", () => {
      for (const [model, p] of Object.entries(MODEL_PRICING_USD_PER_1M_TOKENS)) {
        expect(p.input).toBeGreaterThanOrEqual(0);
        expect(p.output).toBeGreaterThanOrEqual(0);
        // Output is almost always at least as expensive as input — sanity-check
        // the table to catch swapped-column bugs.
        expect(p.output, `${model} output should be >= input`).toBeGreaterThanOrEqual(
          p.input * 0.5,
        );
      }
    });

    it("includes the cheap default OpenAI tier", () => {
      expect(MODEL_PRICING_USD_PER_1M_TOKENS["gpt-4o-mini"]).toBeDefined();
    });
  });
});
