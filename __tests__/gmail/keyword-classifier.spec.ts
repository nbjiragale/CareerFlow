import {
  classifyKeyword,
  classifyKeywordBatch,
} from "@/lib/gmail/keyword-classifier";

describe("classifyKeyword", () => {
  it("classifies Applied confirmations", () => {
    const r = classifyKeyword(
      "Subject: Application received\n\nThank you for applying to Acme Corp.",
    );
    expect(r.label).toBe("Applied");
    expect(r.confidence).toBeGreaterThan(0.5);
    expect(r.confidence).toBeLessThan(0.7);
  });

  it("classifies Interview invitations", () => {
    const r = classifyKeyword(
      "Subject: Schedule a phone call\n\nWe'd like to invite you to a phone interview for the role.",
    );
    expect(r.label).toBe("Interview");
  });

  it("classifies NextPhase emails", () => {
    const r = classifyKeyword(
      "Subject: Next round\n\nYou've advanced to the next round of interviews.",
    );
    expect(r.label).toBe("NextPhase");
  });

  it("classifies Offer emails", () => {
    const r = classifyKeyword(
      "Subject: Excited to extend an offer\n\nWe are pleased to offer you the position.",
    );
    expect(r.label).toBe("Offer");
  });

  it("classifies Rejected emails", () => {
    const r = classifyKeyword(
      "Subject: Update on your application\n\nUnfortunately, we will not be moving forward with your application.",
    );
    expect(r.label).toBe("Rejected");
  });

  it("returns NotJobRelated for unrelated content", () => {
    const r = classifyKeyword(
      "Subject: Your Spotify wrapped\n\nHere's a look back at your year in music.",
    );
    expect(r.label).toBe("NotJobRelated");
    expect(r.confidence).toBe(0);
  });

  it("assigns the same low confidence to all job labels (so they land in Needs Review)", () => {
    const samples = [
      "Thank you for applying to ACME.",
      "We'd like to schedule a phone interview.",
      "You've advanced to the next round.",
      "We are pleased to offer you the role.",
      "Unfortunately we will not be moving forward.",
    ];
    for (const s of samples) {
      const r = classifyKeyword(s);
      expect(r.confidence).toBe(0.6);
      expect(r.label).not.toBe("NotJobRelated");
    }
  });

  it("batches inputs", () => {
    const out = classifyKeywordBatch([
      "Thank you for applying to ACME.",
      "Unrelated newsletter content.",
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].label).toBe("Applied");
    expect(out[1].label).toBe("NotJobRelated");
  });
});
