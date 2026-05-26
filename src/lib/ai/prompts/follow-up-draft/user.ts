// CAREERFLOW: follow-up draft user-prompt builder.

export interface FollowUpDraftPromptInput {
  company: string;
  role: string;
  daysSinceApplied: number | null;
  jdExcerpt?: string | null;
  resumeSummary?: string | null;
}

export function buildFollowUpDraftPrompt(input: FollowUpDraftPromptInput): string {
  const { company, role, daysSinceApplied, jdExcerpt, resumeSummary } = input;

  const lines = [
    `COMPANY: ${company}`,
    `ROLE: ${role}`,
    daysSinceApplied != null
      ? `APPLIED: about ${daysSinceApplied} day(s) ago, no response yet`
      : "APPLIED: a while ago, no response yet",
  ];

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

  lines.push("", "Write the follow-up email.");
  return lines.join("\n");
}
