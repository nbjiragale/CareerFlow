// CAREERFLOW: Phase 1 \u2014 fans out scheduled Gmail syncs. Called from the
// shared node-cron tick in src/lib/scheduler/index.ts. Only iterates
// users that have a valid OAuthToken row for the Google provider. Each
// user's sync is best-effort and isolated; one user's failure never
// blocks the rest.

import "server-only";

import db from "@/lib/db";

import { GOOGLE_PROVIDER } from "./client";
import { runGmailSyncForUser } from "./sync";

export interface GmailSchedulerSummary {
  attempted: number;
  succeeded: number;
  failed: number;
}

export async function runDueGmailSyncs(): Promise<GmailSchedulerSummary> {
  console.log("[Scheduler] Checking for users with Gmail connected");

  const summary: GmailSchedulerSummary = {
    attempted: 0,
    succeeded: 0,
    failed: 0,
  };

  try {
    const tokens = await db.oAuthToken.findMany({
      where: { provider: GOOGLE_PROVIDER },
      select: { userId: true },
    });

    if (tokens.length === 0) {
      console.log("[Scheduler] No Gmail-connected users");
      return summary;
    }

    console.log(
      `[Scheduler] Running Gmail sync for ${tokens.length} user(s)`,
    );

    for (const { userId } of tokens) {
      summary.attempted++;
      try {
        const result = await runGmailSyncForUser(userId);
        summary.succeeded++;
        console.log(
          `[Scheduler] Gmail sync for ${userId} ok: fetched=${result.fetched}, needsReview=${result.needsReview}, jobsCreated=${result.jobsCreated}`,
        );
      } catch (err) {
        summary.failed++;
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[Scheduler] Gmail sync for ${userId} failed: ${message}`,
        );
      }
    }
  } catch (err) {
    console.error("[Scheduler] runDueGmailSyncs error:", err);
  }

  return summary;
}
