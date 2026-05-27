// CAREERFLOW: Phase 2 — GET /api/drafts?emailThreadId=... | ?jobId=...
// Returns prior drafts (newest first). emailThreadId powers the
// DraftReplyDrawer history; jobId powers the OutreachDrawer history.

import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { listDraftsForThread, listDraftsForJob } from "@/lib/ai/drafts";

export const GET = async (req: NextRequest) => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!session || !userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const emailThreadId = req.nextUrl.searchParams.get("emailThreadId");
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!emailThreadId && !jobId) {
    return NextResponse.json(
      { error: "emailThreadId or jobId query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const drafts = emailThreadId
      ? await listDraftsForThread(userId, emailThreadId)
      : await listDraftsForJob(userId, jobId!);
    return NextResponse.json({ drafts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load drafts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
};
