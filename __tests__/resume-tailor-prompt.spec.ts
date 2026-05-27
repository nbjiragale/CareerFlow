// CAREERFLOW: tests for the tailor prompt builder, focused on the new
// MATCH ANALYSIS block fed from a prior resume↔JD match.

import { describe, it, expect } from "vitest";
import { buildResumeTailorPrompt } from "@/lib/ai/prompts/resume-tailor/user";

const base = {
  resumeTitle: "Backend Engineer",
  candidateName: "Jane Doe",
  currentSummary: "Experienced backend engineer.",
  experiences: [
    {
      id: "e1",
      company: "Acme",
      jobTitle: "Engineer",
      description: "Built APIs.",
    },
  ],
  jdText: "We need Go and Postgres experience.",
  jobTitleLabel: "Senior Backend Engineer",
  companyLabel: "Stripe",
};

describe("buildResumeTailorPrompt", () => {
  it("includes a MATCH ANALYSIS block when guidance is provided", () => {
    const out = buildResumeTailorPrompt({
      ...base,
      matchGuidance: "- Keywords to weave in where truthful: Go, Postgres",
    });
    expect(out).toContain("MATCH ANALYSIS");
    expect(out).toContain("Go, Postgres");
  });

  it("omits the MATCH ANALYSIS block when there is no guidance", () => {
    expect(buildResumeTailorPrompt(base)).not.toContain("MATCH ANALYSIS");
  });

  it("still renders experiences (with ids) and the task list", () => {
    const out = buildResumeTailorPrompt(base);
    expect(out).toContain("experienceId: e1");
    expect(out).toContain("## TASK");
  });
});
