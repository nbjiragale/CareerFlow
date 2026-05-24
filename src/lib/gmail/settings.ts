// CAREERFLOW: typed accessors for per-user Gmail integration preferences.
// Stored as JSON in the existing UserSettings.settings blob under a `gmail`
// key to avoid a Prisma migration in the feature PR. All fields are
// optional and merged on top of GMAIL_DEFAULTS.

import "server-only";

import db from "@/lib/db";

export interface GmailSettings {
  classificationThreshold: number;
  excludedEmails: string[];
  lastSyncedAt: string | null; // ISO date string
  initialLookbackDays: number;
}

export const GMAIL_DEFAULTS: GmailSettings = {
  classificationThreshold: 0.7,
  excludedEmails: [],
  lastSyncedAt: null,
  initialLookbackDays: 14,
};

export const MIN_THRESHOLD = 0.5;
export const MAX_THRESHOLD = 0.95;

interface UserSettingsBlob {
  gmail?: Partial<GmailSettings>;
  [key: string]: unknown;
}

function parseBlob(raw: string | null | undefined): UserSettingsBlob {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as UserSettingsBlob;
    }
  } catch {
    // fall through
  }
  return {};
}

function sanitize(partial: Partial<GmailSettings> | undefined): GmailSettings {
  const merged: GmailSettings = { ...GMAIL_DEFAULTS, ...(partial ?? {}) };

  if (
    typeof merged.classificationThreshold !== "number" ||
    Number.isNaN(merged.classificationThreshold)
  ) {
    merged.classificationThreshold = GMAIL_DEFAULTS.classificationThreshold;
  }
  merged.classificationThreshold = Math.min(
    MAX_THRESHOLD,
    Math.max(MIN_THRESHOLD, merged.classificationThreshold),
  );

  if (!Array.isArray(merged.excludedEmails)) {
    merged.excludedEmails = [];
  } else {
    merged.excludedEmails = merged.excludedEmails
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  if (typeof merged.lastSyncedAt !== "string" && merged.lastSyncedAt !== null) {
    merged.lastSyncedAt = null;
  }

  if (
    typeof merged.initialLookbackDays !== "number" ||
    Number.isNaN(merged.initialLookbackDays) ||
    merged.initialLookbackDays < 1
  ) {
    merged.initialLookbackDays = GMAIL_DEFAULTS.initialLookbackDays;
  }

  return merged;
}

export async function getGmailSettings(userId: string): Promise<GmailSettings> {
  const row = await db.userSettings.findUnique({ where: { userId } });
  const blob = parseBlob(row?.settings);
  return sanitize(blob.gmail);
}

export async function updateGmailSettings(
  userId: string,
  patch: Partial<GmailSettings>,
): Promise<GmailSettings> {
  const row = await db.userSettings.findUnique({ where: { userId } });
  const blob = parseBlob(row?.settings);

  const merged: GmailSettings = sanitize({
    ...(blob.gmail ?? {}),
    ...patch,
  });

  const nextBlob: UserSettingsBlob = { ...blob, gmail: merged };
  const settingsJson = JSON.stringify(nextBlob);

  await db.userSettings.upsert({
    where: { userId },
    create: { userId, settings: settingsJson },
    update: { settings: settingsJson },
  });

  return merged;
}

export async function markGmailSynced(userId: string): Promise<void> {
  await updateGmailSettings(userId, { lastSyncedAt: new Date().toISOString() });
}
