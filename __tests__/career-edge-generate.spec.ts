// CAREERFLOW: unit tests for the Edge orchestrator (src/lib/ai/edge/index.ts).
// The behavior that matters most: it must NOT spend an LLM call until there's
// enough decided data, and it must record audit rows on success and error.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/edge/collect", () => ({ collectApplications: vi.fn() }));
vi.mock("@/lib/ai/structured", () => ({ generateStructuredObject: vi.fn() }));
vi.mock("@/lib/ai/audit", () => ({ recordAiUsage: vi.fn() }));
vi.mock("@/lib/ai/resolve-settings", () => ({ resolveUserAiSettings: vi.fn() }));
vi.mock("@/lib/ai/providers", () => ({ getModel: vi.fn() }));

import { collectApplications } from "@/lib/ai/edge/collect";
import { generateStructuredObject } from "@/lib/ai/structured";
import { recordAiUsage } from "@/lib/ai/audit";
import { resolveUserAiSettings } from "@/lib/ai/resolve-settings";
import { getModel } from "@/lib/ai/providers";
import { generateCareerEdge, getEdgeReadiness } from "@/lib/ai/edge";
import {
  EDGE_MIN_DECIDED,
  type EdgeApplication,
} from "@/lib/ai/edge/aggregate";

const collectMock = collectApplications as unknown as ReturnType<typeof vi.fn>;
const genMock = generateStructuredObject as unknown as ReturnType<typeof vi.fn>;
const auditMock = recordAiUsage as unknown as ReturnType<typeof vi.fn>;
const settingsMock = resolveUserAiSettings as unknown as ReturnType<typeof vi.fn>;
const getModelMock = getModel as unknown as ReturnType<typeof vi.fn>;

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

function decidedApps(n: number): EdgeApplication[] {
  return Array.from({ length: n }, (_, i) =>
    app({ statusValue: i % 2 === 0 ? "interview" : "rejected" }),
  );
}

const insightsObject = {
  headline: "You're getting interviews half the time.",
  insights: [
    {
      title: "Agentic roles win",
      finding: "67% vs 17%.",
      recommendation: "Focus there.",
      factor: "archetype",
      confidence: "medium",
    },
  ],
  nextActions: ["Apply to two more agentic roles."],
};

describe("getEdgeReadiness", () => {
  it("reports locked state below the threshold", async () => {
    collectMock.mockResolvedValue(decidedApps(EDGE_MIN_DECIDED - 2));
    const r = await getEdgeReadiness("u1");
    expect(r.hasEnoughData).toBe(false);
    expect(r.decided).toBe(EDGE_MIN_DECIDED - 2);
    expect(r.decidedNeeded).toBe(2);
  });
});

describe("generateCareerEdge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsMock.mockResolvedValue({ provider: "openai", model: "gpt-4o-mini" });
    getModelMock.mockResolvedValue({ id: "fake-model" });
    auditMock.mockResolvedValue({ costUsd: 0.001 });
    genMock.mockResolvedValue({
      object: insightsObject,
      usage: { inputTokens: 300, outputTokens: 150 },
    });
  });

  it("short-circuits to 'learning' WITHOUT spending an LLM call", async () => {
    collectMock.mockResolvedValue(decidedApps(EDGE_MIN_DECIDED - 1));
    const result = await generateCareerEdge("u1");
    expect(result.status).toBe("learning");
    expect(genMock).not.toHaveBeenCalled();
    expect(getModelMock).not.toHaveBeenCalled();
    expect(settingsMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("generates insights and records a success audit when data clears the bar", async () => {
    collectMock.mockResolvedValue(decidedApps(EDGE_MIN_DECIDED));
    const result = await generateCareerEdge("u1");
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.insights.headline).toMatch(/interviews/i);
      expect(result.costUsd).toBe(0.001);
    }
    expect(genMock).toHaveBeenCalledTimes(1);
    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock.mock.calls[0][0]).toMatchObject({
      feature: "career-edge",
      status: "success",
    });
  });

  it("records an error audit and rethrows on LLM failure", async () => {
    collectMock.mockResolvedValue(decidedApps(EDGE_MIN_DECIDED));
    genMock.mockRejectedValue(new Error("provider 502"));
    await expect(generateCareerEdge("u1")).rejects.toThrow("provider 502");
    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock.mock.calls[0][0]).toMatchObject({
      feature: "career-edge",
      status: "error",
    });
  });
});
