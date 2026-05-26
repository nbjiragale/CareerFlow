// CAREERFLOW: guard tests for the humanizer guidance and its wiring into the
// draft system prompts.

import { describe, expect, it } from "vitest";

import { HUMANIZER_GUIDANCE } from "@/lib/ai/prompts/humanizer";
import { REPLY_DRAFT_SYSTEM_PROMPT } from "@/lib/ai/prompts/reply-draft";
import { FOLLOW_UP_DRAFT_SYSTEM_PROMPT } from "@/lib/ai/prompts/follow-up-draft";

describe("humanizer guidance", () => {
  it("is a substantial, non-empty string", () => {
    expect(typeof HUMANIZER_GUIDANCE).toBe("string");
    expect(HUMANIZER_GUIDANCE.length).toBeGreaterThan(400);
  });

  it("names AI-writing tells to avoid", () => {
    for (const tell of ["delve", "leverage", "em dash", "I hope this"]) {
      expect(HUMANIZER_GUIDANCE.toLowerCase()).toContain(tell.toLowerCase());
    }
  });

  it("is wired into the reply-draft system prompt", () => {
    expect(REPLY_DRAFT_SYSTEM_PROMPT).toContain(HUMANIZER_GUIDANCE);
  });

  it("is wired into the follow-up-draft system prompt", () => {
    expect(FOLLOW_UP_DRAFT_SYSTEM_PROMPT).toContain(HUMANIZER_GUIDANCE);
  });
});
