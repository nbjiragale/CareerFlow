// CAREERFLOW: tests for the shared AI-route helpers extracted from the
// review/match routes (model-name fallback + error→HTTP mapping).

import { describe, it, expect } from "vitest";
import type { AiModel } from "@/models/ai.model";
import {
  mapAiRouteError,
  resolveModelName,
  DEFAULT_OLLAMA_MODEL,
} from "@/lib/ai/route-helpers";
import { StructuredOutputUnsupportedError } from "@/lib/ai/structured";

describe("resolveModelName", () => {
  it("uses the selected model when present", () => {
    const m = { provider: "openai", model: "gpt-4o-mini" } as AiModel;
    expect(resolveModelName(m)).toBe("gpt-4o-mini");
  });

  it("falls back to the default ollama model when unset", () => {
    const m = { provider: "ollama", model: "" } as AiModel;
    expect(resolveModelName(m)).toBe(DEFAULT_OLLAMA_MODEL);
  });
});

describe("mapAiRouteError", () => {
  it("maps structured-output errors to 422 with a code", async () => {
    const res = mapAiRouteError(
      new StructuredOutputUnsupportedError("try a stronger model"),
      "ollama",
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("structured_output_unsupported");
  });

  it("maps connection failures to 503 naming the provider", async () => {
    const res = mapAiRouteError(new Error("fetch failed"), "ollama");
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain("ollama");
  });

  it("maps unknown errors to 500", async () => {
    const res = mapAiRouteError(new Error("boom"), "openai");
    expect(res.status).toBe(500);
  });
});
