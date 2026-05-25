// CAREERFLOW: Phase 3 — locks the generated migration SQL.
//
// We read the actual `migration.sql` Prisma produced and assert the
// constraint shape. If a future schema change accidentally drops a cascade
// rule, Prisma will regenerate the migration body and this spec will catch
// the regression in CI.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATIONS_DIR = resolve(__dirname, "..", "prisma", "migrations");

const PHASE_3_MIGRATION = readdirSync(MIGRATIONS_DIR).find((d) =>
  d.endsWith("_careerflow_phase_3_timeline_reminders"),
);

if (!PHASE_3_MIGRATION) {
  throw new Error(
    "Phase 3 migration directory not found under prisma/migrations/",
  );
}

const SQL = readFileSync(
  resolve(MIGRATIONS_DIR, PHASE_3_MIGRATION, "migration.sql"),
  "utf8",
);

function userFkConstraintFor(tableConstraintName: string): RegExp {
  return new RegExp(
    `CONSTRAINT\\s+"${tableConstraintName}"\\s+FOREIGN KEY\\s*\\("(userId|createdBy)"\\)\\s+REFERENCES\\s+"User"\\s*\\("id"\\)\\s+ON DELETE CASCADE ON UPDATE CASCADE`,
  );
}

describe("Phase 3 migration SQL", () => {
  describe("new tables", () => {
    it("creates the Reminder table", () => {
      expect(SQL).toMatch(/CREATE TABLE "Reminder"/);
      expect(SQL).toMatch(/"channel" TEXT NOT NULL/);
      expect(SQL).toMatch(/"payloadJson" TEXT NOT NULL/);
      expect(SQL).toMatch(/"status" TEXT NOT NULL DEFAULT 'pending'/);
    });

    it("creates the EmailLog table", () => {
      expect(SQL).toMatch(/CREATE TABLE "EmailLog"/);
      expect(SQL).toMatch(/"toAddress" TEXT NOT NULL/);
      expect(SQL).toMatch(/"template" TEXT NOT NULL/);
    });
  });

  describe("Activity table redefinition", () => {
    it("adds the source column with default 'manual'", () => {
      expect(SQL).toMatch(/"source" TEXT NOT NULL DEFAULT 'manual'/);
    });

    it("adds the metadataJson nullable column", () => {
      expect(SQL).toMatch(/"metadataJson" TEXT,/);
    });

    it("preserves existing rows via INSERT INTO new_Activity ... SELECT FROM Activity", () => {
      expect(SQL).toMatch(/INSERT INTO "new_Activity"[\s\S]*?SELECT[\s\S]*?FROM "Activity"/);
    });

    it("creates the (userId, source, startTime) index", () => {
      expect(SQL).toMatch(
        /CREATE INDEX "Activity_userId_source_startTime_idx" ON "Activity"\("userId", "source", "startTime"\)/,
      );
    });
  });

  describe("Task table redefinition", () => {
    it("adds remindAt as nullable DateTime", () => {
      // Task table's redefine block; remindAt should be DATETIME without NOT NULL.
      const taskBlock = SQL.match(
        /CREATE TABLE "new_Task" \([\s\S]*?\);/,
      );
      expect(taskBlock).toBeTruthy();
      expect(taskBlock![0]).toMatch(/"remindAt" DATETIME,/);
      expect(taskBlock![0]).toMatch(/"remindedAt" DATETIME,/);
    });

    it("adds remindChannels with the browser-only default", () => {
      const taskBlock = SQL.match(/CREATE TABLE "new_Task" \([\s\S]*?\);/)!;
      expect(taskBlock[0]).toMatch(
        /"remindChannels" TEXT NOT NULL DEFAULT '\["browser"\]'/,
      );
    });

    it("creates the (remindAt, remindedAt) dispatcher index", () => {
      expect(SQL).toMatch(
        /CREATE INDEX "Task_remindAt_remindedAt_idx" ON "Task"\("remindAt", "remindedAt"\)/,
      );
    });
  });

  describe("User FK cascade rules", () => {
    const cases: Array<{ desc: string; constraint: string }> = [
      { desc: "ApiKey", constraint: "ApiKey_userId_fkey" },
      { desc: "Profile", constraint: "Profile_userId_fkey" },
      { desc: "Activity", constraint: "Activity_userId_fkey" },
      { desc: "ActivityType", constraint: "ActivityType_createdBy_fkey" },
      { desc: "Task", constraint: "Task_userId_fkey" },
      { desc: "Automation", constraint: "Automation_userId_fkey" },
      { desc: "Contact", constraint: "Contact_createdBy_fkey" },
      { desc: "JobTitle", constraint: "JobTitle_createdBy_fkey" },
      { desc: "Location", constraint: "Location_createdBy_fkey" },
      { desc: "Company", constraint: "Company_createdBy_fkey" },
      { desc: "JobSource", constraint: "JobSource_createdBy_fkey" },
      { desc: "Job", constraint: "Job_userId_fkey" },
      { desc: "Note", constraint: "Note_userId_fkey" },
      { desc: "Tag", constraint: "Tag_createdBy_fkey" },
      { desc: "Question", constraint: "Question_createdBy_fkey" },
      { desc: "OAuthToken", constraint: "OAuthToken_userId_fkey" },
      { desc: "EmailThread", constraint: "EmailThread_userId_fkey" },
      {
        desc: "EmailClassificationCorrection",
        constraint: "EmailClassificationCorrection_userId_fkey",
      },
      { desc: "AiDraft", constraint: "AiDraft_userId_fkey" },
      { desc: "AiAuditLog", constraint: "AiAuditLog_userId_fkey" },
      { desc: "Reminder", constraint: "Reminder_userId_fkey" },
      { desc: "EmailLog", constraint: "EmailLog_userId_fkey" },
    ];

    for (const { desc, constraint } of cases) {
      it(`${desc} cascades on User delete`, () => {
        expect(SQL).toMatch(userFkConstraintFor(constraint));
      });
    }
  });

  describe("Indirect cascade chain", () => {
    it("Resume.profileId cascades", () => {
      expect(SQL).toMatch(
        /CONSTRAINT\s+"Resume_profileId_fkey"\s+FOREIGN KEY\s*\("profileId"\)\s+REFERENCES\s+"Profile"\s*\("id"\)\s+ON DELETE CASCADE/,
      );
    });

    it("CoverLetter.profileId cascades", () => {
      expect(SQL).toMatch(
        /CONSTRAINT\s+"CoverLetter_profileId_fkey"\s+FOREIGN KEY\s*\("profileId"\)\s+REFERENCES\s+"Profile"\s*\("id"\)\s+ON DELETE CASCADE/,
      );
    });

    it("ContactInfo.resumeId cascades", () => {
      expect(SQL).toMatch(
        /CONSTRAINT\s+"ContactInfo_resumeId_fkey"\s+FOREIGN KEY\s*\("resumeId"\)\s+REFERENCES\s+"Resume"\s*\("id"\)\s+ON DELETE CASCADE/,
      );
    });

    it("ResumeSection.resumeId cascades", () => {
      expect(SQL).toMatch(
        /CONSTRAINT\s+"ResumeSection_resumeId_fkey"\s+FOREIGN KEY\s*\("resumeId"\)\s+REFERENCES\s+"Resume"\s*\("id"\)\s+ON DELETE CASCADE/,
      );
    });

    it("Interview.jobId cascades", () => {
      expect(SQL).toMatch(
        /CONSTRAINT\s+"Interview_jobId_fkey"\s+FOREIGN KEY\s*\("jobId"\)\s+REFERENCES\s+"Job"\s*\("id"\)\s+ON DELETE CASCADE/,
      );
    });
  });

  describe("Optional FK fallbacks", () => {
    it("Job.locationId is SetNull (optional)", () => {
      expect(SQL).toMatch(
        /CONSTRAINT\s+"Job_locationId_fkey"\s+FOREIGN KEY\s*\("locationId"\)\s+REFERENCES\s+"Location"\s*\("id"\)\s+ON DELETE SET NULL/,
      );
    });

    it("Job.jobSourceId is SetNull (optional)", () => {
      expect(SQL).toMatch(
        /CONSTRAINT\s+"Job_jobSourceId_fkey"\s+FOREIGN KEY\s*\("jobSourceId"\)\s+REFERENCES\s+"JobSource"\s*\("id"\)\s+ON DELETE SET NULL/,
      );
    });

    it("Activity.taskId is SetNull (optional)", () => {
      expect(SQL).toMatch(
        /CONSTRAINT\s+"Activity_taskId_fkey"\s+FOREIGN KEY\s*\("taskId"\)\s+REFERENCES\s+"Task"\s*\("id"\)\s+ON DELETE SET NULL/,
      );
    });

    it("WorkExperience.resumeSectionId is SetNull (optional)", () => {
      expect(SQL).toMatch(
        /CONSTRAINT\s+"WorkExperience_resumeSectionId_fkey"\s+FOREIGN KEY\s*\("resumeSectionId"\)\s+REFERENCES\s+"ResumeSection"\s*\("id"\)\s+ON DELETE SET NULL/,
      );
    });
  });
});
