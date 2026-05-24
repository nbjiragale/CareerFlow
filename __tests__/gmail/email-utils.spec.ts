import { shouldExcludeEmail } from "@/lib/gmail/email-utils";

describe("shouldExcludeEmail", () => {
  it("returns false when no exclusions are configured", () => {
    expect(shouldExcludeEmail("foo@bar.com", [])).toBe(false);
  });

  it("matches exact addresses (case-insensitive)", () => {
    expect(shouldExcludeEmail("Recruiter@COMPANY.com", ["recruiter@company.com"])).toBe(true);
  });

  it("matches an @domain suffix rule", () => {
    expect(shouldExcludeEmail("noreply@indeed.com", ["@indeed.com"])).toBe(true);
    expect(shouldExcludeEmail("noreply@notindeed.com", ["@indeed.com"])).toBe(false);
  });

  it("matches a *@domain wildcard rule", () => {
    expect(shouldExcludeEmail("hr@linkedin.com", ["*@linkedin.com"])).toBe(true);
    expect(shouldExcludeEmail("hr@linkedinclone.com", ["*@linkedin.com"])).toBe(false);
  });

  it("falls back to substring contains", () => {
    expect(shouldExcludeEmail("noreply-bot@x.com", ["noreply"])).toBe(true);
  });

  it("extracts the bracketed address from a display-name header", () => {
    expect(shouldExcludeEmail("Indeed Jobs <noreply@indeed.com>", ["@indeed.com"])).toBe(true);
  });

  it("ignores blank exclusion entries", () => {
    expect(shouldExcludeEmail("a@b.com", ["", "  "])).toBe(false);
  });
});
