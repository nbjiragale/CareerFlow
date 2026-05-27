import "server-only";

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { getModel } from "@/lib/ai/providers";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import {
  JobMatchSchema,
  JOB_MATCH_SYSTEM_PROMPT,
  buildJobMatchPrompt,
  preprocessJob,
  structuredObjectToResponse,
} from "@/lib/ai";
import { preprocessResumeWithFile } from "@/lib/ai/resume-text";
import { mapAiRouteError, resolveModelName } from "@/lib/ai/route-helpers";
import { getResumeById } from "@/actions/profile.actions";
import { getJobDetails } from "@/actions/job.actions";
import { AiModel } from "@/models/ai.model";

/**
 * Job Match Endpoint
 * Single comprehensive LLM call for resume-job matching
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

  const { resumeId, jobId, selectedModel } = (await req.json()) as {
    resumeId: string;
    jobId: string;
    selectedModel: AiModel;
  };

  if (!resumeId || !jobId || !selectedModel) {
    return NextResponse.json(
      { error: "Resume ID, Job ID, and model selection required" },
      { status: 400 },
    );
  }

  try {
    const [{ data: resume }, { job }] = await Promise.all([
      getResumeById(resumeId),
      getJobDetails(jobId),
    ]);

    // Preprocess both resume and job description
    const [resumePreprocessResult, jobPreprocessResult] = await Promise.all([
      preprocessResumeWithFile(resume),
      preprocessJob(job),
    ]);

    if (!resumePreprocessResult.success) {
      return NextResponse.json(
        {
          error: resumePreprocessResult.error.message,
          code: resumePreprocessResult.error.code,
        },
        { status: 400 },
      );
    }

    if (!jobPreprocessResult.success) {
      return NextResponse.json(
        {
          error: jobPreprocessResult.error.message,
          code: jobPreprocessResult.error.code,
        },
        { status: 400 },
      );
    }

    const { normalizedText: resumeText } = resumePreprocessResult.data;
    const { normalizedText: jobText } = jobPreprocessResult.data;

    const model = await getModel(
      selectedModel.provider,
      resolveModelName(selectedModel),
      userId,
    );

    // Single comprehensive LLM call. See /api/ai/resume/review for why we
    // use the non-streaming helper instead of streamText({ output:
    // Output.object(...) }) — same Gemini / OpenRouter / Ollama reliability
    // concerns apply here.
    return await structuredObjectToResponse({
      model,
      schema: JobMatchSchema,
      system: JOB_MATCH_SYSTEM_PROMPT,
      prompt: buildJobMatchPrompt(resumeText, jobText),
      temperature: 0.3,
    });
  } catch (error) {
    console.error("Job match error:", error);
    return mapAiRouteError(error, selectedModel.provider);
  }
};
