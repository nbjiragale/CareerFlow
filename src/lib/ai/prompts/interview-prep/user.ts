// CAREERFLOW: Interview Copilot user-prompt builder.

export interface InterviewPrepPromptInput {
  company: string;
  role: string;
  jdText: string;
  resumeText?: string | null;
}

export function buildInterviewPrepPrompt(input: InterviewPrepPromptInput): string {
  const { company, role, jdText, resumeText } = input;

  const resumeBlock =
    resumeText && resumeText.trim().length > 0
      ? `CANDIDATE RESUME:\n${resumeText.trim()}`
      : "CANDIDATE RESUME: (none provided — keep talking points and answer angles generic and note that a resume would sharpen them.)";

  return [
    `COMPANY: ${company}`,
    `ROLE: ${role}`,
    "",
    "JOB DESCRIPTION:",
    jdText.trim(),
    "",
    resumeBlock,
    "",
    "Produce the interview prep brief for this specific role and candidate.",
  ].join("\n");
}
