// CAREERFLOW: non-streaming Job Match library. Sibling of runJdEvaluation /
// runResumeTailor — the streaming /api/ai/resume/match route stays as-is for
// the per-job sheet UI; this server-side entry point is what the
// match-and-tailor orchestrator calls so it can sequence match between the
// evaluation and the tailor in a single request.

import "server-only";

import db from "@/lib/db";
import { getModel, type ProviderType } from "@/lib/ai/providers";
import {
  JobMatchSchema,
  JOB_MATCH_SYSTEM_PROMPT,
  buildJobMatchPrompt,
  preprocessJob,
} from "@/lib/ai";
import { preprocessResumeWithFile } from "@/lib/ai/resume-text";
import type { JobMatchResponse } from "@/models/ai.schemas";
import { getResumeById } from "@/actions/profile.actions";
import { getJobDetails } from "@/actions/job.actions";
import { generateStructuredObject } from "./structured";
import { recordAiUsage } from "./audit";
import { resolveUserAiSettings } from "./resolve-settings";

export interface RunJobMatchArgs {
  userId: string;
  resumeId: string;
  jobId: string;
}

export interface RunJobMatchResult {
  match: JobMatchResponse;
  provider: ProviderType;
  model: string;
  costUsd: number;
  warning?: string;
  msElapsed: number;
}

/**
 * Run a single resume↔job match. Loads the resume + job, preprocesses both to
 * normalized text, calls the user's configured model with JobMatchSchema, and
 * persists matchScore + matchData onto the Job. Records an AiAuditLog row on
 * both success and failure.
 */
export async function runJobMatch(
  args: RunJobMatchArgs,
): Promise<RunJobMatchResult> {
  const { userId, resumeId, jobId } = args;

  const { provider, model } = await resolveUserAiSettings(userId);
  const startedAt = Date.now();

  try {
    const [{ data: resume }, { job }] = await Promise.all([
      getResumeById(resumeId),
      getJobDetails(jobId),
    ]);

    const [resumePre, jobPre] = await Promise.all([
      preprocessResumeWithFile(resume),
      preprocessJob(job),
    ]);

    if (!resumePre.success) {
      throw new Error(resumePre.error.message);
    }
    if (!jobPre.success) {
      throw new Error(jobPre.error.message);
    }

    const aiModel = await getModel(provider, model, userId);

    const { object: match, usage } = await generateStructuredObject({
      model: aiModel,
      schema: JobMatchSchema,
      system: JOB_MATCH_SYSTEM_PROMPT,
      prompt: buildJobMatchPrompt(
        resumePre.data.normalizedText,
        jobPre.data.normalizedText,
      ),
      temperature: 0.3,
    });

    const msElapsed = Date.now() - startedAt;

    const audit = await recordAiUsage({
      userId,
      feature: "job-match",
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

    const matchData = JSON.stringify({
      ...match,
      resumeId,
      matchedAt: new Date().toISOString(),
    });
    await db.job.update({
      where: { id: jobId, userId },
      data: { matchScore: Math.round(match.matchScore), matchData },
    });

    return {
      match,
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
      feature: "job-match",
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
