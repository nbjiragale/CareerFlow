vi.mock("@/lib/db", () => {
  const mockPrisma = {
    company: { findFirst: vi.fn(), create: vi.fn() },
    jobTitle: { findFirst: vi.fn(), create: vi.fn() },
    jobSource: { findFirst: vi.fn(), create: vi.fn() },
    jobStatus: { findFirst: vi.fn(), create: vi.fn() },
    job: { findMany: vi.fn(), create: vi.fn() },
  };
  return { default: mockPrisma };
});

import { findOrCreateJobForClassification } from "@/lib/gmail/job-link";
import prisma from "@/lib/db";

const mocks = prisma as unknown as {
  company: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  jobTitle: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  jobSource: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  jobStatus: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  job: { findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
};

describe("findOrCreateJobForClassification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.company.findFirst.mockResolvedValue(null);
    mocks.company.create.mockResolvedValue({ id: "comp1" });
    mocks.jobTitle.findFirst.mockResolvedValue(null);
    mocks.jobTitle.create.mockResolvedValue({ id: "title1" });
    mocks.jobSource.findFirst.mockResolvedValue(null);
    mocks.jobSource.create.mockResolvedValue({ id: "src1" });
    mocks.jobStatus.findFirst.mockResolvedValue({ id: "stat-applied" });
    mocks.job.findMany.mockResolvedValue([]);
    mocks.job.create.mockResolvedValue({ id: "job1" });
  });

  it("returns null for NotJobRelated", async () => {
    const r = await findOrCreateJobForClassification({
      userId: "u1",
      label: "NotJobRelated",
      confidence: 1,
      threshold: 0.7,
      extractedCompany: "Acme",
      subject: "Newsletter",
      receivedAt: new Date(),
    });
    expect(r).toEqual({ jobId: null, created: false });
    expect(mocks.job.create).not.toHaveBeenCalled();
  });

  it("returns null when confidence is below threshold", async () => {
    const r = await findOrCreateJobForClassification({
      userId: "u1",
      label: "Applied",
      confidence: 0.6,
      threshold: 0.7,
      extractedCompany: "Acme",
      subject: "Application received",
      receivedAt: new Date(),
    });
    expect(r).toEqual({ jobId: null, created: false });
  });

  it("returns null when no company can be extracted", async () => {
    const r = await findOrCreateJobForClassification({
      userId: "u1",
      label: "Applied",
      confidence: 0.95,
      threshold: 0.7,
      subject: "Application received",
      receivedAt: new Date(),
    });
    expect(r).toEqual({ jobId: null, created: false });
  });

  it("links to the most recent existing Job for that company when there is no role match", async () => {
    mocks.job.findMany.mockResolvedValue([
      { id: "jobA", JobTitle: { value: "frontend engineer" } },
      { id: "jobB", JobTitle: { value: "backend engineer" } },
    ]);
    const r = await findOrCreateJobForClassification({
      userId: "u1",
      label: "Interview",
      confidence: 0.9,
      threshold: 0.7,
      extractedCompany: "Acme",
      subject: "Phone screen",
      receivedAt: new Date(),
    });
    expect(r.jobId).toBe("jobA");
    expect(r.created).toBe(false);
    expect(mocks.job.create).not.toHaveBeenCalled();
  });

  it("prefers a role match when extractedRole is provided", async () => {
    mocks.job.findMany.mockResolvedValue([
      { id: "jobA", JobTitle: { value: "frontend engineer" } },
      { id: "jobB", JobTitle: { value: "backend engineer" } },
    ]);
    const r = await findOrCreateJobForClassification({
      userId: "u1",
      label: "Interview",
      confidence: 0.9,
      threshold: 0.7,
      extractedCompany: "Acme",
      extractedRole: "Backend Engineer",
      subject: "Phone screen",
      receivedAt: new Date(),
    });
    expect(r.jobId).toBe("jobB");
    expect(r.created).toBe(false);
  });

  it("auto-creates a Job when none exist for the company", async () => {
    const receivedAt = new Date("2025-03-01T10:00:00Z");
    const r = await findOrCreateJobForClassification({
      userId: "u1",
      label: "Applied",
      confidence: 0.9,
      threshold: 0.7,
      extractedCompany: "New Company Inc",
      extractedRole: "Software Engineer",
      subject: "Thanks for applying",
      receivedAt,
    });
    expect(r.created).toBe(true);
    expect(r.jobId).toBe("job1");
    const call = mocks.job.create.mock.calls[0][0];
    expect(call.data.userId).toBe("u1");
    expect(call.data.applied).toBe(true);
    expect(call.data.appliedDate).toEqual(receivedAt);
    expect(call.data.statusId).toBe("stat-applied");
  });

  it("creates the JobStatus row if the seeded one is missing", async () => {
    mocks.jobStatus.findFirst.mockResolvedValue(null);
    mocks.jobStatus.create.mockResolvedValue({ id: "new-status" });
    const r = await findOrCreateJobForClassification({
      userId: "u1",
      label: "Offer",
      confidence: 0.95,
      threshold: 0.7,
      extractedCompany: "Acme",
      subject: "Offer letter",
      receivedAt: new Date(),
    });
    expect(r.created).toBe(true);
    expect(mocks.jobStatus.create).toHaveBeenCalled();
  });
});
