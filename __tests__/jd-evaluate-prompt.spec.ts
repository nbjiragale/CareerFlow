// CAREERFLOW: Phase 2 — guard tests for the JD evaluate prompts.
//
// These are not full snapshot fixtures (which would be noisy and brittle on
// every word tweak) — they check load-bearing structural pieces of the system
// prompt + user prompt so accidental edits get caught in CI.

import { describe, expect, it } from "vitest";

import {
  JD_EVALUATE_SYSTEM_PROMPT,
  SOURCE_SHA,
  buildJdEvaluatePrompt,
} from "@/lib/ai/prompts/jd-evaluate";

describe("JD evaluate prompts", () => {
  describe("system prompt", () => {
    it("is a non-empty string", () => {
      expect(typeof JD_EVALUATE_SYSTEM_PROMPT).toBe("string");
      expect(JD_EVALUATE_SYSTEM_PROMPT.length).toBeGreaterThan(1000);
    });

    it("pins the career-ops SOURCE_SHA", () => {
      expect(SOURCE_SHA).toBe("b45a8d46127fc57d8257cb026b33a75f2e9c40d0");
    });

    it("documents all six archetypes", () => {
      for (const a of [
        "ai-platform-llmops",
        "agentic",
        "ai-pm",
        "solutions-architect",
        "forward-deployed",
        "transformation",
      ]) {
        expect(
          JD_EVALUATE_SYSTEM_PROMPT,
          `missing archetype: ${a}`,
        ).toContain(a);
      }
    });

    it("documents the 1-5 scoring rubric for the five dimensions", () => {
      for (const dim of [
        "matchWithCv",
        "northStarAlignment",
        "comp",
        "culturalSignals",
        "redFlags",
      ]) {
        expect(JD_EVALUATE_SYSTEM_PROMPT, `missing dimension: ${dim}`).toContain(
          dim,
        );
      }
    });

    it("documents the globalScore → letter grade mapping", () => {
      expect(JD_EVALUATE_SYSTEM_PROMPT).toMatch(/4\.5/);
      expect(JD_EVALUATE_SYSTEM_PROMPT).toMatch(/A\b/);
      expect(JD_EVALUATE_SYSTEM_PROMPT).toMatch(/F\b/);
    });
  });

  describe("buildJdEvaluatePrompt", () => {
    it("includes the JD text in the prompt", () => {
      const out = buildJdEvaluatePrompt({ jdText: "UNIQUE_JD_MARKER_123" });
      expect(out).toContain("UNIQUE_JD_MARKER_123");
    });

    it("notes 'auto-detect' instructions when no archetype is given", () => {
      const out = buildJdEvaluatePrompt({ jdText: "x" });
      expect(out).toMatch(/Detect the closest archetype yourself/);
    });

    it("notes 'auto-detect' instructions when archetypeHint is 'auto-detect'", () => {
      const out = buildJdEvaluatePrompt({
        jdText: "x",
        archetypeHint: "auto-detect",
      });
      expect(out).toMatch(/Detect the closest archetype yourself/);
    });

    it("passes a concrete archetypeHint through as a framing hint", () => {
      const out = buildJdEvaluatePrompt({
        jdText: "x",
        archetypeHint: "agentic",
      });
      expect(out).toMatch(/Archetype hint from user: agentic/);
    });

    it("truncates JD text to 8000 chars", () => {
      const out = buildJdEvaluatePrompt({ jdText: "x".repeat(10_000) });
      // The output also has the wrapper text, but the JD chunk must not be
      // bigger than the cap.
      const xs = out.match(/x+/g) ?? [];
      const longest = Math.max(...xs.map((s) => s.length));
      expect(longest).toBe(8_000);
    });

    it("truncates resumeSummary to 2000 chars", () => {
      const out = buildJdEvaluatePrompt({
        jdText: "jd",
        resumeSummary: "r".repeat(5_000),
      });
      const rs = out.match(/r+/g) ?? [];
      const longest = Math.max(...rs.map((s) => s.length));
      expect(longest).toBe(2_000);
    });

    it("falls back to a placeholder when resumeSummary is missing", () => {
      const out = buildJdEvaluatePrompt({ jdText: "jd" });
      expect(out).toMatch(/no resume summary provided/);
    });
  });
});
