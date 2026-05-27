// CAREERFLOW: shared helpers for the AI resume routes (review, match) so they
// don't each re-implement model-name resolution and error→HTTP mapping.

import "server-only";

import { NextResponse } from "next/server";

import { AIUnavailableError } from "@/lib/ai";
import { StructuredOutputUnsupportedError } from "@/lib/ai/structured";
import type { AiModel } from "@/models/ai.model";

// Fallback model when the client didn't pin one (Ollama's default local model).
export const DEFAULT_OLLAMA_MODEL = "llama3.2";

export function resolveModelName(selectedModel: AiModel): string {
  return selectedModel.model || DEFAULT_OLLAMA_MODEL;
}

/**
 * Map an AI error to the HTTP response the resume routes return. Behavior is
 * identical to the inline blocks these routes used to duplicate.
 */
export function mapAiRouteError(
  error: unknown,
  provider: string,
): NextResponse {
  if (error instanceof AIUnavailableError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  if (error instanceof StructuredOutputUnsupportedError) {
    return NextResponse.json(
      { error: error.message, code: "structured_output_unsupported" },
      { status: 422 },
    );
  }

  const message = error instanceof Error ? error.message : "AI request failed";

  if (message.includes("fetch failed") || message.includes("ECONNREFUSED")) {
    return NextResponse.json(
      {
        error: `Cannot connect to ${provider} service. Please ensure the service is running.`,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ error: message }, { status: 500 });
}
