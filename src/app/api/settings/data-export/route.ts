// CAREERFLOW: Phase 3 (PR #9) — GET /api/settings/data-export. Streams a single
// JSON file of every row owned by the current user, with secrets redacted.

import "server-only";

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { collectUserExport } from "@/lib/export/collect";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const data = await collectUserExport(userId);
  if (!data) {
    // Session token references a userId that no longer exists in the database
    // (e.g. after a database reset). Return 401 so the client treats it as an
    // auth failure and redirects to sign-in rather than showing a confusing
    // "User not found" error page.
    return NextResponse.json(
      { error: "Session invalid. Please sign in again." },
      { status: 401 },
    );
  }

  const filename = `careerflow-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
