// CAREERFLOW: tests for the Edge win-loop deterministic aggregator. This is the
// trust boundary — the LLM only narrates what these functions compute, so the
// math here must be exactly right.

import { describe, expect, it } from "vitest";

import {
  buildEdgeFacts,
  outcomeOf,
  EDGE_MIN_DECIDED,
  type EdgeApplication,
} from "@/lib/ai/edge/aggregate";

function app(overrides: Partial<EdgeApplication> = {}): EdgeApplication {
  return {
    id: Math.random().toString(36).slice(2),
    company: "Acme",
    role: "Engineer",
    statusValue: "applied",
    archetype: null,
    grade: null,
    matchScore: null,
    resumeTitle: null,
    followedUp: false,
    followUpDelayDays: null,
    ...overrides,
  };
}

describe("outcomeOf", () => {
  it("maps interview and offer to positive", () => {
    expect(outcomeOf("interview")).toBe("positive");
    expect(outcomeOf("offer")).toBe("positive");
  });
  it("maps rejected and expired to negative", () => {
    expect(outcomeOf("rejected")).toBe("negative");
    expect(outcomeOf("expired")).toBe("negative");
  });
  it("maps open stages to pending", () => {
    for (const s of ["wishlist", "draft", "applied", "screening", "archived"]) {
      expect(outcomeOf(s)).toBe("pending");
    }
  });
});

describe("buildEdgeFacts totals", () => {
  it("counts positive/negative/pending and computes interview+ rate over decided", () => {
    const apps = [
      app({ statusValue: "offer" }),
      app({ statusValue: "interview" }),
      app({ statusValue: "rejected" }),
      app({ statusValue: "rejected" }),
      app({ statusValue: "applied" }), // pending, excluded from rate
    ];
    const f = buildEdgeFacts(apps);
    expect(f.totals.total).toBe(5);
    expect(f.totals.positive).toBe(2);
    expect(f.totals.negative).toBe(2);
    expect(f.totals.pending).toBe(1);
    expect(f.totals.decided).toBe(4);
    expect(f.totals.rate).toBe(50); // 2/4
  });

  it("reports rate 0 when nothing is decided yet", () => {
    const f = buildEdgeFacts([app(), app({ statusValue: "screening" })]);
    expect(f.totals.decided).toBe(0);
    expect(f.totals.rate).toBe(0);
  });
});

describe("buildEdgeFacts cohorts", () => {
  it("breaks down interview+ rate by archetype", () => {
    const apps = [
      app({ archetype: "agentic", statusValue: "interview" }),
      app({ archetype: "agentic", statusValue: "offer" }),
      app({ archetype: "agentic", statusValue: "rejected" }),
      app({ archetype: "transformation", statusValue: "rejected" }),
      app({ archetype: "transformation", statusValue: "rejected" }),
    ];
    const f = buildEdgeFacts(apps);
    const agentic = f.byArchetype.find((c) => c.key === "agentic")!;
    const transformation = f.byArchetype.find(
      (c) => c.key === "transformation",
    )!;
    expect(agentic.decided).toBe(3);
    expect(agentic.positive).toBe(2);
    expect(agentic.rate).toBe(67); // round(2/3*100)
    expect(transformation.rate).toBe(0); // 0/2
  });

  it("bands match scores correctly", () => {
    const apps = [
      app({ matchScore: 90, statusValue: "interview" }),
      app({ matchScore: 88, statusValue: "rejected" }),
      app({ matchScore: 60, statusValue: "rejected" }),
      app({ matchScore: 30, statusValue: "rejected" }),
      app({ matchScore: null, statusValue: "interview" }), // excluded from bands
    ];
    const f = buildEdgeFacts(apps);
    const strong = f.byMatchBand.find((c) => c.key === "85+")!;
    expect(strong.total).toBe(2);
    expect(strong.positive).toBe(1);
    expect(f.byMatchBand.some((c) => c.key === "50-69")).toBe(true);
    expect(f.byMatchBand.some((c) => c.key === "<50")).toBe(true);
    // The unscored interview must not leak into any band.
    const banded = f.byMatchBand.reduce((n, c) => n + c.total, 0);
    expect(banded).toBe(4);
  });

  it("splits follow-up vs no-follow-up cohorts", () => {
    const apps = [
      app({ followedUp: true, statusValue: "interview" }),
      app({ followedUp: true, statusValue: "rejected" }),
      app({ followedUp: false, statusValue: "rejected" }),
      app({ followedUp: false, statusValue: "rejected" }),
    ];
    const f = buildEdgeFacts(apps);
    expect(f.followUp.followedUp.rate).toBe(50); // 1/2
    expect(f.followUp.notFollowedUp.rate).toBe(0); // 0/2
  });

  it("splits prompt vs delayed follow-up timing (only dated follow-ups)", () => {
    const apps = [
      app({ followedUp: true, followUpDelayDays: 2, statusValue: "interview" }),
      app({ followedUp: true, followUpDelayDays: 5, statusValue: "offer" }),
      app({ followedUp: true, followUpDelayDays: 20, statusValue: "rejected" }),
      app({ followedUp: true, followUpDelayDays: 30, statusValue: "rejected" }),
      // Followed up but undated — excluded from the timing split entirely.
      app({ followedUp: true, followUpDelayDays: null, statusValue: "offer" }),
    ];
    const f = buildEdgeFacts(apps);
    expect(f.followUpTiming.withinWeek.total).toBe(2);
    expect(f.followUpTiming.withinWeek.rate).toBe(100); // 2/2
    expect(f.followUpTiming.afterWeek.total).toBe(2);
    expect(f.followUpTiming.afterWeek.rate).toBe(0); // 0/2
  });

  it("treats a follow-up at exactly the threshold as prompt", () => {
    const apps = [
      app({ followedUp: true, followUpDelayDays: 7, statusValue: "interview" }),
      app({ followedUp: true, followUpDelayDays: 8, statusValue: "rejected" }),
    ];
    const f = buildEdgeFacts(apps);
    expect(f.followUpTiming.withinWeek.total).toBe(1);
    expect(f.followUpTiming.afterWeek.total).toBe(1);
  });
});

describe("buildEdgeFacts gating", () => {
  it("stays locked until EDGE_MIN_DECIDED decided applications exist", () => {
    const decided = Array.from({ length: EDGE_MIN_DECIDED - 1 }, () =>
      app({ statusValue: "rejected" }),
    );
    const f = buildEdgeFacts(decided);
    expect(f.hasEnoughData).toBe(false);
    expect(f.decidedNeeded).toBe(1);
  });

  it("unlocks at exactly the threshold", () => {
    const decided = Array.from({ length: EDGE_MIN_DECIDED }, () =>
      app({ statusValue: "rejected" }),
    );
    const f = buildEdgeFacts(decided);
    expect(f.hasEnoughData).toBe(true);
    expect(f.decidedNeeded).toBe(0);
  });

  it("ignores pending applications when counting toward the threshold", () => {
    const apps = [
      ...Array.from({ length: 20 }, () => app({ statusValue: "applied" })),
      app({ statusValue: "interview" }),
    ];
    const f = buildEdgeFacts(apps);
    expect(f.totals.decided).toBe(1);
    expect(f.hasEnoughData).toBe(false);
  });
});
