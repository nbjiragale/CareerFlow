// CAREERFLOW: starts the Google OAuth flow. Returns a URL the client
// should redirect the browser to. Auth-gated; the user must be logged
// into CareerFlow before connecting a Gmail account.

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  buildAuthUrl,
  GoogleOAuthNotConfiguredError,
  getStoredToken,
} from "@/lib/gmail/client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 },
    );
  }

  try {
    const existing = await getStoredToken(session.user.id);
    const authUrl = buildAuthUrl({
      forceConsent: !existing,
      state: session.user.id,
    });
    return NextResponse.json({ authUrl });
  } catch (err) {
    if (err instanceof GoogleOAuthNotConfiguredError) {
      return NextResponse.json(
        {
          error:
            "Google OAuth is not configured on this server. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in your .env.",
        },
        { status: 503 },
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
