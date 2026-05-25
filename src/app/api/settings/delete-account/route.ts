// CAREERFLOW: Phase 3 (PR #9) — POST /api/settings/delete-account. Hard delete
// of the current user and ALL their data. Requires the caller to re-type their
// account email as confirmation. The single user.delete cascades every owned
// row via the onDelete: Cascade FKs added in PR #7; global JobStatus lookups
// are not user-owned and remain.

import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email;
  if (!userId || !email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let confirmEmail = "";
  try {
    const body = await req.json();
    if (body && typeof body.confirmEmail === "string") {
      confirmEmail = body.confirmEmail;
    }
  } catch {
    // treated as an empty confirmation below
  }

  if (confirmEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
    return NextResponse.json(
      { error: "Email confirmation does not match your account email." },
      { status: 400 },
    );
  }

  try {
    await db.user.delete({ where: { id: userId } });
  } catch (err) {
    // P2025 = "record to delete does not exist" → already gone, treat as success.
    if (
      err &&
      typeof err === "object" &&
      (err as { code?: string }).code === "P2025"
    ) {
      return NextResponse.json({ success: true, alreadyDeleted: true });
    }
    const message = err instanceof Error ? err.message : "Failed to delete account";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
