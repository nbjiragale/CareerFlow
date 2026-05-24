import {
  isJobRelatedLabel,
  LABEL_TO_JOB_STATUS,
  normalizeLabel,
} from "@/lib/gmail/labels";

describe("normalizeLabel", () => {
  it("normalizes the five canonical labels", () => {
    expect(normalizeLabel("applied")).toBe("Applied");
    expect(normalizeLabel("Interview")).toBe("Interview");
    expect(normalizeLabel("OFFER")).toBe("Offer");
    expect(normalizeLabel("rejected")).toBe("Rejected");
    expect(normalizeLabel("NextPhase")).toBe("NextPhase");
  });

  it("accepts NextPhase variants", () => {
    expect(normalizeLabel("next phase")).toBe("NextPhase");
    expect(normalizeLabel("next-phase")).toBe("NextPhase");
    expect(normalizeLabel("next_phase")).toBe("NextPhase");
  });

  it("falls back to NotJobRelated for unknown labels", () => {
    expect(normalizeLabel("newsletter")).toBe("NotJobRelated");
    expect(normalizeLabel("")).toBe("NotJobRelated");
  });
});

describe("LABEL_TO_JOB_STATUS", () => {
  it("maps all five job labels to a seeded JobStatus.value", () => {
    expect(LABEL_TO_JOB_STATUS.Applied).toBe("applied");
    expect(LABEL_TO_JOB_STATUS.Interview).toBe("interview");
    expect(LABEL_TO_JOB_STATUS.NextPhase).toBe("interview");
    expect(LABEL_TO_JOB_STATUS.Offer).toBe("offer");
    expect(LABEL_TO_JOB_STATUS.Rejected).toBe("rejected");
  });

  it("returns null for NotJobRelated", () => {
    expect(LABEL_TO_JOB_STATUS.NotJobRelated).toBeNull();
  });
});

describe("isJobRelatedLabel", () => {
  it("returns true for all five job labels", () => {
    expect(isJobRelatedLabel("Applied")).toBe(true);
    expect(isJobRelatedLabel("Interview")).toBe(true);
    expect(isJobRelatedLabel("NextPhase")).toBe(true);
    expect(isJobRelatedLabel("Offer")).toBe(true);
    expect(isJobRelatedLabel("Rejected")).toBe(true);
  });

  it("returns false for NotJobRelated", () => {
    expect(isJobRelatedLabel("NotJobRelated")).toBe(false);
  });
});
