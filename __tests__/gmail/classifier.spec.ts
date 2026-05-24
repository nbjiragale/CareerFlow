import {
  classifyEmails,
  getActiveClassifierKind,
  isHuggingFaceConfigured,
} from "@/lib/gmail/classifier";

const originalEnv = process.env.HUGGINGFACE_SPACE_URL;

describe("classifier dispatch", () => {
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.HUGGINGFACE_SPACE_URL;
    else process.env.HUGGINGFACE_SPACE_URL = originalEnv;
    vi.resetModules();
  });

  it("reports keyword kind when HF env var is unset", () => {
    delete process.env.HUGGINGFACE_SPACE_URL;
    expect(isHuggingFaceConfigured()).toBe(false);
    expect(getActiveClassifierKind()).toBe("keyword");
  });

  it("reports huggingface kind when HF env var is set", () => {
    process.env.HUGGINGFACE_SPACE_URL = "owner/space";
    expect(isHuggingFaceConfigured()).toBe(true);
    expect(getActiveClassifierKind()).toBe("huggingface");
  });

  it("uses the keyword fallback when HF env var is unset", async () => {
    delete process.env.HUGGINGFACE_SPACE_URL;
    const out = await classifyEmails(
      [
        "Subject: thank you for applying to ACME",
        "Subject: weekly newsletter",
      ],
      { threshold: 0.7 },
    );
    expect(out.kind).toBe("keyword");
    expect(out.results).toHaveLength(2);
    expect(out.results[0].label).toBe("Applied");
    expect(out.results[1].label).toBe("NotJobRelated");
  });

  it("delegates to @gradio/client when HF is configured", async () => {
    process.env.HUGGINGFACE_SPACE_URL = "owner/space";

    const predict = vi.fn().mockResolvedValue({
      data: {
        results: [
          {
            classification: { label: "Interview", score: 0.91, success: true },
            extraction: { company: "Acme", role: "SWE", success: true },
          },
        ],
      },
    });

    vi.doMock("@gradio/client", () => ({
      Client: { connect: vi.fn().mockResolvedValue({ predict }) },
    }));

    const mod = await import("@/lib/gmail/classifier");
    const out = await mod.classifyEmails(["Subject: phone screen"], {
      threshold: 0.7,
    });

    expect(out.kind).toBe("huggingface");
    expect(predict).toHaveBeenCalledWith(
      "/process_batch",
      expect.objectContaining({ threshold: 0.7 }),
    );
    expect(out.results[0].label).toBe("Interview");
    expect(out.results[0].confidence).toBeCloseTo(0.91);
    expect(out.results[0].company).toBe("Acme");
    expect(out.results[0].role).toBe("SWE");
  });

  it("returns no results for an empty batch", async () => {
    delete process.env.HUGGINGFACE_SPACE_URL;
    const out = await classifyEmails([], { threshold: 0.7 });
    expect(out.results).toHaveLength(0);
  });
});
