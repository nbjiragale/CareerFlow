// CAREERFLOW: tests for the status-suggestion decision core. This is the trust
// boundary for auto-advancing a user's application board, so the rules — gates,
// forward-only movement, terminal protection — must be exactly right.

import { describe, expect, it } from "vitest";

import {
  suggestedStatusValue,
  statusLabel,
  STATUS_SUGGESTION_MIN_CONFIDENCE,
  type SuggestionInput,
} from "@/lib/gmail/status-suggestions/rules";

function input(overrides: Partial<SuggestionInput> = {}): SuggestionInput {
  return {
    emailLabel: "Interview",
    currentStatusValue: "applied",
    confidence: 0.95,
    needsReview: false,
    ...overrides,
  };
}

describe("suggestedStatusValue — gates", () => {
  it("returns null when the thread is flagged for manual review", () => {
    expect(suggestedStatusValue(input({ needsReview: true }))).toBeNull();
  });

  it("returns null below the confidence floor", () => {
    expect(
      suggestedStatusValue({
        ...input(),
        confidence: STATUS_SUGGESTION_MIN_CONFIDENCE - 0.01,
      }),
    ).toBeNull();
  });

  it("allows exactly at the confidence floor", () => {
    expect(
      suggestedStatusValue({
        ...input(),
        confidence: STATUS_SUGGESTION_MIN_CONFIDENCE,
      }),
    ).toBe("interview");
  });

  it("ignores labels that don't map to a stage", () => {
    expect(suggestedStatusValue(input({ emailLabel: "Applied" }))).toBeNull();
    expect(
      suggestedStatusValue(input({ emailLabel: "NotJobRelated" })),
    ).toBeNull();
  });
});

describe("suggestedStatusValue — mapping", () => {
  it("maps Interview and NextPhase to interview", () => {
    expect(suggestedStatusValue(input({ emailLabel: "Interview" }))).toBe(
      "interview",
    );
    expect(suggestedStatusValue(input({ emailLabel: "NextPhase" }))).toBe(
      "interview",
    );
  });

  it("maps Offer to offer", () => {
    expect(suggestedStatusValue(input({ emailLabel: "Offer" }))).toBe("offer");
  });

  it("maps Rejected to rejected", () => {
    expect(suggestedStatusValue(input({ emailLabel: "Rejected" }))).toBe(
      "rejected",
    );
  });
});

describe("suggestedStatusValue — forward only", () => {
  it("suggests when the email implies a later stage", () => {
    expect(
      suggestedStatusValue({
        ...input(),
        emailLabel: "Offer",
        currentStatusValue: "interview",
      }),
    ).toBe("offer");
  });

  it("does NOT step backward (interview email on an offer-stage job)", () => {
    expect(
      suggestedStatusValue({
        ...input(),
        emailLabel: "Interview",
        currentStatusValue: "offer",
      }),
    ).toBeNull();
  });

  it("returns null when already in the target stage", () => {
    expect(
      suggestedStatusValue({
        ...input(),
        emailLabel: "Interview",
        currentStatusValue: "interview",
      }),
    ).toBeNull();
  });
});

describe("suggestedStatusValue — rejection and terminal protection", () => {
  it("suggests rejection from any active stage", () => {
    for (const stage of ["applied", "screening", "interview", "offer"]) {
      expect(
        suggestedStatusValue({
          ...input(),
          emailLabel: "Rejected",
          currentStatusValue: stage,
        }),
      ).toBe("rejected");
    }
  });

  it("never resurrects a closed application", () => {
    for (const stage of ["rejected", "expired", "archived"]) {
      expect(
        suggestedStatusValue({
          ...input(),
          emailLabel: "Interview",
          currentStatusValue: stage,
        }),
      ).toBeNull();
    }
  });
});

describe("statusLabel", () => {
  it("resolves known values to their display labels", () => {
    expect(statusLabel("interview")).toBe("Interview");
    expect(statusLabel("offer")).toBe("Offer");
  });
  it("falls back to the raw value when unknown", () => {
    expect(statusLabel("mystery")).toBe("mystery");
  });
});
