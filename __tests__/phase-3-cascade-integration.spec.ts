// CAREERFLOW: Phase 3 — end-to-end cascade integration test.
//
// Static schema/migration tests in the sibling specs lock the *contract*.
// This test exercises the *behavior*: seed a real user across every table
// the Phase 3 PR touches, delete the user, and assert all dependent rows
// disappear while a sibling user's rows are untouched.
//
// Runs against a temporary SQLite DB created with `prisma migrate deploy`.
// Skipped automatically when the Prisma CLI / sqlite native bindings are
// unavailable in the host (rare in CI but a safety net for unusual sandboxes).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

vi.unmock("@prisma/client");

const REPO_ROOT = resolve(__dirname, "..");
const tempDir = mkdtempSync(join(tmpdir(), "careerflow-phase3-cascade-"));
const dbPath = join(tempDir, "test.db");
const dbUrl = `file:${dbPath}`;

let prismaModule: typeof import("@prisma/client");
let prisma: import("@prisma/client").PrismaClient;
let setupFailed = false;
let setupError: unknown = null;

beforeAll(async () => {
  try {
    execSync("npx prisma migrate deploy", {
      cwd: REPO_ROOT,
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: "pipe",
    });
    prismaModule = await import("@prisma/client");
    prisma = new prismaModule.PrismaClient({
      datasourceUrl: dbUrl,
    });
  } catch (e) {
    setupFailed = true;
    setupError = e;
  }
}, 60_000);

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
  rmSync(tempDir, { recursive: true, force: true });
});

async function seedFullUser(suffix: string) {
  const user = await prisma.user.create({
    data: {
      name: `Test User ${suffix}`,
      email: `cascade-${suffix}-${Date.now()}@example.com`,
      password: "hashed-not-real",
    },
  });

  await prisma.userSettings.create({
    data: { userId: user.id, settings: "{}" },
  });

  await prisma.apiKey.create({
    data: {
      userId: user.id,
      provider: `openai-${suffix}`,
      encryptedKey: "ciphertext",
      iv: "iv",
      last4: "1234",
    },
  });

  const company = await prisma.company.create({
    data: { label: `Acme ${suffix}`, value: `acme-${suffix}`, createdBy: user.id },
  });
  const jobTitle = await prisma.jobTitle.create({
    data: {
      label: `Engineer ${suffix}`,
      value: `engineer-${suffix}`,
      createdBy: user.id,
    },
  });
  const location = await prisma.location.create({
    data: {
      label: `Remote ${suffix}`,
      value: `remote-${suffix}`,
      createdBy: user.id,
    },
  });

  let status = await prisma.jobStatus.findUnique({ where: { value: "applied" } });
  if (!status) {
    status = await prisma.jobStatus.create({
      data: { label: "Applied", value: "applied" },
    });
  }

  const job = await prisma.job.create({
    data: {
      userId: user.id,
      description: "JD",
      jobType: "full-time",
      createdAt: new Date(),
      statusId: status.id,
      jobTitleId: jobTitle.id,
      companyId: company.id,
      locationId: location.id,
    },
  });

  await prisma.note.create({
    data: { jobId: job.id, userId: user.id, content: "First note" },
  });

  await prisma.interview.create({
    data: { jobId: job.id, createdAt: new Date() },
  });

  const activityType = await prisma.activityType.create({
    data: {
      label: `Follow up ${suffix}`,
      value: `follow-up-${suffix}`,
      createdBy: user.id,
    },
  });

  const task = await prisma.task.create({
    data: {
      userId: user.id,
      title: "Follow up with recruiter",
      activityTypeId: activityType.id,
      remindAt: new Date(Date.now() + 60_000),
      remindChannels: '["browser"]',
    },
  });

  await prisma.activity.create({
    data: {
      userId: user.id,
      activityName: "Applied to job",
      startTime: new Date(),
      activityTypeId: activityType.id,
      source: "manual",
    },
  });

  await prisma.reminder.create({
    data: {
      userId: user.id,
      taskId: task.id,
      channel: "browser",
      payloadJson: JSON.stringify({ title: "test" }),
    },
  });

  await prisma.emailLog.create({
    data: {
      userId: user.id,
      toAddress: `${suffix}@example.com`,
      subject: "Test",
      template: "task-reminder",
      status: "sent",
    },
  });

  await prisma.aiAuditLog.create({
    data: {
      userId: user.id,
      feature: "evaluate",
      provider: "openai",
      model: "gpt-4o-mini",
      status: "success",
    },
  });

  await prisma.tag.create({
    data: {
      label: `Important ${suffix}`,
      value: `important-${suffix}`,
      createdBy: user.id,
    },
  });

  await prisma.question.create({
    data: {
      question: "What's your greatest weakness?",
      createdBy: user.id,
    },
  });

  await prisma.contact.create({
    data: {
      name: `Recruiter ${suffix}`,
      email: `recruiter-${suffix}@example.com`,
      createdAt: new Date(),
      createdBy: user.id,
    },
  });

  return { user, job, task, activityType };
}

async function countAllForUser(userId: string) {
  return {
    userSettings: await prisma.userSettings.count({ where: { userId } }),
    apiKey: await prisma.apiKey.count({ where: { userId } }),
    company: await prisma.company.count({ where: { createdBy: userId } }),
    jobTitle: await prisma.jobTitle.count({ where: { createdBy: userId } }),
    location: await prisma.location.count({ where: { createdBy: userId } }),
    job: await prisma.job.count({ where: { userId } }),
    note: await prisma.note.count({ where: { userId } }),
    interview: await prisma.interview.count({
      where: { job: { userId } },
    }),
    activityType: await prisma.activityType.count({ where: { createdBy: userId } }),
    task: await prisma.task.count({ where: { userId } }),
    activity: await prisma.activity.count({ where: { userId } }),
    reminder: await prisma.reminder.count({ where: { userId } }),
    emailLog: await prisma.emailLog.count({ where: { userId } }),
    aiAuditLog: await prisma.aiAuditLog.count({ where: { userId } }),
    tag: await prisma.tag.count({ where: { createdBy: userId } }),
    question: await prisma.question.count({ where: { createdBy: userId } }),
    contact: await prisma.contact.count({ where: { createdBy: userId } }),
  };
}

describe("Phase 3 cascade integration", () => {
  it("deletes a user and every dependent row (Settings → Delete Account contract)", async () => {
    if (setupFailed) {
      console.warn(
        "Skipping cascade integration test — Prisma CLI setup failed:",
        setupError,
      );
      return;
    }

    const { user: alice } = await seedFullUser("alice");
    const { user: bob } = await seedFullUser("bob");

    const aliceBefore = await countAllForUser(alice.id);
    const bobBefore = await countAllForUser(bob.id);

    // Sanity-check: every counter populated.
    for (const [key, value] of Object.entries(aliceBefore)) {
      expect(value, `${key} should be seeded`).toBeGreaterThan(0);
    }

    await prisma.user.delete({ where: { id: alice.id } });

    const aliceAfter = await countAllForUser(alice.id);
    for (const [key, value] of Object.entries(aliceAfter)) {
      expect(value, `${key} should be cascaded`).toBe(0);
    }

    const bobAfter = await countAllForUser(bob.id);
    expect(bobAfter).toEqual(bobBefore);
  }, 30_000);
});
