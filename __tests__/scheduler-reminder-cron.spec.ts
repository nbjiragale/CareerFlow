// CAREERFLOW: Phase 3 — tests that the scheduler wires up the 1-min reminder
// cron and respects SCHEDULER_CONSTANTS.ENABLED.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("node-cron", () => ({
  default: {
    schedule: vi.fn(() => ({ stop: vi.fn() })),
    validate: vi.fn(() => true),
  },
}));

vi.mock("@/lib/constants", () => ({
  SCHEDULER_CONSTANTS: {
    ENABLED: true,
    CRON_EXPRESSION: "*/15 * * * *",
    REMINDER_CRON_EXPRESSION: "* * * * *",
    MAX_REMINDERS_PER_TICK: 50,
  },
}));

vi.mock("@/lib/db", () => ({ default: {} }));
vi.mock("@/lib/scraper", () => ({ runAutomation: vi.fn() }));
vi.mock("@/lib/gmail/scheduler", () => ({ runDueGmailSyncs: vi.fn() }));
vi.mock("@/lib/notifications/dispatcher", () => ({ runDueReminders: vi.fn() }));

import cron from "node-cron";
import { SCHEDULER_CONSTANTS } from "@/lib/constants";
import { startScheduler, stopScheduler } from "@/lib/scheduler";
import { runDueReminders } from "@/lib/notifications/dispatcher";

const scheduleMock = cron.schedule as unknown as ReturnType<typeof vi.fn>;
const runReminders = runDueReminders as unknown as ReturnType<typeof vi.fn>;

describe("scheduler reminder cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (SCHEDULER_CONSTANTS as { ENABLED: boolean }).ENABLED = true;
  });

  afterEach(() => {
    stopScheduler();
  });

  it("schedules a 1-minute reminder cron alongside the 15-min batch cron", () => {
    startScheduler();

    const expressions = scheduleMock.mock.calls.map((call) => call[0]);
    expect(expressions).toContain("*/15 * * * *");
    expect(expressions).toContain("* * * * *");
  });

  it("invokes the reminder dispatcher when the reminder cron fires", async () => {
    startScheduler();

    const reminderCall = scheduleMock.mock.calls.find((call) => call[0] === "* * * * *");
    expect(reminderCall).toBeTruthy();

    const tick = reminderCall![1] as () => Promise<void>;
    await tick();
    expect(runReminders).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the scheduler is disabled", () => {
    (SCHEDULER_CONSTANTS as { ENABLED: boolean }).ENABLED = false;
    startScheduler();
    expect(scheduleMock).not.toHaveBeenCalled();
  });
});
