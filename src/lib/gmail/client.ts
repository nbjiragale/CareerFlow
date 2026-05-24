// CAREERFLOW: Google OAuth2 client factory + helpers to load an
// authorized Gmail client for a given user. Refresh tokens are stored
// encrypted in OAuthToken via src/lib/encryption.ts (AES-256-GCM with
// PBKDF2 + per-record salt); access tokens are cached opportunistically
// and re-derived from the refresh token when expired.

import "server-only";

import { google, type gmail_v1 } from "googleapis";
import { OAuth2Client } from "google-auth-library";

import db from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export const GOOGLE_PROVIDER = "google";

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class GoogleOAuthNotConfiguredError extends Error {
  constructor() {
    super(
      "Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.",
    );
    this.name = "GoogleOAuthNotConfiguredError";
  }
}

export class GmailNotConnectedError extends Error {
  constructor() {
    super("Gmail is not connected for this user.");
    this.name = "GmailNotConnectedError";
  }
}

export function getOAuthConfig(): OAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new GoogleOAuthNotConfiguredError();
  }

  return { clientId, clientSecret, redirectUri };
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI,
  );
}

export function createOAuthClient(): OAuth2Client {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function buildAuthUrl(opts: {
  state?: string;
  forceConsent?: boolean;
}): string {
  const oauth = createOAuthClient();
  return oauth.generateAuthUrl({
    access_type: "offline",
    scope: GMAIL_SCOPES,
    prompt: opts.forceConsent ? "consent" : "select_account",
    include_granted_scopes: true,
    response_type: "code",
    state: opts.state,
  });
}

export interface ExchangedTokens {
  refreshToken: string;
  accessToken: string | null;
  accessTokenExpiresAt: Date | null;
  email: string;
  scope: string;
}

export async function exchangeCodeForTokens(
  code: string,
): Promise<ExchangedTokens> {
  const oauth = createOAuthClient();
  const { tokens } = await oauth.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Revoke prior access at https://myaccount.google.com/permissions and try again.",
    );
  }

  oauth.setCredentials(tokens);
  const userInfo = await google
    .oauth2({ version: "v2", auth: oauth })
    .userinfo.get();

  if (!userInfo.data.email) {
    throw new Error("Google did not return an email address.");
  }

  const expiresAt =
    typeof tokens.expiry_date === "number"
      ? new Date(tokens.expiry_date)
      : null;

  return {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token ?? null,
    accessTokenExpiresAt: expiresAt,
    email: userInfo.data.email,
    scope: tokens.scope ?? GMAIL_SCOPES.join(" "),
  };
}

export async function persistTokens(
  userId: string,
  tokens: ExchangedTokens,
): Promise<void> {
  const refresh = encrypt(tokens.refreshToken);
  const access = tokens.accessToken ? encrypt(tokens.accessToken) : null;

  await db.oAuthToken.upsert({
    where: {
      userId_provider: { userId, provider: GOOGLE_PROVIDER },
    },
    create: {
      userId,
      provider: GOOGLE_PROVIDER,
      encryptedRefreshToken: refresh.encrypted,
      refreshTokenIv: refresh.iv,
      encryptedAccessToken: access?.encrypted ?? null,
      accessTokenIv: access?.iv ?? null,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      scope: tokens.scope,
      email: tokens.email,
    },
    update: {
      encryptedRefreshToken: refresh.encrypted,
      refreshTokenIv: refresh.iv,
      encryptedAccessToken: access?.encrypted ?? null,
      accessTokenIv: access?.iv ?? null,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      scope: tokens.scope,
      email: tokens.email,
    },
  });
}

export async function getStoredToken(userId: string) {
  return db.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider: GOOGLE_PROVIDER } },
  });
}

export async function deleteStoredToken(userId: string): Promise<void> {
  await db.oAuthToken.deleteMany({
    where: { userId, provider: GOOGLE_PROVIDER },
  });
}

const ACCESS_TOKEN_LEEWAY_MS = 60_000;

export async function getAuthorizedGmail(
  userId: string,
): Promise<{ gmail: gmail_v1.Gmail; email: string }> {
  const token = await getStoredToken(userId);
  if (!token) {
    throw new GmailNotConnectedError();
  }

  const oauth = createOAuthClient();

  const refreshToken = decrypt(
    token.encryptedRefreshToken,
    token.refreshTokenIv,
  );

  let accessToken: string | null = null;
  const stillValid =
    token.encryptedAccessToken &&
    token.accessTokenIv &&
    token.accessTokenExpiresAt &&
    token.accessTokenExpiresAt.getTime() - Date.now() > ACCESS_TOKEN_LEEWAY_MS;

  if (stillValid) {
    accessToken = decrypt(token.encryptedAccessToken!, token.accessTokenIv!);
  }

  oauth.setCredentials({
    refresh_token: refreshToken,
    ...(accessToken ? { access_token: accessToken } : {}),
  });

  if (!accessToken) {
    const refreshed = await oauth.refreshAccessToken();
    const creds = refreshed.credentials;
    if (!creds.access_token) {
      throw new Error("Failed to refresh Google access token.");
    }
    accessToken = creds.access_token;
    const newExpiry =
      typeof creds.expiry_date === "number"
        ? new Date(creds.expiry_date)
        : null;

    const enc = encrypt(accessToken);
    await db.oAuthToken.update({
      where: { userId_provider: { userId, provider: GOOGLE_PROVIDER } },
      data: {
        encryptedAccessToken: enc.encrypted,
        accessTokenIv: enc.iv,
        accessTokenExpiresAt: newExpiry,
        lastUsedAt: new Date(),
      },
    });

    oauth.setCredentials({
      refresh_token: refreshToken,
      access_token: accessToken,
    });
  } else {
    await db.oAuthToken.update({
      where: { userId_provider: { userId, provider: GOOGLE_PROVIDER } },
      data: { lastUsedAt: new Date() },
    });
  }

  const gmail = google.gmail({ version: "v1", auth: oauth });
  return { gmail, email: token.email };
}
