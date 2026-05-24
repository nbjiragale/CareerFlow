import { extractEmailBody } from "@/lib/gmail/body";

function b64url(text: string): string {
  return Buffer.from(text, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

describe("extractEmailBody", () => {
  it("returns an empty string for missing payloads", () => {
    expect(extractEmailBody(undefined)).toBe("");
    expect(extractEmailBody(null)).toBe("");
  });

  it("decodes a plain-text body", () => {
    const out = extractEmailBody({
      mimeType: "text/plain",
      body: { data: b64url("hello world") },
    });
    expect(out).toContain("hello world");
  });

  it("strips HTML from text/html parts", () => {
    const html = "<html><body><p>Hello <b>World</b></p><script>alert(1)</script></body></html>";
    const out = extractEmailBody({
      mimeType: "text/html",
      body: { data: b64url(html) },
    });
    expect(out).not.toContain("<");
    expect(out).toContain("Hello");
    expect(out).toContain("World");
    expect(out).not.toContain("alert");
  });

  it("walks multipart children recursively", () => {
    const out = extractEmailBody({
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/plain", body: { data: b64url("plain content") } },
        {
          mimeType: "multipart/related",
          parts: [
            { mimeType: "text/html", body: { data: b64url("<p>html content</p>") } },
          ],
        },
      ],
    });
    expect(out).toContain("plain content");
    expect(out).toContain("html content");
  });
});
