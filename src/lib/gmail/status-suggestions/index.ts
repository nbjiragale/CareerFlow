// CAREERFLOW: status-suggestion server layer. Reads classified, job-linked
// email threads and turns the pure rules into pending suggestions, plus the
// apply/dismiss mutations the dashboard card calls. Confirm-first by design:
// nothing changes an application's status without an explicit user action.

import "server-only";

import db from "@/lib/db";
import {
  statusLabel,
  suggestedStatusValue,
  type StatusSuggestion,
} from "./rules";

/**
 * Pending status suggestions for the user, at most one per application (the
 * most recent qualifying thread wins), newest first.
 */
export async function getStatusSuggestions(
  userId: string,
): Promise<StatusSuggestion[]> {
  if (!userId) return [];

  const threads = await db.emailThread.findMany({
    where: {
      userId,
      jobId: { not: null },
      statusSuggestionHandled: false,
      needsReview: false,
    },
    include: {
      Job: { include: { Status: true, Company: true, JobTitle: true } },
    },
    orderBy: { receivedAt: "desc" },
  });

  const seenJobs = new Set<string>();
  const suggestions: StatusSuggestion[] = [];

  for (const t of threads) {
    if (!t.Job || !t.jobId) continue;
    if (seenJobs.has(t.jobId)) continue;

    const currentStatusValue = t.Job.Status?.value ?? "applied";
    const target = suggestedStatusValue({
      emailLabel: t.label,
      currentStatusValue,
      confidence: t.confidence,
      needsReview: t.needsReview,
    });
    if (!target) continue;

    seenJobs.add(t.jobId);
    suggestions.push({
      threadId: t.id,
      jobId: t.jobId,
      company: t.Job.Company?.label ?? t.extractedCompany ?? "Unknown",
      role: t.Job.JobTitle?.label ?? t.extractedRole ?? "Unknown role",
      currentStatusValue,
      currentStatusLabel: statusLabel(currentStatusValue),
      suggestedStatusValue: target,
      suggestedStatusLabel: statusLabel(target),
      emailLabel: t.label,
      emailSubject: t.subject,
      receivedAt: t.receivedAt.toISOString(),
      confidence: t.confidence,
    });
  }

  return suggestions;
}

export type ApplyStatusSuggestionResult =
  | { ok: true; jobId: string; newStatusValue: string; newStatusLabel: string }
  | { ok: false; reason: "stale" };

/**
 * Apply a suggestion: advance the linked application's status and mark the
 * thread handled. Re-validates against current state (the status may have
 * changed since the dashboard rendered) and no-ops gracefully if it's stale.
 * Throws only for genuinely missing rows.
 */
export async function applyStatusSuggestion(
  userId: string,
  threadId: string,
): Promise<ApplyStatusSuggestionResult> {
  const thread = await db.emailThread.findFirst({
    where: { id: threadId, userId },
    include: { Job: { include: { Status: true } } },
  });
  if (!thread || !thread.Job || !thread.jobId) {
    throw new Error("Suggestion not found.");
  }

  const currentStatusValue = thread.Job.Status?.value ?? "applied";
  const target = suggestedStatusValue({
    emailLabel: thread.label,
    currentStatusValue,
    confidence: thread.confidence,
    needsReview: thread.needsReview,
  });

  if (!target) {
    // No longer applicable (e.g. the user already advanced it). Stop nudging.
    await db.emailThread.update({
      where: { id: thread.id },
      data: { statusSuggestionHandled: true },
    });
    return { ok: false, reason: "stale" };
  }

  const status = await db.jobStatus.findUnique({ where: { value: target } });
  if (!status) {
    throw new Error(`Target status "${target}" not found.`);
  }

  await db.$transaction([
    db.job.update({
      where: { id: thread.jobId },
      data: { statusId: status.id },
    }),
    db.emailThread.update({
      where: { id: thread.id },
      data: { statusSuggestionHandled: true },
    }),
  ]);

  return {
    ok: true,
    jobId: thread.jobId,
    newStatusValue: target,
    newStatusLabel: statusLabel(target),
  };
}

/**
 * Dismiss a suggestion without changing anything — just stop surfacing it.
 */
export async function dismissStatusSuggestion(
  userId: string,
  threadId: string,
): Promise<{ ok: true }> {
  const res = await db.emailThread.updateMany({
    where: { id: threadId, userId },
    data: { statusSuggestionHandled: true },
  });
  if (res.count === 0) {
    throw new Error("Suggestion not found.");
  }
  return { ok: true };
}
