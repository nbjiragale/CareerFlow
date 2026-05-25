// CAREERFLOW: Phase 3 (PR #9) — tests for the user data-export collector.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  const mockPrisma = {
    user: { findUnique: vi.fn() },
  };
  return { default: mockPrisma };
});

import {
  collectUserExport,
  EXPORTED_TABLES,
  EXPORT_SCHEMA_VERSION,
} from "@/lib/export/collect";
import prisma from "@/lib/db";

const findUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;

function fixtureUser() {
  return {
    id: "u1",
    name: "Ada",
    email: "ada@example.com",
    password: "hashed-secret",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    Settings: { id: "s1", userId: "u1", settings: "{}" },
    ApiKey: [
      {
        id: "k1",
        userId: "u1",
        provider: "openai",
        encryptedKey: "CIPHERTEXT",
        iv: "IVDATA",
        last4: "ab12",
        label: "work",
      },
    ],
    OAuthToken: [
      {
        id: "o1",
        userId: "u1",
        provider: "google",
        encryptedRefreshToken: "RT_CIPHER",
        refreshTokenIv: "RT_IV",
        encryptedAccessToken: "AT_CIPHER",
        accessTokenIv: "AT_IV",
        scope: "gmail.readonly",
        email: "ada@gmail.com",
      },
    ],
    JobTitle: [{ id: "jt1" }],
    Location: [{ id: "loc1" }],
    Company: [{ id: "co1" }],
    JobSource: [{ id: "js1" }],
    Contact: [{ id: "c1" }],
    ActivityType: [{ id: "at1" }],
    Activity: [{ id: "act1" }],
    Task: [{ id: "t1" }],
    Note: [{ id: "n1" }],
    Tag: [{ id: "tag1" }],
    Question: [{ id: "q1" }],
    EmailThread: [{ id: "et1" }],
    EmailClassificationCorrection: [{ id: "ecc1" }],
    AiDraft: [{ id: "ad1" }],
    AiAuditLog: [{ id: "aal1" }],
    Reminder: [{ id: "r1" }],
    EmailLog: [{ id: "el1" }],
    jobsApplied: [{ id: "job1", Interview: [{ id: "iv1" }, { id: "iv2" }] }],
    Automation: [{ id: "au1", runs: [{ id: "run1" }] }],
    Profile: [
      {
        id: "p1",
        userId: "u1",
        coverLetters: [{ id: "cl1" }],
        resumes: [
          {
            id: "res1",
            File: { id: "f1" },
            ContactInfo: { id: "ci1" },
            ResumeSections: [
              {
                id: "rs1",
                summary: { id: "sum1" },
                workExperiences: [{ id: "we1" }],
                educations: [{ id: "ed1" }],
                licenseOrCertifications: [{ id: "lc1" }],
                others: [{ id: "os1" }],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("collectUserExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the user does not exist", async () => {
    findUnique.mockResolvedValue(null);
    expect(await collectUserExport("nope")).toBeNull();
  });

  it("scopes the query to the requested user", async () => {
    findUnique.mockResolvedValue(fixtureUser());
    await collectUserExport("u1");
    expect(findUnique.mock.calls[0][0].where).toEqual({ id: "u1" });
  });

  it("includes a _meta block", async () => {
    findUnique.mockResolvedValue(fixtureUser());
    const out = (await collectUserExport("u1"))!;
    expect(out._meta.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(out._meta.userId).toBe("u1");
    expect(typeof out._meta.exportedAt).toBe("string");
    expect(out._meta.note).toMatch(/redacted/i);
  });

  it("has a key for every user-owned table", async () => {
    findUnique.mockResolvedValue(fixtureUser());
    const out = (await collectUserExport("u1"))!;
    for (const table of EXPORTED_TABLES) {
      expect(out, `missing export key: ${table}`).toHaveProperty(table);
    }
  });

  it("omits the password hash from the user row", async () => {
    findUnique.mockResolvedValue(fixtureUser());
    const out = (await collectUserExport("u1"))!;
    const user = out.user as Record<string, unknown>;
    expect(user.password).toBeUndefined();
    expect(user.email).toBe("ada@example.com");
    // included relations are flattened out of the user object
    expect(user.Profile).toBeUndefined();
    expect(user.ApiKey).toBeUndefined();
  });

  it("redacts ApiKey secrets but keeps metadata", async () => {
    findUnique.mockResolvedValue(fixtureUser());
    const out = (await collectUserExport("u1"))!;
    const key = (out.apiKeys as Record<string, unknown>[])[0];
    expect(key.encryptedKey).toBeUndefined();
    expect(key.iv).toBeUndefined();
    expect(key._encrypted).toBe(true);
    expect(key.last4).toBe("ab12");
    expect(key.provider).toBe("openai");
  });

  it("redacts OAuthToken secrets but keeps metadata", async () => {
    findUnique.mockResolvedValue(fixtureUser());
    const out = (await collectUserExport("u1"))!;
    const token = (out.oauthTokens as Record<string, unknown>[])[0];
    expect(token.encryptedRefreshToken).toBeUndefined();
    expect(token.refreshTokenIv).toBeUndefined();
    expect(token.encryptedAccessToken).toBeUndefined();
    expect(token.accessTokenIv).toBeUndefined();
    expect(token._encrypted).toBe(true);
    expect(token.scope).toBe("gmail.readonly");
    expect(token.email).toBe("ada@gmail.com");
  });

  it("flattens nested relations into their own table arrays", async () => {
    findUnique.mockResolvedValue(fixtureUser());
    const out = (await collectUserExport("u1"))!;
    expect((out.resumes as unknown[]).length).toBe(1);
    expect((out.resumeSections as unknown[]).length).toBe(1);
    expect((out.workExperiences as unknown[]).length).toBe(1);
    expect((out.educations as unknown[]).length).toBe(1);
    expect((out.summaries as unknown[]).length).toBe(1);
    expect((out.files as unknown[]).length).toBe(1);
    expect((out.contactInfos as unknown[]).length).toBe(1);
    expect((out.coverLetters as unknown[]).length).toBe(1);
    expect((out.interviews as unknown[]).length).toBe(2);
    expect((out.automationRuns as unknown[]).length).toBe(1);

    // flattened rows are stripped of their nested relation keys
    const resume = (out.resumes as Record<string, unknown>[])[0];
    expect(resume.ResumeSections).toBeUndefined();
    expect(resume.id).toBe("res1");
  });

  it("does not leak any encrypted/secret material anywhere in the blob", async () => {
    findUnique.mockResolvedValue(fixtureUser());
    const out = (await collectUserExport("u1"))!;
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain("hashed-secret");
    expect(serialized).not.toContain("CIPHERTEXT");
    expect(serialized).not.toContain("RT_CIPHER");
    expect(serialized).not.toContain("AT_CIPHER");
  });
});
