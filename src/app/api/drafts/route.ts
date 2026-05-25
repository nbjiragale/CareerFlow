// CAREERFLOW: Phase 2 — GET /api/drafts?emailThreadId=...
// Returns prior reply drafts for a thread (newest first), used by the
// DraftReplyDrawer history list.

import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { listDraftsForThread } from "@/lib/ai/drafts";

export const GET = async (req: NextRequest) => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!session || !userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const emailThreadId = req.nextUrl.searchParams.get("emailThreadId");
  if (!emailThreadId) {
    return NextResponse.json(
      { error: "emailThreadId query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const drafts = await listDraftsForThread(userId, emailThreadId);
    return NextResponse.json({ drafts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load drafts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
};
