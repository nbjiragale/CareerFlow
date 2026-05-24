// CAREERFLOW: revokes the user's Gmail connection by deleting their
// stored OAuthToken row. EmailThread rows are preserved so historical
// classifications survive a reconnect.

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { deleteStoredToken } from "@/lib/gmail/client";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 },
    );
  }

  await deleteStoredToken(session.user.id);
  return NextResponse.json({ success: true });
}
