// CAREERFLOW: unit tests for src/lib/ai/structured.ts.
//
// generateStructuredObject should:
//   - Return the object as-is on the happy path (generateObject succeeds).
//   - Fall back to generateText when generateObject throws
//     NoObjectGeneratedError (e.g. OpenRouter-proxied model that returns
//     prose instead of structured output).
//   - Fall back to generateText when generateObject throws APICallError
//     with statusCode === 400 (e.g. Gemini rejecting minItems/maxItems
//     constraints in the JSON Schema).
//   - NOT fall back on APICallError with non-400 status (401 auth,
//     429 quota, 5xx) — those bubble up unchanged so the user sees the
//     real config / transport problem.
//   - NOT fall back on unrelated error classes (plain Error, network
//     errors).
//   - Throw StructuredOutputUnsupportedError when the fallback text
//     also can't be parsed into the schema.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("ai", () => {
  class NoObjectGeneratedError extends Error {
    static isInstance(err: unknown): err is Error {
      return err instanceof NoObjectGeneratedError;
    }
  }
  class APICallError extends Error {
    statusCode?: number;
    constructor(message: string, statusCode?: number) {
      super(message);
      this.statusCode = statusCode;
      this.name = "AI_APICallError";
    }
    static isInstance(err: unknown): err is APICallError {
      return err instanceof APICallError;
    }
  }
  return {
    generateObject: vi.fn(),
    generateText: vi.fn(),
    NoObjectGeneratedError,
    APICallError,
  };
});

import {
  generateObject,
  generateText,
  NoObjectGeneratedError,
  APICallError,
} from "ai";
import {
  generateStructuredObject,
  StructuredOutputUnsupportedError,
} from "@/lib/ai/structured";

const generateObjectMock = generateObject as unknown as ReturnType<typeof vi.fn>;
const generateTextMock = generateText as unknown as ReturnType<typeof vi.fn>;

const Schema = z.object({
  name: z.string(),
  age: z.number().min(0).max(150),
});

const baseArgs = {
  model: { id: "fake-model" } as unknown as Parameters<
    typeof generateStructuredObject
  >[0]["model"],
  schema: Schema,
  system: "You are a test.",
  prompt: "Return a person.",
  temperature: 0.3,
};

describe("generateStructuredObject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the object from generateObject on the happy path", async () => {
    generateObjectMock.mockResolvedValue({
      object: { name: "Ada", age: 30 },
      usage: { inputTokens: 100, outputTokens: 50 },
    });

    const result = await generateStructuredObject(baseArgs);

    expect(result.object).toEqual({ name: "Ada", age: 30 });
    expect(result.usedFallback).toBe(false);
    expect(result.usage?.inputTokens).toBe(100);
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("falls back to generateText on NoObjectGeneratedError", async () => {
    generateObjectMock.mockRejectedValue(
      new (NoObjectGeneratedError as unknown as new (msg: string) => Error)(
        "no object",
      ),
    );
    generateTextMock.mockResolvedValue({
      text: '```json\n{"name":"Ada","age":30}\n```',
      usage: { inputTokens: 10, outputTokens: 20 },
    });

    const result = await generateStructuredObject(baseArgs);

    expect(result.object).toEqual({ name: "Ada", age: 30 });
    expect(result.usedFallback).toBe(true);
    expect(generateTextMock).toHaveBeenCalledTimes(1);
    const fallbackArgs = generateTextMock.mock.calls[0][0];
    expect(fallbackArgs.prompt).toContain("Return ONLY a single valid JSON");
    expect(fallbackArgs.prompt).toContain("JSON Schema");
  });

  it("falls back to generateText on APICallError with statusCode=400", async () => {
    generateObjectMock.mockRejectedValue(
      new (APICallError as unknown as new (msg: string, status?: number) => Error)(
        "Schema rejected: minItems not supported",
        400,
      ),
    );
    generateTextMock.mockResolvedValue({
      text: '{"name":"Grace","age":42}',
      usage: { inputTokens: 50, outputTokens: 25 },
    });

    const result = await generateStructuredObject(baseArgs);

    expect(result.object).toEqual({ name: "Grace", age: 42 });
    expect(result.usedFallback).toBe(true);
    expect(generateTextMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT fall back on APICallError with statusCode=401 (auth)", async () => {
    const authErr = new (APICallError as unknown as new (
      msg: string,
      status?: number,
    ) => Error)("Incorrect API key", 401);
    generateObjectMock.mockRejectedValue(authErr);

    await expect(generateStructuredObject(baseArgs)).rejects.toThrow(
      "Incorrect API key",
    );
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("does NOT fall back on APICallError with statusCode=429 (quota)", async () => {
    const rateErr = new (APICallError as unknown as new (
      msg: string,
      status?: number,
    ) => Error)("Rate limit exceeded", 429);
    generateObjectMock.mockRejectedValue(rateErr);

    await expect(generateStructuredObject(baseArgs)).rejects.toThrow(
      "Rate limit exceeded",
    );
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("does NOT fall back on APICallError with statusCode=500 (transport)", async () => {
    const serverErr = new (APICallError as unknown as new (
      msg: string,
      status?: number,
    ) => Error)("Upstream 500", 500);
    generateObjectMock.mockRejectedValue(serverErr);

    await expect(generateStructuredObject(baseArgs)).rejects.toThrow(
      "Upstream 500",
    );
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("does NOT fall back on unrelated error classes (plain Error)", async () => {
    generateObjectMock.mockRejectedValue(new Error("network ECONNRESET"));

    await expect(generateStructuredObject(baseArgs)).rejects.toThrow(
      "network ECONNRESET",
    );
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("throws StructuredOutputUnsupportedError when fallback text can't be parsed", async () => {
    generateObjectMock.mockRejectedValue(
      new (NoObjectGeneratedError as unknown as new (msg: string) => Error)(
        "no object",
      ),
    );
    generateTextMock.mockResolvedValue({
      text: "I cannot help with that request.",
      usage: { inputTokens: 5, outputTokens: 5 },
    });

    await expect(generateStructuredObject(baseArgs)).rejects.toBeInstanceOf(
      StructuredOutputUnsupportedError,
    );
  });

  it("throws StructuredOutputUnsupportedError when fallback JSON fails Zod validation", async () => {
    generateObjectMock.mockRejectedValue(
      new (APICallError as unknown as new (msg: string, status?: number) => Error)(
        "Schema rejected",
        400,
      ),
    );
    generateTextMock.mockResolvedValue({
      // Missing required `age` field — Zod will reject.
      text: '{"name":"Linus"}',
      usage: { inputTokens: 5, outputTokens: 5 },
    });

    await expect(generateStructuredObject(baseArgs)).rejects.toBeInstanceOf(
      StructuredOutputUnsupportedError,
    );
  });

  it("uses the supplied retry hint in StructuredOutputUnsupportedError", async () => {
    generateObjectMock.mockRejectedValue(
      new (NoObjectGeneratedError as unknown as new (msg: string) => Error)(
        "no object",
      ),
    );
    generateTextMock.mockResolvedValue({
      text: "nope",
      usage: { inputTokens: 5, outputTokens: 5 },
    });

    await expect(
      generateStructuredObject(baseArgs, "Try a draft-friendly model."),
    ).rejects.toThrow("Try a draft-friendly model.");
  });

  it("extracts JSON from text wrapped in prose and code fences", async () => {
    generateObjectMock.mockRejectedValue(
      new (NoObjectGeneratedError as unknown as new (msg: string) => Error)(
        "no object",
      ),
    );
    generateTextMock.mockResolvedValue({
      text: 'Here you go:\n```json\n{"name":"Hopper","age":85}\n```\nHope that helps!',
      usage: { inputTokens: 10, outputTokens: 20 },
    });

    const result = await generateStructuredObject(baseArgs);
    expect(result.object).toEqual({ name: "Hopper", age: 85 });
  });
});
