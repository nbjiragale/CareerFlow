// @vitest-environment node
import { describe, it, expect } from "vitest";
import zlib from "node:zlib";
import { renderToBuffer } from "@react-pdf/renderer";
import { ResumePdf } from "@/components/profile/pdf/ResumePdf";
import { SectionType } from "@/models/profile.model";

// Pull visible text out of a react-pdf/pdfkit buffer: inflate each content
// stream and decode the hex glyph tokens (<..>) inside its TJ operators.
function extractPdfText(buf: Buffer): string {
  const latin = buf.toString("latin1");
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  const parts: string[] = [];
  while ((m = re.exec(latin))) {
    const start = m.index + m[0].length;
    const end = buf.indexOf("endstream", start);
    if (end === -1) continue;
    const chunk = buf.subarray(start, end);
    let inflated: string;
    try {
      inflated = zlib.inflateSync(chunk).toString("latin1");
    } catch {
      continue;
    }
    const hex = inflated.match(/<([0-9a-fA-F]+)>/g) || [];
    for (const h of hex) {
      const hx = h.slice(1, -1);
      let t = "";
      for (let i = 0; i + 1 < hx.length; i += 2)
        t += String.fromCharCode(parseInt(hx.substr(i, 2), 16));
      parts.push(t);
    }
  }
  return parts.join("");
}

const contact = {
  firstName: "John",
  lastName: "Doe",
  headline: "Full Stack Developer",
  email: "john@example.com",
};

describe("ResumePdf", () => {
  it("renders every section for a populated resume", async () => {
    const resume: any = {
      title: "John Doe",
      ContactInfo: contact,
      ResumeSections: [
        { sectionType: SectionType.SUMMARY, sectionTitle: "Summary", summary: { content: "<p>Experienced developer.</p>" } },
        { sectionType: SectionType.EXPERIENCE, sectionTitle: "Work Experience", workExperiences: [
          { id: "e1", Company: { label: "Amazon" }, jobTitle: { label: "Senior SWE" }, location: { label: "Seattle, WA" }, startDate: new Date("2020-01-01"), endDate: new Date("2023-01-01"), description: "<p>Built systems.</p>" },
        ] },
        { sectionType: SectionType.EDUCATION, sectionTitle: "Education", educations: [
          { id: "ed1", institution: "University of Washington", degree: "BS", fieldOfStudy: "CS", location: { label: "Seattle, WA" }, startDate: new Date("2012-09-01"), endDate: new Date("2016-06-01") },
        ] },
      ],
    };
    const text = extractPdfText(await renderToBuffer(<ResumePdf resume={resume} /> as any));
    // Section titles render uppercased via the `textTransform: "uppercase"` style.
    expect(text).toContain("John Doe");
    expect(text).toContain("SUMMARY");
    expect(text).toContain("WORK EXPERIENCE");
    expect(text).toContain("Amazon");
    expect(text).toContain("EDUCATION");
  });

  it("shows an empty-state note when the resume has no sections", async () => {
    const resume: any = { title: "Java dev", ContactInfo: contact, ResumeSections: [] };
    const text = extractPdfText(await renderToBuffer(<ResumePdf resume={resume} /> as any));
    expect(text).toContain("John Doe");
    expect(text).toContain("no sections yet");
  });

  it("does not blank the PDF when an experience has an invalid date (regression)", async () => {
    const resume: any = {
      title: "Bad dates",
      ContactInfo: contact,
      ResumeSections: [
        { sectionType: SectionType.EXPERIENCE, sectionTitle: "Work Experience", workExperiences: [
          { id: "e1", Company: { label: "Acme" }, jobTitle: { label: "Engineer" }, location: { label: "Remote" }, startDate: "" as any, endDate: "not-a-date" as any, description: "<p>Did work.</p>" },
        ] },
      ],
    };
    // Previously this threw "Invalid time value" and produced no document.
    const text = extractPdfText(await renderToBuffer(<ResumePdf resume={resume} /> as any));
    expect(text).toContain("WORK EXPERIENCE");
    expect(text).toContain("Acme");
  });
});
