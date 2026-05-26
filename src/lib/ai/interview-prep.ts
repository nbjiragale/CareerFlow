// CAREERFLOW: Interview Copilot library. Generates a prep brief for a job in
// the interview stage and caches it on the Job (interviewPrepJson). Re-uses the
// same provider/model + structured-output + AiAuditLog plumbing as the other
// AI features. Caching is the cost guard: a brief is generated once on demand
// and reused on every subsequent view unless `force` is passed.

import "server-only";

import db from "@/lib/db";
import { getModel, type ProviderType } from "@/lib/ai/providers";
import {
  INTERVIEW_PREP_SYSTEM_PROMPT,
  buildInterviewPrepPrompt,
} from "@/lib/ai/prompts/interview-prep";
import { convertResumeToText } from "@/lib/ai";
import {
  InterviewPrepSchema,
  type InterviewPrepResponse,
} from "@/models/ai.schemas";
import { getResumeById } from "@/actions/profile.actions";
import { generateStructuredObject } from "./structured";
import { recordAiUsage } from "./audit";
import { resolveUserAiSettings } from "./resolve-settings";

export interface RunInterviewPrepArgs {
  userId: string;
  jobId: string;
  // Force regeneration even when a cached brief exists.
  force?: boolean;
}

export interface RunInterviewPrepResult {
  prep: InterviewPrepResponse;
  cached: boolean;
  preppedAt: string;
  provider: ProviderType;
  model: string;
  costUsd: number;
  warning?: string;
  msElapsed: number;
}

async function loadResumeText(
  resumeId: string | null | undefined,
): Promise<string | null> {
  if (!resumeId) return null;
  try {
    const { data: resume } = await getResumeById(resumeId);
    if (!resume) return null;
    const text = await convertResumeToText(resume);
    return text?.trim() ? text : null;
  } catch {
    return null;
  }
}

export async function runInterviewPrep(
  args: RunInterviewPrepArgs,
): Promise<RunInterviewPrepResult> {
  const { userId, jobId, force } = args;

  const job = await db.job.findUnique({
    where: { id: jobId, userId },
    include: { JobTitle: true, Company: true },
  });
  if (!job) throw new Error("Job not found.");
  if (!job.description?.trim()) {
    throw new Error("This job has no description — add a JD before prepping.");
  }

  // Cache hit: return the stored brief without spending tokens.
  if (!force && job.interviewPrepJson) {
    try {
      const prep = InterviewPrepSchema.parse(JSON.parse(job.interviewPrepJson));
      return {
        prep,
        cached: true,
        preppedAt:
          job.interviewPreppedAt?.toISOString() ?? new Date().toISOString(),
        provider: "openai" as ProviderType,
        model: "cached",
        costUsd: 0,
        msElapsed: 0,
      };
    } catch {
      // Corrupt cache — fall through and regenerate.
    }
  }

  const { provider, model } = await resolveUserAiSettings(userId);
  const startedAt = Date.now();

  try {
    const resumeText = await loadResumeText(job.resumeId);
    const aiModel = await getModel(provider, model, userId);

    const { object: prep, usage } = await generateStructuredObject({
      model: aiModel,
      schema: InterviewPrepSchema,
      system: INTERVIEW_PREP_SYSTEM_PROMPT,
      prompt: buildInterviewPrepPrompt({
        company: job.Company?.label ?? "the company",
        role: job.JobTitle?.label ?? "the role",
        jdText: job.description,
        resumeText,
      }),
      temperature: 0.4,
    });

    const msElapsed = Date.now() - startedAt;
    const preppedAt = new Date();

    const audit = await recordAiUsage({
      userId,
      feature: "interview-prep",
      provider,
      model,
      usage: {
        promptTokens: usage?.inputTokens,
        completionTokens: usage?.outputTokens,
      },
      msElapsed,
      status: "success",
      jobId,
    });

    await db.job.update({
      where: { id: jobId, userId },
      data: {
        interviewPrepJson: JSON.stringify(prep),
        interviewPreppedAt: preppedAt,
      },
    });

    return {
      prep,
      cached: false,
      preppedAt: preppedAt.toISOString(),
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
      feature: "interview-prep",
      provider,
      model,
      msElapsed,
      status: "error",
      errorMessage: message,
      jobId,
    });
    throw err;
  }
}
