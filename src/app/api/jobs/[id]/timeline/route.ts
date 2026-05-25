// CAREERFLOW: Phase 3 — GET /api/jobs/:id/timeline. Auth + per-user job
// scoping + cursor pagination over the unified timeline (Activity +
// EmailThread + AiDraft).

import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import db from "@/lib/db";
import {
  fromActivity,
  fromAiDraft,
  fromEmailThread,
  paginateTimeline,
  sortTimelineEvents,
} from "@/lib/timeline/aggregate";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
// Per-job sources are bounded; cap each fetch so a pathological job can't load
// an unbounded set into memory before in-memory pagination.
const SOURCE_FETCH_CAP = 500;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: jobId } = await ctx.params;

  const job = await db.job.findFirst({
    where: { id: jobId, userId },
    select: { id: true },
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
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

  const [threads, drafts, activities] = await Promise.all([
    db.emailThread.findMany({
      where: { userId, jobId },
      orderBy: { receivedAt: "desc" },
      take: SOURCE_FETCH_CAP,
    }),
    db.aiDraft.findMany({
      where: { userId, jobId },
      orderBy: { createdAt: "desc" },
      take: SOURCE_FETCH_CAP,
    }),
    // Activity has no jobId FK; system-generated rows reference the job via
    // metadataJson (e.g. {"jobId":"…"}). Job ids are UUIDs so a substring
    // match is safe. Manual activities (metadataJson NULL) never appear here.
    db.activity.findMany({
      where: { userId, metadataJson: { contains: jobId } },
      orderBy: { startTime: "desc" },
      take: SOURCE_FETCH_CAP,
    }),
  ]);

  const events = sortTimelineEvents([
    ...threads.map(fromEmailThread),
    ...drafts.map(fromAiDraft),
    ...activities.map(fromActivity),
  ]);

  const page = paginateTimeline(events, limit, cursor);

  return NextResponse.json(page);
}
