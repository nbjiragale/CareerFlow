// CAREERFLOW: Phase 2 — guard tests for the reply-draft prompts.

import { describe, expect, it } from "vitest";

import {
  REPLY_DRAFT_SYSTEM_PROMPT,
  buildReplyDraftPrompt,
} from "@/lib/ai/prompts/reply-draft";

function baseThread() {
  return {
    subject: "Interview invitation",
    snippet: "Are you available Tue?",
    fromAddress: "recruiter@acme.com",
    receivedAt: new Date("2026-05-20T15:00:00Z"),
    label: "Interview",
  };
}

describe("Reply draft prompts", () => {
  describe("system prompt", () => {
    it("is a non-empty string", () => {
      expect(typeof REPLY_DRAFT_SYSTEM_PROMPT).toBe("string");
      expect(REPLY_DRAFT_SYSTEM_PROMPT.length).toBeGreaterThan(500);
    });

    it("documents all five intents", () => {
      for (const intent of [
        "reply",
        "follow-up",
        "thank-you",
        "confirm",
        "custom",
      ]) {
        expect(REPLY_DRAFT_SYSTEM_PROMPT).toContain(intent);
      }
    });

    it("forbids autonomous send", () => {
      expect(REPLY_DRAFT_SYSTEM_PROMPT).toMatch(/never sends?|NEVER send/i);
    });

    it("forbids a generated signature", () => {
      expect(REPLY_DRAFT_SYSTEM_PROMPT).toMatch(/signature/i);
    });

    it("instructs plain text only", () => {
      expect(REPLY_DRAFT_SYSTEM_PROMPT).toMatch(/plain text/i);
    });
  });

  describe("buildReplyDraftPrompt", () => {
    it("includes the intent at the top", () => {
      const out = buildReplyDraftPrompt({
        intent: "follow-up",
        thread: baseThread(),
      });
      expect(out.startsWith("Intent: follow-up")).toBe(true);
    });

    it("includes the full email body when provided", () => {
      const out = buildReplyDraftPrompt({
        intent: "reply",
        thread: baseThread(),
        body: "BODY_MARKER_42",
      });
      expect(out).toContain("BODY_MARKER_42");
    });

    it("substitutes a placeholder when body is missing", () => {
      const out = buildReplyDraftPrompt({
        intent: "confirm",
        thread: baseThread(),
        body: null,
      });
      expect(out).toMatch(/email body not available/);
    });

    it("renders linked job context when present", () => {
      const out = buildReplyDraftPrompt({
        intent: "reply",
        thread: baseThread(),
        job: { title: "AI PM", company: "Acme", status: "interview" },
      });
      expect(out).toContain("Role: AI PM");
      expect(out).toContain("Company: Acme");
      expect(out).toContain("Status: interview");
    });

    it("collapses missing job context to '(no linked job)'", () => {
      const out = buildReplyDraftPrompt({
        intent: "reply",
        thread: baseThread(),
        job: null,
      });
      expect(out).toContain("(no linked job)");
    });

    it("falls back to '(no resume summary on file)' when resume is missing", () => {
      const out = buildReplyDraftPrompt({
        intent: "reply",
        thread: baseThread(),
      });
      expect(out).toContain("(no resume summary on file)");
    });

    it("truncates the body to 6000 chars", () => {
      const out = buildReplyDraftPrompt({
        intent: "reply",
        thread: baseThread(),
        body: "b".repeat(10_000),
      });
      const bs = out.match(/b+/g) ?? [];
      const longest = Math.max(...bs.map((s) => s.length));
      expect(longest).toBe(6_000);
    });

    it("truncates the resume summary to 1500 chars", () => {
      const out = buildReplyDraftPrompt({
        intent: "reply",
        thread: baseThread(),
        resumeSummary: "r".repeat(5_000),
      });
      const rs = out.match(/r+/g) ?? [];
      const longest = Math.max(...rs.map((s) => s.length));
      expect(longest).toBe(1_500);
    });

    it("emits a final body-only instruction", () => {
      const out = buildReplyDraftPrompt({
        intent: "reply",
        thread: baseThread(),
      });
      expect(out).toMatch(/Body only/);
    });

    it("includes the custom instruction block when intent is 'custom'", () => {
      const out = buildReplyDraftPrompt({
        intent: "custom",
        thread: baseThread(),
        customPrompt: "Politely decline and ask to reconnect next quarter.",
      });
      expect(out).toContain("=== CUSTOM INSTRUCTION ===");
      expect(out).toContain("Politely decline and ask to reconnect next quarter.");
    });

    it("omits the custom instruction block for non-custom intents", () => {
      const out = buildReplyDraftPrompt({
        intent: "reply",
        thread: baseThread(),
        customPrompt: "ignored",
      });
      expect(out).not.toContain("=== CUSTOM INSTRUCTION ===");
      expect(out).not.toContain("ignored");
    });

    it("truncates the custom prompt to 2000 chars", () => {
      const out = buildReplyDraftPrompt({
        intent: "custom",
        thread: baseThread(),
        customPrompt: "x".repeat(5_000),
      });
      const xs = out.match(/x+/g) ?? [];
      const longest = Math.max(...xs.map((s) => s.length));
      expect(longest).toBe(2_000);
    });
  });
});
