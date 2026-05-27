// CAREERFLOW: shared resolver for the user's configured AI provider/model.
// Mirrors the local copies in evaluate.ts / tailor.ts; used by the
// match-and-tailor orchestrator and the job-match library so they can fail
// fast (before creating a Job) when AI settings are missing.

import "server-only";

import db from "@/lib/db";
import type { ProviderType } from "@/lib/ai/providers";

export interface ResolvedAiSettings {
  provider: ProviderType;
  model: string;
}

export async function resolveUserAiSettings(
  userId: string,
): Promise<ResolvedAiSettings> {
  // Verify the user exists. A valid JWT can reference a userId that was deleted
  // (or a DB that was reset) — catch this early with a clear message rather
  // than letting the caller see "AI settings not configured" for a phantom user.
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    throw new Error(
      "Session invalid. Please sign out and sign back in.",
    );
  }

  const row = await db.userSettings.findUnique({ where: { userId } });
  if (!row) {
    throw new Error(
      "AI settings not configured. Pick a provider and model in Settings → AI Provider first.",
    );
  }
  let parsed: { ai?: { provider?: string; model?: string } };
  try {
    parsed = JSON.parse(row.settings);
  } catch {
    throw new Error("UserSettings JSON is corrupt; cannot resolve AI provider.");
  }
  const provider = parsed.ai?.provider as ProviderType | undefined;
  const model = parsed.ai?.model;
  if (!provider || !model) {
    throw new Error(
      "AI provider/model not selected. Pick one in Settings → AI Provider.",
    );
  }
  return { provider, model };
}
