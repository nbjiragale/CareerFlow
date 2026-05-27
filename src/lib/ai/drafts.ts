// CAREERFLOW: Phase 2 — reply-draft library. Single entry point used by
// /api/drafts/reply. Fetches the EmailThread row, re-fetches the message body
// from Gmail (since bodies are not persisted per Phase 1 PRD §13), pulls the
// linked Job context if present, calls the LLM via generateObject, and writes
// AiDraft + AiAuditLog rows.
//
// Falls back to subject + snippet only when Gmail is disconnected — better
// than 500-erroring since "confirm" and "thank-you" intents don't strictly
// need the full body.

import "server-only";

import db from "@/lib/db";
import { getModel, type ProviderType } from "@/lib/ai/providers";
import {
  REPLY_DRAFT_SYSTEM_PROMPT,
  buildReplyDraftPrompt,
} from "@/lib/ai/prompts/reply-draft";
import {
  AiReplyDraftSchema,
  type AiReplyDraftResponse,
  type ReplyDraftIntent,
} from "@/models/ai.schemas";
import { GmailNotConnectedError, getAuthorizedGmail } from "@/lib/gmail/client";
import { extractEmailBody } from "@/lib/gmail/body";
import { generateStructuredObject } from "./structured";
import { recordAiUsage } from "./audit";
import { resolveUserAiSettings } from "./resolve-settings";

export interface GenerateReplyDraftArgs {
  userId: string;
  emailThreadId: string;
  intent: ReplyDraftIntent;
  resumeSummary?: string | null;
}

export interface GenerateReplyDraftResult {
  draft: AiReplyDraftResponse;
  draftId: string;
  provider: ProviderType;
  model: string;
  costUsd: number;
  warning?: string;
  bodyWasAvailable: boolean;
  msElapsed: number;
}

/**
 * Re-fetch a Gmail message body for the most recent message in a thread.
 * Returns null when Gmail is disconnected or the fetch fails — callers
 * downgrade to subject+snippet-only context rather than erroring.
 */
async function fetchMessageBody(
  userId: string,
  gmailMessageId: string,
): Promise<string | null> {
  try {
    const { gmail } = await getAuthorizedGmail(userId);
    const res = await gmail.users.messages.get({
      userId: "me",
      id: gmailMessageId,
      format: "full",
    });
    return extractEmailBody(res.data.payload) || null;
  } catch (err) {
    if (err instanceof GmailNotConnectedError) {
      return null;
    }
    console.warn(
      "[careerflow] Reply draft: failed to refetch Gmail body; falling back to snippet:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function generateReplyDraft(
  args: GenerateReplyDraftArgs,
): Promise<GenerateReplyDraftResult> {
  const { userId, emailThreadId, intent, resumeSummary } = args;

  const thread = await db.emailThread.findFirst({
    where: { id: emailThreadId, userId },
    include: {
      Job: {
        include: {
          JobTitle: true,
          Company: true,
          Status: true,
        },
      },
    },
  });

  if (!thread) {
    throw new Error("Email thread not found.");
  }

  const body = await fetchMessageBody(userId, thread.gmailMessageId);

  const job = thread.Job
    ? {
        title: thread.Job.JobTitle?.label ?? null,
        company: thread.Job.Company?.label ?? null,
        status: thread.Job.Status?.label ?? null,
      }
    : null;

  const { provider, model } = await resolveUserAiSettings(userId);
  const startedAt = Date.now();

  try {
    const aiModel = await getModel(provider, model, userId);

    const { object: draft, usage } = await generateStructuredObject({
      model: aiModel,
      schema: AiReplyDraftSchema,
      system: REPLY_DRAFT_SYSTEM_PROMPT,
      prompt: buildReplyDraftPrompt({
        intent,
        thread: {
          subject: thread.subject,
          snippet: thread.snippet,
          fromAddress: thread.fromAddress,
          receivedAt: thread.receivedAt,
          label: thread.label,
        },
        body,
        resumeSummary,
        job,
      }),
      temperature: 0.7,
    });

    const msElapsed = Date.now() - startedAt;

    const persisted = await db.aiDraft.create({
      data: {
        userId,
        emailThreadId,
        jobId: thread.jobId ?? null,
        draftType: intent,
        subject: draft.subject ?? null,
        content: draft.body,
        tone: draft.tone,
      },
    });

    const audit = await recordAiUsage({
      userId,
      feature: "reply-draft",
      provider,
      model,
      usage: {
        promptTokens: usage?.inputTokens,
        completionTokens: usage?.outputTokens,
      },
      msElapsed,
      status: "success",
      jobId: thread.jobId ?? null,
      emailThreadId,
    });

    return {
      draft,
      draftId: persisted.id,
      provider,
      model,
      costUsd: audit?.costUsd ?? 0,
      warning: audit?.warning,
      bodyWasAvailable: body !== null,
      msElapsed,
    };
  } catch (err) {
    const msElapsed = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : "Unknown error";
    await recordAiUsage({
      userId,
      feature: "reply-draft",
      provider,
      model,
      msElapsed,
      status: "error",
      errorMessage: message,
      jobId: thread.jobId ?? null,
      emailThreadId,
    });
    throw err;
  }
}

/**
 * Return prior drafts for a thread, newest first. Used by the drawer's
 * history list and the GET /api/drafts route.
 */
export async function listDraftsForThread(
  userId: string,
  emailThreadId: string,
) {
  return db.aiDraft.findMany({
    where: { userId, emailThreadId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Return prior outreach drafts for a job, newest first. Used by the
 * OutreachDrawer history list and the GET /api/drafts?jobId=... route.
 * Scoped to outreach drafts so it doesn't surface follow-up/reply drafts.
 */
export async function listDraftsForJob(userId: string, jobId: string) {
  return db.aiDraft.findMany({
    where: { userId, jobId, draftType: { startsWith: "outreach-" } },
    orderBy: { createdAt: "desc" },
  });
}
