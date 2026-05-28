// CAREERFLOW: Phase 2 — reply-draft user prompt. Truncates the email body and
// resume summary to stay inside short-context windows. Falls back gracefully
// when the body isn't available (e.g. user has disconnected Gmail) — in that
// case the model only has subject + snippet, which is good enough for "confirm"
// and "thank-you" intents but weaker for "reply" and "follow-up".

import "server-only";

import type { ReplyDraftIntent } from "@/models/ai.schemas";

const MAX_BODY_CHARS = 6_000;
const MAX_RESUME_CHARS = 1_500;
const MAX_CUSTOM_PROMPT_CHARS = 2_000;

export interface BuildReplyDraftPromptArgs {
  intent: ReplyDraftIntent;
  thread: {
    subject: string;
    snippet: string;
    fromAddress: string;
    receivedAt: Date;
    label: string;
  };
  body?: string | null;
  resumeSummary?: string | null;
  job?: {
    title?: string | null;
    company?: string | null;
    status?: string | null;
  } | null;
  customPrompt?: string | null;
}

export function buildReplyDraftPrompt(
  args: BuildReplyDraftPromptArgs,
): string {
  const { intent, thread, body, resumeSummary, job, customPrompt } = args;

  const bodyBlock = body
    ? body.slice(0, MAX_BODY_CHARS)
    : "(email body not available \u2014 the user may have disconnected Gmail. Draft based on subject and snippet only.)";

  const resumeBlock =
    (resumeSummary ?? "").slice(0, MAX_RESUME_CHARS).trim() ||
    "(no resume summary on file)";

  const jobBlock = job && (job.title || job.company)
    ? [
        "=== LINKED JOB CONTEXT ===",
        `Role: ${job.title ?? "Unknown"}`,
        `Company: ${job.company ?? "Unknown"}`,
        `Status: ${job.status ?? "Unknown"}`,
      ].join("\n")
    : "(no linked job)";

  const trimmedCustom = (customPrompt ?? "").slice(0, MAX_CUSTOM_PROMPT_CHARS).trim();
  const customBlock =
    intent === "custom"
      ? [
          "=== CUSTOM INSTRUCTION ===",
          trimmedCustom ||
            "(the user selected 'custom' but provided no instruction \u2014 fall back to a brief, professional acknowledgement)",
          "",
          "Refine and polish the above instruction into a coherent email body. Do not add facts beyond it.",
          "",
        ].join("\n")
      : "";

  return [
    `Intent: ${intent}`,
    "",
    "=== INCOMING EMAIL ===",
    `From: ${thread.fromAddress}`,
    `Subject: ${thread.subject}`,
    `Received: ${thread.receivedAt.toISOString()}`,
    `Classification: ${thread.label}`,
    `Snippet: ${thread.snippet}`,
    "",
    "=== EMAIL BODY ===",
    bodyBlock,
    "",
    jobBlock,
    "",
    "=== CANDIDATE RESUME SUMMARY ===",
    resumeBlock,
    "",
    customBlock,
    "Draft the reply now per the schema. Body only \u2014 no signature.",
  ].join("\n");
}
