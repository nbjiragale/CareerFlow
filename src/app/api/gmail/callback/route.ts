// CAREERFLOW: Google OAuth redirect target. Exchanges the authorization
// code for tokens, encrypts + persists them in OAuthToken, and redirects
// the user back to Settings → Integrations with a status query param.

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  exchangeCodeForTokens,
  GoogleOAuthNotConfiguredError,
  persistTokens,
} from "@/lib/gmail/client";

function redirectTo(req: NextRequest, status: string) {
  return NextResponse.redirect(
    new URL(
      `/dashboard/settings?section=integrations&gmail=${status}`,
      req.url,
    ),
  );
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirectTo(req, "not_authenticated");
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return redirectTo(req, encodeURIComponent(oauthError));
  }
  if (!code) {
    return redirectTo(req, "missing_code");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await persistTokens(session.user.id, tokens);
    return redirectTo(req, "connected");
  } catch (err) {
    if (err instanceof GoogleOAuthNotConfiguredError) {
      return redirectTo(req, "oauth_not_configured");
    }
    console.error("[gmail/callback] OAuth exchange failed", err);
    return redirectTo(req, "exchange_failed");
  }
}
