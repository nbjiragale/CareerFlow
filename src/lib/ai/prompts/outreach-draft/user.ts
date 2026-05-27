// CAREERFLOW: recruiter / LinkedIn outreach user-prompt builder.

import type { OutreachIntent } from "@/models/ai.schemas";

export interface OutreachDraftPromptInput {
  intent: OutreachIntent;
  company: string;
  role: string;
  jdExcerpt?: string | null;
  resumeSummary?: string | null;
  recipientName?: string | null;
  recipientRole?: string | null;
}

const INTENT_INSTRUCTION: Record<OutreachIntent, string> = {
  connection:
    "Write a LinkedIn connection-request note (max 280 characters, no subject).",
  inmail:
    "Write a LinkedIn InMail / direct message (include a short subject line).",
  referral:
    "Write a friendly note asking whether they'd be open to referring the candidate for this role.",
  "follow-up":
    "Write a brief, polite follow-up nudge after a prior message or application with no response yet.",
};

export function buildOutreachDraftPrompt(
  input: OutreachDraftPromptInput,
): string {
  const {
    intent,
    company,
    role,
    jdExcerpt,
    resumeSummary,
    recipientName,
    recipientRole,
  } = input;

  const lines = [
    `MESSAGE TYPE: ${intent}`,
    INTENT_INSTRUCTION[intent],
    "",
    `COMPANY: ${company}`,
    `ROLE: ${role}`,
  ];

  if (recipientName && recipientName.trim()) {
    lines.push(`RECIPIENT NAME: ${recipientName.trim().slice(0, 80)}`);
  } else {
    lines.push("RECIPIENT NAME: (unknown — do not invent a name)");
  }
  if (recipientRole && recipientRole.trim()) {
    lines.push(`RECIPIENT ROLE: ${recipientRole.trim().slice(0, 80)}`);
  }

  if (jdExcerpt && jdExcerpt.trim()) {
    lines.push("", "JOB DESCRIPTION (excerpt):", jdExcerpt.trim().slice(0, 1500));
  }
  if (resumeSummary && resumeSummary.trim()) {
    lines.push("", "CANDIDATE BACKGROUND:", resumeSummary.trim().slice(0, 1200));
  } else {
    lines.push(
      "",
      "CANDIDATE BACKGROUND: (none provided — keep the fit sentence general.)",
    );
  }

  lines.push("", "Write the outreach message.");
  return lines.join("\n");
}
