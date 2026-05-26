// CAREERFLOW: Phase 2 — single helper that persists an AiAuditLog row for every
// paid AI call. Used by evaluate.ts and drafts.ts. Errors are caught and logged
// rather than re-thrown so a failed audit write never breaks the caller's
// happy path (the user already got their result; we just lose the metric).

import "server-only";

import db from "@/lib/db";
import { estimateCost, type UsageTokens } from "./pricing";

export type AiFeature =
  | "evaluate"
  | "reply-draft"
  | "resume-tailor"
  | "job-match";
export type AiAuditStatus = "success" | "error";

export interface RecordAiUsageArgs {
  userId: string;
  feature: AiFeature;
  provider: string;
  model: string;
  usage?: UsageTokens;
  msElapsed: number;
  status: AiAuditStatus;
  errorMessage?: string;
  jobId?: string | null;
  emailThreadId?: string | null;
}

export interface RecordedAiUsage {
  id: string;
  costUsd: number;
  warning?: string;
}

/**
 * Persist a single AI call into AiAuditLog. The Vercel AI SDK returns a `usage`
 * object on every call; callers pass it (or undefined on failure) and we
 * convert tokens → USD via the static pricing table.
 *
 * Returns the recorded row id and the cost estimate so callers can echo it
 * back in their HTTP response if they want. Never throws — DB failures are
 * swallowed and logged.
 */
export async function recordAiUsage(
  args: RecordAiUsageArgs,
): Promise<RecordedAiUsage | null> {
  const usage = args.usage ?? {};
  const { costUsd, warning } = estimateCost(args.provider, args.model, usage);

  const promptTokens = usage.promptTokens ?? 0;
  const completionTokens = usage.completionTokens ?? 0;
  const totalTokens = promptTokens + completionTokens;

  try {
    const row = await db.aiAuditLog.create({
      data: {
        userId: args.userId,
        feature: args.feature,
        provider: args.provider,
        model: args.model,
        promptTokens,
        completionTokens,
        totalTokens,
        costUsd,
        msElapsed: args.msElapsed,
        status: args.status,
        errorMessage: args.errorMessage ?? null,
        jobId: args.jobId ?? null,
        emailThreadId: args.emailThreadId ?? null,
      },
    });
    return { id: row.id, costUsd, warning };
  } catch (err) {
    console.error("[careerflow] Failed to write AiAuditLog:", err);
    return null;
  }
}
