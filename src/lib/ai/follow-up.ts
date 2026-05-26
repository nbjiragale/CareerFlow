// CAREERFLOW: follow-up draft library. Generates a ready-to-send follow-up
// email for a job the candidate applied to but hasn't heard back on. Mirrors
// the reply-draft plumbing but is job-based (no Gmail thread required) since a
// post-application follow-up usually has no inbound email yet. Draft-only:
// persists an AiDraft and returns the text; never sends.

import "server-only";

import db from "@/lib/db";
import { getModel, type ProviderType } from "@/lib/ai/providers";
import { convertResumeToText, removeHtmlTags } from "@/lib/ai";
import {
  FOLLOW_UP_DRAFT_SYSTEM_PROMPT,
  buildFollowUpDraftPrompt,
} from "@/lib/ai/prompts/follow-up-draft";
import {
  AiReplyDraftSchema,
  type AiReplyDraftResponse,
} from "@/models/ai.schemas";
import { getResumeById } from "@/actions/profile.actions";
import { generateStructuredObject } from "./structured";
import { recordAiUsage } from "./audit";
import { resolveUserAiSettings } from "./resolve-settings";

export interface GenerateFollowUpDraftArgs {
  userId: string;
  jobId: string;
}

export interface GenerateFollowUpDraftResult {
  draft: AiReplyDraftResponse;
  draftId: string;
  provider: ProviderType;
  model: string;
  costUsd: number;
  warning?: string;
  msElapsed: number;
}

function daysSince(date: Date | null | undefined): number | null {
  if (!date) return null;
  const ms = Date.now() - date.getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

async function loadResumeSummary(
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

export async function generateFollowUpDraft(
  args: GenerateFollowUpDraftArgs,
): Promise<GenerateFollowUpDraftResult> {
  const { userId, jobId } = args;

  const job = await db.job.findUnique({
    where: { id: jobId, userId },
    include: { JobTitle: true, Company: true },
  });
  if (!job) throw new Error("Job not found.");

  const { provider, model } = await resolveUserAiSettings(userId);
  const startedAt = Date.now();

  try {
    const resumeSummary = await loadResumeSummary(job.resumeId);
    const aiModel = await getModel(provider, model, userId);

    const { object: draft, usage } = await generateStructuredObject({
      model: aiModel,
      schema: AiReplyDraftSchema,
      system: FOLLOW_UP_DRAFT_SYSTEM_PROMPT,
      prompt: buildFollowUpDraftPrompt({
        company: job.Company?.label ?? "the company",
        role: job.JobTitle?.label ?? "the role",
        daysSinceApplied: daysSince(job.appliedDate ?? job.createdAt),
        jdExcerpt: job.description ? removeHtmlTags(job.description) : null,
        resumeSummary,
      }),
      temperature: 0.5,
    });

    const msElapsed = Date.now() - startedAt;

    const audit = await recordAiUsage({
      userId,
      feature: "follow-up-draft",
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

    const created = await db.aiDraft.create({
      data: {
        userId,
        jobId,
        draftType: "follow-up",
        subject: draft.subject ?? null,
        content: draft.body,
        tone: draft.tone ?? null,
      },
    });

    return {
      draft,
      draftId: created.id,
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
      feature: "follow-up-draft",
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
