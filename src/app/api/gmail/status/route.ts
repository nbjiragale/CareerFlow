// CAREERFLOW: lightweight status endpoint for the Settings UI. Reports
// whether Gmail is connected, the connected email, the last successful
// sync time, the current settings, and which classifier is active.

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getActiveClassifierKind } from "@/lib/gmail/classifier";
import {
  getStoredToken,
  isGoogleOAuthConfigured,
} from "@/lib/gmail/client";
import { getGmailSettings } from "@/lib/gmail/settings";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 },
    );
  }

  const [token, settings] = await Promise.all([
    getStoredToken(session.user.id),
    getGmailSettings(session.user.id),
  ]);

  return NextResponse.json({
    oauthConfigured: isGoogleOAuthConfigured(),
    classifier: getActiveClassifierKind(),
    connected: Boolean(token),
    email: token?.email ?? null,
    lastUsedAt: token?.lastUsedAt ?? null,
    lastSyncedAt: settings.lastSyncedAt,
    settings: {
      classificationThreshold: settings.classificationThreshold,
      excludedEmails: settings.excludedEmails,
      initialLookbackDays: settings.initialLookbackDays,
    },
  });
}
