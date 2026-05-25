// CAREERFLOW: shared structured-output helper used by /api/evaluate,
// /api/drafts/reply, /api/ai/resume/review and /api/ai/resume/match.
// Wraps Vercel AI SDK's generateObject in a generateText-with-JSON-Schema
// fallback so we can still produce a schema-valid object when the provider
// either:
//
//   (1) rejects the JSON Schema with HTTP 400 (APICallError) — common on
//       Gemini and some OpenRouter-proxied models whose structured-output
//       mode doesn't support minItems / maxItems / minimum / maximum /
//       nested-object constraints; or
//   (2) returns text the SDK can't coerce into the schema
//       (NoObjectGeneratedError) — common on smaller / non-tool-calling
//       OpenRouter and Ollama models.
//
// All other errors (401, 403, 404, 429, 5xx, network failures) propagate
// unchanged so the user sees real auth/quota/transport problems instead of
// silent retries.

import "server-only";

import {
  generateObject,
  generateText,
  APICallError,
  NoObjectGeneratedError,
  type LanguageModel,
} from "ai";
import { z } from "zod";

export interface GenerateStructuredArgs<T extends z.ZodTypeAny> {
  model: LanguageModel;
  schema: T;
  system: string;
  prompt: string;
  temperature?: number;
}

export interface GenerateStructuredResult<T> {
  object: T;
  usage?: { inputTokens?: number; outputTokens?: number };
  usedFallback: boolean;
}

export class StructuredOutputUnsupportedError extends Error {
  constructor(hint: string) {
    super(
      `The selected model did not return a valid structured response. ${hint}`,
    );
    this.name = "StructuredOutputUnsupportedError";
  }
}

const DEFAULT_RETRY_HINT =
  "Try a model that supports structured/JSON output (e.g. openai/gpt-4o-mini, anthropic/claude-3.5-sonnet).";

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

function isSchemaRejection(err: unknown): boolean {
  if (!APICallError.isInstance(err)) return false;
  // Provider returned 400 after we sent a json_schema response_format. Other
  // 4xx (401 auth, 403 forbidden, 404 model, 429 quota) and all 5xx are real
  // transport / config problems — never retry those silently.
  return err.statusCode === 400;
}

export async function generateStructuredObject<T extends z.ZodTypeAny>(
  args: GenerateStructuredArgs<T>,
  retryHint: string = DEFAULT_RETRY_HINT,
): Promise<GenerateStructuredResult<z.infer<T>>> {
  try {
    const { object, usage } = await generateObject({
      model: args.model,
      schema: args.schema,
      system: args.system,
      prompt: args.prompt,
      temperature: args.temperature,
    });
    // generateObject's generic return type doesn't unify with z.infer<T> for
    // arbitrary Zod schemas, even though the runtime contract is identical
    // (the SDK has already validated against args.schema). Cast through
    // unknown so callers get the correct inferred type without leaking the
    // SDK's internal generics.
    return {
      object: object as unknown as z.infer<T>,
      usage,
      usedFallback: false,
    };
  } catch (err) {
    if (!NoObjectGeneratedError.isInstance(err) && !isSchemaRejection(err)) {
      throw err;
    }

    const jsonSchema = z.toJSONSchema(args.schema);
    const { text, usage } = await generateText({
      model: args.model,
      system: args.system,
      prompt: `${args.prompt}\n\nReturn ONLY a single valid JSON object — no markdown code fences, no commentary before or after — conforming exactly to this JSON Schema:\n${JSON.stringify(
        jsonSchema,
      )}`,
      temperature: args.temperature,
    });

    let object: z.infer<T>;
    try {
      object = args.schema.parse(extractJsonObject(text));
    } catch {
      throw new StructuredOutputUnsupportedError(retryHint);
    }

    return { object, usage, usedFallback: true };
  }
}

/**
 * Emit a structured-output result as a single-chunk plain-text Response that
 * the Vercel AI SDK's `experimental_useObject` React hook can consume. We
 * lose progressive streaming UX (the client sees a single arrival of the
 * whole JSON), but we gain reliability across providers whose structured
 * streaming mode rejects our JSON Schemas (Gemini, some OpenRouter
 * proxies, smaller Ollama models).
 *
 * Used by the streaming Resume Review / Job Match endpoints that previously
 * called `streamText({ output: Output.object({...}) })` and had no fallback
 * path when the provider rejected the schema mid-stream.
 */
export async function structuredObjectToResponse<T extends z.ZodTypeAny>(
  args: GenerateStructuredArgs<T>,
  retryHint?: string,
): Promise<Response> {
  const { object } = await generateStructuredObject(args, retryHint);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(JSON.stringify(object)));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
