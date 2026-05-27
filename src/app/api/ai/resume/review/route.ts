import "server-only";

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { getModel } from "@/lib/ai/providers";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import {
  ResumeReviewSchema,
  RESUME_REVIEW_SYSTEM_PROMPT,
  buildResumeReviewPrompt,
  structuredObjectToResponse,
} from "@/lib/ai";
import { preprocessResumeWithFile } from "@/lib/ai/resume-text";
import { recordAiUsage } from "@/lib/ai/audit";
import { mapAiRouteError, resolveModelName } from "@/lib/ai/route-helpers";
import { getResumeById } from "@/actions/profile.actions";
import { AiModel } from "@/models/ai.model";

/**
 * Resume Review Endpoint
 * Single comprehensive LLM call for complete resume analysis
 */
export const POST = async (req: NextRequest) => {
  const session = await auth();
  const userId = session?.user?.id;

  if (!session || !userId) {
    return NextResponse.json({ message: "Not Authenticated" }, { status: 401 });
  }

  // Rate limiting
  const rateLimit = checkRateLimit(userId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded. Try again in ${Math.ceil(
          rateLimit.resetIn / 1000,
        )} seconds.`,
      },
      { status: 429 },
    );
  }

  const { selectedModel, resumeId } = (await req.json()) as {
    selectedModel: AiModel;
    resumeId: string;
  };

  if (!resumeId || !selectedModel) {
    return NextResponse.json(
      { error: "Resume ID and model selection required" },
      { status: 400 },
    );
  }

  try {
    const { data: resume } = await getResumeById(resumeId);
    if (!resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const preprocessResult = await preprocessResumeWithFile(resume);
    if (!preprocessResult.success) {
      return NextResponse.json(
        {
          error: preprocessResult.error.message,
          code: preprocessResult.error.code,
        },
        { status: 400 },
      );
    }
    const { normalizedText } = preprocessResult.data;

    const modelName = resolveModelName(selectedModel);
    const model = await getModel(selectedModel.provider, modelName, userId);
    const startedAt = Date.now();

    // Single comprehensive LLM call. We use the non-streaming helper rather
    // than streamText({ output: Output.object(...) }) so that we get an
    // automatic generateText-with-JSON-Schema fallback whenever the provider
    // rejects our JSON Schema (Gemini, some OpenRouter proxies) or returns
    // prose instead of structured output (smaller Ollama models). The
    // useObject() client hook still parses the single-chunk JSON response
    // correctly — we just lose the progressive-streaming UX.
    return await structuredObjectToResponse(
      {
        model,
        schema: ResumeReviewSchema,
        system: RESUME_REVIEW_SYSTEM_PROMPT,
        prompt: buildResumeReviewPrompt(normalizedText),
        temperature: 0.3,
      },
      undefined,
      // Record usage so resume reviews show up in Settings → Usage like every
      // other AI feature (previously Review was the only one not audited).
      async ({ usage }) => {
        await recordAiUsage({
          userId,
          feature: "resume-review",
          provider: selectedModel.provider,
          model: modelName,
          usage: {
            promptTokens: usage?.inputTokens,
            completionTokens: usage?.outputTokens,
          },
          msElapsed: Date.now() - startedAt,
          status: "success",
        });
      },
    );
  } catch (error) {
    console.error("Resume review error:", error);
    return mapAiRouteError(error, selectedModel.provider);
  }
};
