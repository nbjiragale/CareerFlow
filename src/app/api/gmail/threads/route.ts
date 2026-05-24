// CAREERFLOW: paginated list of EmailThread rows for the current user.
// Filters: `needsReview=true|false`. Returns the linked Job's company +
// title for the UI.

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import db from "@/lib/db";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const limitParam = Number.parseInt(
    url.searchParams.get("limit") ?? `${DEFAULT_LIMIT}`,
    10,
  );
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.isFinite(limitParam) ? limitParam : DEFAULT_LIMIT),
  );
  const cursor = url.searchParams.get("cursor");
  const needsReviewParam = url.searchParams.get("needsReview");
  const needsReview =
    needsReviewParam === "true"
      ? true
      : needsReviewParam === "false"
        ? false
        : undefined;

  const threads = await db.emailThread.findMany({
    where: {
      userId: session.user.id,
      ...(needsReview !== undefined ? { needsReview } : {}),
    },
    orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      Job: {
        select: {
          id: true,
          JobTitle: { select: { label: true } },
          Company: { select: { label: true } },
        },
      },
    },
  });

  const hasMore = threads.length > limit;
  const sliced = hasMore ? threads.slice(0, limit) : threads;
  const nextCursor = hasMore ? sliced[sliced.length - 1]?.id : null;

  return NextResponse.json({
    threads: sliced.map((t) => ({
      id: t.id,
      gmailThreadId: t.gmailThreadId,
      subject: t.subject,
      snippet: t.snippet,
      fromAddress: t.fromAddress,
      receivedAt: t.receivedAt,
      label: t.label,
      confidence: t.confidence,
      needsReview: t.needsReview,
      extractedCompany: t.extractedCompany,
      extractedRole: t.extractedRole,
      job: t.Job
        ? {
            id: t.Job.id,
            title: t.Job.JobTitle?.label ?? null,
            company: t.Job.Company?.label ?? null,
          }
        : null,
    })),
    nextCursor,
  });
}
