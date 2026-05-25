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
    return NextResponse.json({ error: "User not found" }, { status: 404 });
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
