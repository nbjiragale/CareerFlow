// CAREERFLOW: user correction endpoint. Writes a row to
// EmailClassificationCorrection (audit trail for PRD §18 accuracy metric
// and future fine-tuning) and updates the EmailThread's label + clears
// needsReview. If the corrected label is job-related, re-runs auto-link
// to associate the thread with a Job.

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import db from "@/lib/db";
import { findOrCreateJobForClassification } from "@/lib/gmail/job-link";
import {
  isJobRelatedLabel,
  JOB_LABELS,
  normalizeLabel,
} from "@/lib/gmail/labels";
import { getGmailSettings } from "@/lib/gmail/settings";

const ACCEPTED_LABELS = new Set<string>([...JOB_LABELS, "NotJobRelated"]);

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 },
    );
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    label?: string;
  } | null;
  const rawLabel = body?.label ?? "";
  const corrected = normalizeLabel(rawLabel);

  // Reject labels that don't match an accepted constant directly (after
  // normalization). `normalizeLabel` is permissive about casing/separators
  // for the five job labels, but anything else collapses to NotJobRelated;
  // we still want to reject obviously-bogus input rather than silently
  // accepting it as NotJobRelated.
  if (!rawLabel || !ACCEPTED_LABELS.has(corrected)) {
    return NextResponse.json(
      { error: "Invalid label" },
      { status: 400 },
    );
  }
  if (corrected === "NotJobRelated" && rawLabel.toLowerCase() !== "notjobrelated") {
    return NextResponse.json(
      { error: "Invalid label" },
      { status: 400 },
    );
  }

  const thread = await db.emailThread.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!thread) {
    return NextResponse.json(
      { error: "Thread not found" },
      { status: 404 },
    );
  }

  const settings = await getGmailSettings(session.user.id);

  let jobId: string | null = thread.jobId;
  if (isJobRelatedLabel(corrected)) {
    // Confidence is now 1.0 (user-confirmed), so it always clears the
    // threshold and the auto-link / auto-create branch fires.
    const link = await findOrCreateJobForClassification({
      userId: session.user.id,
      label: corrected,
      confidence: 1.0,
      threshold: settings.classificationThreshold,
      extractedCompany: thread.extractedCompany ?? undefined,
      extractedRole: thread.extractedRole ?? undefined,
      subject: thread.subject,
      receivedAt: thread.receivedAt,
    });
    jobId = link.jobId ?? thread.jobId;
  } else {
    // Marked not job-related → unlink any Job we previously associated.
    jobId = null;
  }

  const [updated] = await db.$transaction([
    db.emailThread.update({
      where: { id: thread.id },
      data: {
        label: corrected,
        needsReview: false,
        jobId,
      },
    }),
    db.emailClassificationCorrection.upsert({
      where: { emailThreadId: thread.id },
      create: {
        userId: session.user.id,
        emailThreadId: thread.id,
        originalLabel: thread.label,
        correctedLabel: corrected,
        originalConfidence: thread.confidence,
      },
      update: {
        originalLabel: thread.label,
        correctedLabel: corrected,
        originalConfidence: thread.confidence,
        correctedAt: new Date(),
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    thread: {
      id: updated.id,
      label: updated.label,
      needsReview: updated.needsReview,
      jobId: updated.jobId,
    },
  });
}
