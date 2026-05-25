// CAREERFLOW: Phase 3 — schema-shape guard for the Phase 3 migration.
//
// This spec parses `prisma/schema.prisma` and asserts:
//   - Every direct FK on `User` carries `onDelete: Cascade` (the user-approved
//     deletion contract for Settings → Delete Account in Phase 3 PR #9).
//   - The Phase 3 column additions on `Activity` and `Task` are present with
//     the right defaults.
//   - The new `Reminder` and `EmailLog` models exist with the expected fields.
//   - The new User back-relations (`Reminder Reminder[]`, `EmailLog EmailLog[]`)
//     are declared so cascade actually traverses both directions.
//
// We parse the schema as text rather than introspecting the running Prisma
// client because (a) the running client is mocked in this repo's test setup
// and (b) we want a *static* lock — accidentally removing `onDelete: Cascade`
// from any User FK should fail CI loudly.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SCHEMA = readFileSync(
  resolve(__dirname, "..", "prisma", "schema.prisma"),
  "utf8",
);

function relationLineFor(model: string, fkPattern: RegExp): string | undefined {
  const modelMatch = SCHEMA.match(new RegExp(`model ${model} \\{[\\s\\S]*?^\\}`, "m"));
  if (!modelMatch) return undefined;
  const body = modelMatch[0];
  const line = body.split("\n").find((l) => fkPattern.test(l));
  return line;
}

describe("Phase 3 schema shape", () => {
  describe("User FK cascade contract", () => {
    const directUserFks: Array<{ model: string; field: RegExp }> = [
      { model: "ApiKey", field: /user\s+User\s+@relation/ },
      { model: "UserSettings", field: /user\s+User\s+@relation/ },
      { model: "Profile", field: /user\s+User\s+@relation/ },
      { model: "Activity", field: /User\s+User\s+@relation/ },
      { model: "ActivityType", field: /user\s+User\s+@relation/ },
      { model: "Task", field: /user\s+User\s+@relation/ },
      { model: "Automation", field: /user\s+User\s+@relation/ },
      { model: "Contact", field: /user\s+User\s+@relation/ },
      { model: "JobTitle", field: /user\s+User\s+@relation/ },
      { model: "Location", field: /user\s+User\s+@relation/ },
      { model: "Company", field: /user\s+User\s+@relation/ },
      { model: "JobSource", field: /user\s+User\s+@relation/ },
      { model: "Job", field: /User\s+User\s+@relation/ },
      { model: "Note", field: /user\s+User\s+@relation/ },
      { model: "Tag", field: /user\s+User\s+@relation/ },
      { model: "Question", field: /user\s+User\s+@relation/ },
      { model: "OAuthToken", field: /User\s+User\s+@relation/ },
      { model: "EmailThread", field: /User\s+User\s+@relation/ },
      {
        model: "EmailClassificationCorrection",
        field: /User\s+User\s+@relation/,
      },
      { model: "AiDraft", field: /User\s+User\s+@relation/ },
      { model: "AiAuditLog", field: /User\s+User\s+@relation/ },
      { model: "Reminder", field: /User\s+User\s+@relation/ },
      { model: "EmailLog", field: /User\s+User\s+@relation/ },
    ];

    for (const { model, field } of directUserFks) {
      it(`${model} has onDelete: Cascade on its User FK`, () => {
        const line = relationLineFor(model, field);
        expect(line, `expected ${model} to declare a User relation`).toBeDefined();
        expect(line).toMatch(/onDelete:\s*Cascade/);
      });
    }
  });

  describe("Profile / Resume cascade chain", () => {
    it("Resume.profile has onDelete: Cascade so Profile delete wipes Resume", () => {
      const line = relationLineFor("Resume", /profile\s+Profile\s+@relation/);
      expect(line).toMatch(/onDelete:\s*Cascade/);
    });

    it("CoverLetter.profile has onDelete: Cascade", () => {
      const line = relationLineFor("CoverLetter", /profile\s+Profile\s+@relation/);
      expect(line).toMatch(/onDelete:\s*Cascade/);
    });

    it("ContactInfo.resume has onDelete: Cascade", () => {
      const line = relationLineFor("ContactInfo", /resume\s+Resume\s+@relation/);
      expect(line).toMatch(/onDelete:\s*Cascade/);
    });

    it("ResumeSection.Resume has onDelete: Cascade", () => {
      const line = relationLineFor("ResumeSection", /Resume\s+Resume\s+@relation/);
      expect(line).toMatch(/onDelete:\s*Cascade/);
    });
  });

  describe("Job cascade chain", () => {
    it("Interview.job has onDelete: Cascade", () => {
      const line = relationLineFor("Interview", /job\s+Job\?\s+@relation/);
      expect(line).toMatch(/onDelete:\s*Cascade/);
    });

    it("Job.JobTitle has onDelete: Cascade (lookup is user-owned)", () => {
      const line = relationLineFor("Job", /JobTitle\s+JobTitle\s+@relation/);
      expect(line).toMatch(/onDelete:\s*Cascade/);
    });

    it("Job.Company has onDelete: Cascade (lookup is user-owned)", () => {
      const line = relationLineFor("Job", /Company\s+Company\s+@relation/);
      expect(line).toMatch(/onDelete:\s*Cascade/);
    });

    it("Job.Location uses SetNull (optional)", () => {
      const line = relationLineFor("Job", /Location\s+Location\?\s+@relation/);
      expect(line).toMatch(/onDelete:\s*SetNull/);
    });

    it("Job.JobSource uses SetNull (optional)", () => {
      const line = relationLineFor("Job", /JobSource\s+JobSource\?\s+@relation/);
      expect(line).toMatch(/onDelete:\s*SetNull/);
    });
  });

  describe("Activity model additions", () => {
    it("declares the source column with default \"manual\"", () => {
      expect(SCHEMA).toMatch(/source\s+String\s+@default\("manual"\)/);
    });

    it("declares the metadataJson nullable column", () => {
      expect(SCHEMA).toMatch(/metadataJson\s+String\?/);
    });

    it("adds the (userId, source, startTime) compound index", () => {
      const activity = SCHEMA.match(/model Activity \{[\s\S]*?^\}/m);
      expect(activity).toBeTruthy();
      expect(activity![0]).toMatch(
        /@@index\(\[userId,\s*source,\s*startTime\]\)/,
      );
    });
  });

  describe("Task model additions", () => {
    it("declares remindAt as DateTime?", () => {
      const task = SCHEMA.match(/model Task \{[\s\S]*?^\}/m);
      expect(task).toBeTruthy();
      expect(task![0]).toMatch(/remindAt\s+DateTime\?/);
    });

    it("declares remindedAt as DateTime?", () => {
      const task = SCHEMA.match(/model Task \{[\s\S]*?^\}/m);
      expect(task![0]).toMatch(/remindedAt\s+DateTime\?/);
    });

    it("declares remindChannels with the browser-only default", () => {
      const task = SCHEMA.match(/model Task \{[\s\S]*?^\}/m);
      expect(task![0]).toMatch(
        /remindChannels\s+String\s+@default\("\\\[\\"browser\\"\\\]"\)|remindChannels\s+String\s+@default\(.*browser.*\)/,
      );
    });

    it("declares the Reminder back-relation", () => {
      const task = SCHEMA.match(/model Task \{[\s\S]*?^\}/m);
      expect(task![0]).toMatch(/Reminder\s+Reminder\[\]/);
    });

    it("adds the (remindAt, remindedAt) dispatcher index", () => {
      const task = SCHEMA.match(/model Task \{[\s\S]*?^\}/m);
      expect(task![0]).toMatch(/@@index\(\[remindAt,\s*remindedAt\]\)/);
    });
  });

  describe("New Reminder model", () => {
    const reminderBlock = SCHEMA.match(/model Reminder \{[\s\S]*?^\}/m);

    it("exists", () => {
      expect(reminderBlock).toBeTruthy();
    });

    it("has User and Task FKs with onDelete: Cascade", () => {
      expect(reminderBlock![0]).toMatch(
        /User\s+User\s+@relation\([^)]*onDelete:\s*Cascade[^)]*\)/,
      );
      expect(reminderBlock![0]).toMatch(
        /Task\s+Task\s+@relation\([^)]*onDelete:\s*Cascade[^)]*\)/,
      );
    });

    it("has channel, payloadJson, status, sentAt fields", () => {
      expect(reminderBlock![0]).toMatch(/channel\s+String/);
      expect(reminderBlock![0]).toMatch(/payloadJson\s+String/);
      expect(reminderBlock![0]).toMatch(/status\s+String\s+@default\("pending"\)/);
      expect(reminderBlock![0]).toMatch(/sentAt\s+DateTime\?/);
    });
  });

  describe("New EmailLog model", () => {
    const emailLogBlock = SCHEMA.match(/model EmailLog \{[\s\S]*?^\}/m);

    it("exists", () => {
      expect(emailLogBlock).toBeTruthy();
    });

    it("has User FK with onDelete: Cascade", () => {
      expect(emailLogBlock![0]).toMatch(
        /User\s+User\s+@relation\([^)]*onDelete:\s*Cascade[^)]*\)/,
      );
    });

    it("records toAddress, subject, template, status, sentAt", () => {
      expect(emailLogBlock![0]).toMatch(/toAddress\s+String/);
      expect(emailLogBlock![0]).toMatch(/subject\s+String/);
      expect(emailLogBlock![0]).toMatch(/template\s+String/);
      expect(emailLogBlock![0]).toMatch(/status\s+String/);
      expect(emailLogBlock![0]).toMatch(/sentAt\s+DateTime/);
    });
  });

  describe("User back-relations for Phase 3", () => {
    const userBlock = SCHEMA.match(/model User \{[\s\S]*?^\}/m)!;

    it("declares Reminder back-relation", () => {
      expect(userBlock[0]).toMatch(/Reminder\s+Reminder\[\]/);
    });

    it("declares EmailLog back-relation", () => {
      expect(userBlock[0]).toMatch(/EmailLog\s+EmailLog\[\]/);
    });
  });
});
