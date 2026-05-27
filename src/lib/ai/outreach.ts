// CAREERFLOW: recruiter / LinkedIn outreach draft library. Generates a short,
// personalized outreach message (connection request, InMail, referral ask, or
// follow-up nudge) for a job the candidate is targeting. Mirrors the follow-up
// plumbing: job-based (no Gmail thread), persists an AiDraft and returns the
// text. Draft-only — never sends.

import "server-only";

import db from "@/lib/db";
import { getModel, type ProviderType } from "@/lib/ai/providers";
import { convertResumeToText, removeHtmlTags } from "@/lib/ai";
import {
  OUTREACH_DRAFT_SYSTEM_PROMPT,
  buildOutreachDraftPrompt,
} from "@/lib/ai/prompts/outreach-draft";
import {
  AiReplyDraftSchema,
  type AiReplyDraftResponse,
  type OutreachIntent,
} from "@/models/ai.schemas";
import { getResumeById } from "@/actions/profile.actions";
import { generateStructuredObject } from "./structured";
import { recordAiUsage } from "./audit";
import { resolveUserAiSettings } from "./resolve-settings";

export interface GenerateOutreachDraftArgs {
  userId: string;
  jobId: string;
  intent: OutreachIntent;
  recipientName?: string | null;
  recipientRole?: string | null;
}

export interface GenerateOutreachDraftResult {
  draft: AiReplyDraftResponse;
  draftId: string;
  provider: ProviderType;
  model: string;
  costUsd: number;
  warning?: string;
  msElapsed: number;
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

export async function generateOutreachDraft(
  args: GenerateOutreachDraftArgs,
): Promise<GenerateOutreachDraftResult> {
  const { userId, jobId, intent, recipientName, recipientRole } = args;

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
      system: OUTREACH_DRAFT_SYSTEM_PROMPT,
      prompt: buildOutreachDraftPrompt({
        intent,
        company: job.Company?.label ?? "the company",
        role: job.JobTitle?.label ?? "the role",
        jdExcerpt: job.description ? removeHtmlTags(job.description) : null,
        resumeSummary,
        recipientName: recipientName ?? null,
        recipientRole: recipientRole ?? null,
      }),
      temperature: 0.6,
    });

    const msElapsed = Date.now() - startedAt;

    const audit = await recordAiUsage({
      userId,
      feature: "outreach-draft",
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
        draftType: `outreach-${intent}`,
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
      feature: "outreach-draft",
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
