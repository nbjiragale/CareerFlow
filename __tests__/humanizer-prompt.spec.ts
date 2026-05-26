// CAREERFLOW: guard tests for the vendored humanizer skill and its wiring into
// the draft system prompts. These assert we use the REAL vendored
// vendor/humanizer/SKILL.md content (not a summary), with frontmatter stripped.

import { describe, expect, it } from "vitest";

import {
  HUMANIZER_GUIDANCE,
  HUMANIZER_SKILL,
} from "@/lib/ai/prompts/humanizer";
import { REPLY_DRAFT_SYSTEM_PROMPT } from "@/lib/ai/prompts/reply-draft";
import { FOLLOW_UP_DRAFT_SYSTEM_PROMPT } from "@/lib/ai/prompts/follow-up-draft";

describe("vendored humanizer skill", () => {
  it("loads the real SKILL.md body (substantial, verbatim)", () => {
    expect(typeof HUMANIZER_SKILL).toBe("string");
    // The real file is ~27KB; the body after frontmatter is still large.
    expect(HUMANIZER_SKILL.length).toBeGreaterThan(10_000);
    expect(HUMANIZER_SKILL).toContain("# Humanizer: Remove AI Writing Patterns");
  });

  it("strips the YAML frontmatter (metadata, not guidance)", () => {
    expect(HUMANIZER_SKILL).not.toContain("allowed-tools:");
    expect(HUMANIZER_SKILL.startsWith("---")).toBe(false);
  });

  it("contains the skill's actual documented patterns verbatim", () => {
    for (const marker of [
      "Rule of Three",
      "Em Dash Overuse",
      "I hope this helps",
      "delve",
      "PERSONALITY AND SOUL",
    ]) {
      expect(HUMANIZER_SKILL).toContain(marker);
    }
  });

  it("guidance embeds the verbatim skill content", () => {
    expect(HUMANIZER_GUIDANCE).toContain(HUMANIZER_SKILL);
  });

  it("is wired into both draft system prompts", () => {
    expect(REPLY_DRAFT_SYSTEM_PROMPT).toContain(HUMANIZER_GUIDANCE);
    expect(FOLLOW_UP_DRAFT_SYSTEM_PROMPT).toContain(HUMANIZER_GUIDANCE);
  });
});
