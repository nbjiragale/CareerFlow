interface SourceExperience {
  id: string;
  company: string;
  jobTitle: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  description: string;
}

export interface TailorPromptInput {
  resumeTitle: string;
  candidateName: string;
  currentSummary: string;
  experiences: SourceExperience[];
  jdText: string;
  jobTitleLabel?: string;
  companyLabel?: string;
}

export function buildResumeTailorPrompt(input: TailorPromptInput): string {
  const experiencesBlock = input.experiences
    .map((exp, i) => {
      const dates =
        [exp.startDate, exp.endDate].filter(Boolean).join(" – ") || "n/a";
      return `### EXPERIENCE ${i + 1}
- experienceId: ${exp.id}
- company: ${exp.company}
- title: ${exp.jobTitle}
- location: ${exp.location ?? "n/a"}
- dates: ${dates}
- current description (source):
${exp.description || "(empty)"}`;
    })
    .join("\n\n");

  return `Tailor this resume for the target job description.

## CANDIDATE
- Name: ${input.candidateName}
- Resume title: ${input.resumeTitle}

## TARGET ROLE
- Job title: ${input.jobTitleLabel ?? "(not specified)"}
- Company: ${input.companyLabel ?? "(not specified)"}

## TARGET JOB DESCRIPTION
${input.jdText}

## CURRENT SUMMARY (rewrite this for the target role)
${input.currentSummary || "(empty — produce a new one from the experience block below)"}

## CURRENT EXPERIENCES (rewrite each description; keep ids exact)
${experiencesBlock}

## TASK
1. Rewrite the Summary as <p>…</p>, 2-4 sentences, JD-aligned.
2. For EACH experience above, return an entry with the SAME experienceId and a fresh <ul><li>…</li></ul> description (3-5 bullets, action-verb-led, JD-aligned, no fabricated metrics or employers).
3. Set titleSuffix to a short phrase like "tailored for ${input.jobTitleLabel ?? "[role]"} at ${input.companyLabel ?? "[company]"}".
4. Optionally add 1-3 short notes explaining what you emphasized.

Return ONLY the structured JSON.`;
}
