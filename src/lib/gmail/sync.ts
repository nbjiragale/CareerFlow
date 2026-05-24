// CAREERFLOW: top-level Gmail sync pipeline. Pulls Gmail Primary-category
// messages since the user's last successful sync, filters via the
// exclusion list, runs the active classifier (HuggingFace or built-in
// keyword), upserts EmailThread rows, and links / auto-creates Job rows
// for job-related results above the confidence threshold.

import "server-only";

import type { gmail_v1 } from "googleapis";

import db from "@/lib/db";

import { extractEmailBody } from "./body";
import {
  classifyEmails,
  getActiveClassifierKind,
  type ClassifierKind,
} from "./classifier";
import {
  GmailNotConnectedError,
  getAuthorizedGmail,
} from "./client";
import { shouldExcludeEmail } from "./email-utils";
import {
  findOrCreateJobForClassification,
  type LinkResult,
} from "./job-link";
import { isJobRelatedLabel, normalizeLabel } from "./labels";
import { getGmailSettings, markGmailSynced } from "./settings";

export interface SyncSummary {
  classifier: ClassifierKind;
  fetched: number;
  classified: number;
  jobThreads: number;
  needsReview: number;
  jobsCreated: number;
  jobsLinked: number;
  startedAt: string;
  finishedAt: string;
}

const FETCH_BATCH_SIZE = 50;
const FETCH_BATCH_DELAY_MS = 100;
const MAX_TEXT_LEN = 1000;

async function listMessageIds(
  gmail: gmail_v1.Gmail,
  query: string,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 100,
      pageToken,
    });
    for (const m of res.data.messages ?? []) {
      if (m.id) ids.push(m.id);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return ids;
}

async function fetchMessages(
  gmail: gmail_v1.Gmail,
  ids: string[],
): Promise<gmail_v1.Schema$Message[]> {
  const results: gmail_v1.Schema$Message[] = [];
  for (let i = 0; i < ids.length; i += FETCH_BATCH_SIZE) {
    const batch = ids.slice(i, i + FETCH_BATCH_SIZE);
    const responses = await Promise.all(
      batch.map((id) =>
        gmail.users.messages
          .get({ userId: "me", id, format: "full" })
          .then((r) => r.data)
          .catch(() => null),
      ),
    );
    for (const r of responses) {
      if (r) results.push(r);
    }
    if (i + FETCH_BATCH_SIZE < ids.length) {
      await new Promise((r) => setTimeout(r, FETCH_BATCH_DELAY_MS));
    }
  }
  return results;
}

function header(
  msg: gmail_v1.Schema$Message,
  name: string,
): string | undefined {
  return (
    msg.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())
      ?.value ?? undefined
  );
}

function buildQuery(sinceMs: number, untilMs: number): string {
  const after = Math.floor(sinceMs / 1000);
  const before = Math.floor(untilMs / 1000);
  return `category:primary after:${after} before:${before}`;
}

export interface RunGmailSyncOptions {
  // Overrides the "now" clock for tests + deterministic boundaries.
  now?: Date;
}

export { GmailNotConnectedError };

export async function runGmailSyncForUser(
  userId: string,
  options: RunGmailSyncOptions = {},
): Promise<SyncSummary> {
  const startedAt = options.now ?? new Date();
  const settings = await getGmailSettings(userId);

  const since = settings.lastSyncedAt
    ? new Date(settings.lastSyncedAt)
    : new Date(
        startedAt.getTime() - settings.initialLookbackDays * 24 * 3600 * 1000,
      );

  const { gmail } = await getAuthorizedGmail(userId);

  const ids = await listMessageIds(
    gmail,
    buildQuery(since.getTime(), startedAt.getTime()),
  );

  if (ids.length === 0) {
    await markGmailSynced(userId);
    const finishedAt = new Date();
    return {
      classifier: getActiveClassifierKind(),
      fetched: 0,
      classified: 0,
      jobThreads: 0,
      needsReview: 0,
      jobsCreated: 0,
      jobsLinked: 0,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    };
  }

  const messages = await fetchMessages(gmail, ids);

  interface PreparedEmail {
    text: string;
    messageId: string;
    threadId: string;
    fromAddress: string;
    subject: string;
    snippet: string;
    receivedAt: Date;
  }

  const prepared: PreparedEmail[] = [];

  for (const msg of messages) {
    if (!msg.id || !msg.threadId) continue;
    const from = header(msg, "From") ?? "";
    if (shouldExcludeEmail(from, settings.excludedEmails)) continue;

    const subject = header(msg, "Subject") ?? "";
    const body = extractEmailBody(msg.payload);
    const text = `Subject: ${subject}\n\n${body.substring(0, MAX_TEXT_LEN)}`;
    const internal = Number.parseInt(msg.internalDate ?? "0", 10);
    const receivedAt =
      Number.isFinite(internal) && internal > 0
        ? new Date(internal)
        : startedAt;

    prepared.push({
      text,
      messageId: msg.id,
      threadId: msg.threadId,
      fromAddress: from,
      subject,
      snippet: msg.snippet ?? "",
      receivedAt,
    });
  }

  const batch = await classifyEmails(
    prepared.map((p) => p.text),
    { threshold: settings.classificationThreshold },
  );

  let jobThreads = 0;
  let needsReviewCount = 0;
  let jobsCreated = 0;
  let jobsLinked = 0;

  // De-dupe per Gmail thread: keep the most recent message per thread.
  const byThread = new Map<string, { idx: number; receivedAt: Date }>();
  prepared.forEach((email, idx) => {
    const existing = byThread.get(email.threadId);
    if (!existing || email.receivedAt > existing.receivedAt) {
      byThread.set(email.threadId, { idx, receivedAt: email.receivedAt });
    }
  });

  for (const { idx } of byThread.values()) {
    const email = prepared[idx];
    const cls = batch.results[idx];
    if (!cls) continue;

    const label = normalizeLabel(cls.label);
    const jobRelated = isJobRelatedLabel(label);
    const needsReview =
      jobRelated && cls.confidence < settings.classificationThreshold;

    let link: LinkResult = { jobId: null, created: false };
    if (jobRelated && !needsReview) {
      link = await findOrCreateJobForClassification({
        userId,
        label,
        confidence: cls.confidence,
        threshold: settings.classificationThreshold,
        extractedCompany: cls.company,
        extractedRole: cls.role,
        subject: email.subject,
        receivedAt: email.receivedAt,
      });
      if (link.created) jobsCreated++;
      else if (link.jobId) jobsLinked++;
    }

    if (jobRelated) jobThreads++;
    if (needsReview) needsReviewCount++;

    await db.emailThread.upsert({
      where: {
        userId_gmailThreadId: { userId, gmailThreadId: email.threadId },
      },
      create: {
        userId,
        gmailThreadId: email.threadId,
        gmailMessageId: email.messageId,
        jobId: link.jobId,
        label,
        confidence: cls.confidence,
        needsReview,
        extractedCompany: cls.company ?? null,
        extractedRole: cls.role ?? null,
        subject: email.subject,
        snippet: email.snippet,
        fromAddress: email.fromAddress,
        receivedAt: email.receivedAt,
      },
      update: {
        gmailMessageId: email.messageId,
        jobId: link.jobId,
        label,
        confidence: cls.confidence,
        needsReview,
        extractedCompany: cls.company ?? null,
        extractedRole: cls.role ?? null,
        subject: email.subject,
        snippet: email.snippet,
        fromAddress: email.fromAddress,
        receivedAt: email.receivedAt,
        processedAt: new Date(),
      },
    });
  }

  await markGmailSynced(userId);
  const finishedAt = new Date();

  return {
    classifier: batch.kind,
    fetched: prepared.length,
    classified: batch.results.length,
    jobThreads,
    needsReview: needsReviewCount,
    jobsCreated,
    jobsLinked,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
  };
}
