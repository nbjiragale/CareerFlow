vi.mock("@/lib/db", () => {
  const mockPrisma = {
    oAuthToken: { findMany: vi.fn() },
  };
  return { default: mockPrisma };
});

vi.mock("@/lib/gmail/sync", () => ({
  runGmailSyncForUser: vi.fn(),
}));

import { runDueGmailSyncs } from "@/lib/gmail/scheduler";
import prisma from "@/lib/db";
import { runGmailSyncForUser } from "@/lib/gmail/sync";

const findMany = prisma.oAuthToken.findMany as unknown as ReturnType<typeof vi.fn>;
const runSync = runGmailSyncForUser as unknown as ReturnType<typeof vi.fn>;

describe("runDueGmailSyncs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is a no-op when nobody has connected Gmail", async () => {
    findMany.mockResolvedValue([]);
    const summary = await runDueGmailSyncs();
    expect(summary).toEqual({ attempted: 0, succeeded: 0, failed: 0 });
    expect(runSync).not.toHaveBeenCalled();
  });

  it("fans out to every Gmail-connected user", async () => {
    findMany.mockResolvedValue([{ userId: "a" }, { userId: "b" }, { userId: "c" }]);
    runSync.mockResolvedValue({
      classifier: "keyword",
      fetched: 0,
      classified: 0,
      jobThreads: 0,
      needsReview: 0,
      jobsCreated: 0,
      jobsLinked: 0,
      startedAt: "now",
      finishedAt: "now",
    });

    const summary = await runDueGmailSyncs();

    expect(summary.attempted).toBe(3);
    expect(summary.succeeded).toBe(3);
    expect(summary.failed).toBe(0);
    expect(runSync).toHaveBeenCalledTimes(3);
    expect(runSync).toHaveBeenNthCalledWith(1, "a");
    expect(runSync).toHaveBeenNthCalledWith(2, "b");
    expect(runSync).toHaveBeenNthCalledWith(3, "c");
  });

  it("isolates one user's failure from the rest", async () => {
    findMany.mockResolvedValue([{ userId: "a" }, { userId: "b" }]);
    runSync
      .mockRejectedValueOnce(new Error("Gmail not connected"))
      .mockResolvedValueOnce({
        classifier: "keyword",
        fetched: 0,
        classified: 0,
        jobThreads: 0,
        needsReview: 0,
        jobsCreated: 0,
        jobsLinked: 0,
        startedAt: "now",
        finishedAt: "now",
      });

    const summary = await runDueGmailSyncs();
    expect(summary).toEqual({ attempted: 2, succeeded: 1, failed: 1 });
  });
});
