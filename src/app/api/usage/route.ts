// CAREERFLOW: Phase 2 — GET /api/usage?days=N
// Returns aggregated AiAuditLog stats for the current user, used by
// Settings → Usage.

import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { getUsageSummary } from "@/lib/ai/usage";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

export const GET = async (req: NextRequest) => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!session || !userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const daysParam = req.nextUrl.searchParams.get("days");
  let days = DEFAULT_DAYS;
  if (daysParam) {
    const parsed = Number.parseInt(daysParam, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return NextResponse.json(
        { error: "days must be a positive integer" },
        { status: 400 },
      );
    }
    days = Math.min(parsed, MAX_DAYS);
  }

  try {
    const summary = await getUsageSummary(userId, days);
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load usage";
    return NextResponse.json({ error: message }, { status: 500 });
  }
};
