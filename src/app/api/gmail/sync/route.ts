// CAREERFLOW: manual "Sync now" trigger. Runs the same pipeline the
// scheduler runs every 15 min. Per-user 60s rate limit prevents abuse
// of this endpoint and protects the classifier provider.

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  GmailNotConnectedError,
  runGmailSyncForUser,
} from "@/lib/gmail/sync";

const RATE_LIMIT_MS = 60_000;
const lastRequestTime = new Map<string, number>();

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 },
    );
  }

  const userId = session.user.id;
  const last = lastRequestTime.get(userId) ?? 0;
  const elapsed = Date.now() - last;
  if (elapsed < RATE_LIMIT_MS) {
    const retryIn = Math.ceil((RATE_LIMIT_MS - elapsed) / 1000);
    return NextResponse.json(
      { error: `Please wait ${retryIn}s before syncing again.` },
      { status: 429 },
    );
  }
  lastRequestTime.set(userId, Date.now());

  try {
    const summary = await runGmailSyncForUser(userId);
    return NextResponse.json({ success: true, summary });
  } catch (err) {
    if (err instanceof GmailNotConnectedError) {
      return NextResponse.json(
        { error: "Gmail is not connected for this account." },
        { status: 400 },
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[gmail/sync] failed", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
