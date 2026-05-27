"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Link,
} from "@react-pdf/renderer";
import { Resume, SectionType } from "@/models/profile.model";
import { format } from "date-fns";

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 48,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111",
  },
  headerName: {
    fontSize: 22,
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },
  headerHeadline: {
    fontSize: 11,
    textAlign: "center",
    color: "#444",
    marginTop: 2,
  },
  headerContact: {
    fontSize: 9,
    textAlign: "center",
    color: "#333",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    borderBottomWidth: 0.75,
    borderBottomColor: "#000",
    paddingBottom: 2,
    marginTop: 12,
    marginBottom: 4,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  entryHeaderLeft: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
  },
  entryHeaderRight: {
    fontSize: 10,
    color: "#444",
  },
  entrySubHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 1,
  },
  entrySubLeft: {
    fontSize: 10,
    fontStyle: "italic",
    color: "#333",
  },
  entrySubRight: {
    fontSize: 9.5,
    color: "#666",
  },
  bulletRow: {
    flexDirection: "row",
    marginTop: 2,
    paddingLeft: 8,
  },
  bulletDot: {
    width: 8,
    fontSize: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.35,
  },
  summary: {
    fontSize: 10,
    lineHeight: 1.4,
    marginTop: 2,
  },
  emptyState: {
    fontSize: 10,
    color: "#666",
    textAlign: "center",
    marginTop: 24,
    lineHeight: 1.4,
  },
});

function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  return html
    .replace(/<\/(p|div|li|br|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r/g, "");
}

function paragraphsFrom(html: string | undefined | null): string[] {
  return stripHtml(html)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// Guard every date format: real resume data (unlike seeded mock data) often has
// empty or unparseable dates, and date-fns `format` throws "Invalid time value"
// on an Invalid Date. An uncaught throw here aborts the whole <Document> render,
// producing a blank PDF — so coerce bad dates to "" instead.
function fmtDate(value?: Date | string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : format(d, "MMM yyyy");
}

function fmtRange(start?: Date | string | null, end?: Date | string | null) {
  const s = fmtDate(start);
  const e = fmtDate(end) || (start ? "Present" : "");
  return s && e ? `${s} – ${e}` : s || e || "";
}

function Bullets({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line, i) => (
        <View key={i} style={styles.bulletRow} wrap={false}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{line}</Text>
        </View>
      ))}
    </>
  );
}

export function ResumePdf({ resume }: { resume: Resume }) {
  const contact = resume.ContactInfo;
  const sections = resume.ResumeSections ?? [];
  const summary = sections.find((s) => s.sectionType === SectionType.SUMMARY);
  const experience = sections.find(
    (s) => s.sectionType === SectionType.EXPERIENCE,
  );
  const education = sections.find(
    (s) => s.sectionType === SectionType.EDUCATION,
  );
  const certification = sections.find(
    (s) => s.sectionType === SectionType.CERTIFICATION ||
      s.sectionType === SectionType.LICENSE,
  );

  const contactLine = [contact?.email, contact?.phone, contact?.address]
    .filter(Boolean)
    .join("  •  ");

  // A resume with only contact info renders as a near-blank header-only page,
  // which reads as "the PDF didn't render." Show an explicit note instead.
  const hasContent =
    !!summary?.summary?.content ||
    (experience?.workExperiences?.length ?? 0) > 0 ||
    (education?.educations?.length ?? 0) > 0 ||
    (certification?.licenseOrCertifications?.length ?? 0) > 0;

  return (
    <Document title={resume.title}>
      <Page size="LETTER" style={styles.page}>
        {contact ? (
          <View>
            <Text style={styles.headerName}>
              {`${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() ||
                resume.title}
            </Text>
            {contact.headline ? (
              <Text style={styles.headerHeadline}>{contact.headline}</Text>
            ) : null}
            {contactLine ? (
              <Text style={styles.headerContact}>{contactLine}</Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.headerName}>{resume.title}</Text>
        )}

        {!hasContent ? (
          <View>
            <Text style={styles.emptyState}>
              This resume has no sections yet. Use “Add Section” to add a
              summary, work experience, education, or certifications, then
              download or preview the PDF again.
            </Text>
          </View>
        ) : null}

        {summary?.summary?.content ? (
          <View>
            <Text style={styles.sectionTitle}>
              {summary.sectionTitle || "Summary"}
            </Text>
            {paragraphsFrom(summary.summary.content).map((para, i) => (
              <Text key={i} style={styles.summary}>
                {para}
              </Text>
            ))}
          </View>
        ) : null}

        {experience && (experience.workExperiences?.length ?? 0) > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>
              {experience.sectionTitle || "Experience"}
            </Text>
            {experience.workExperiences!.map((exp) => {
              const bullets = paragraphsFrom(exp.description);
              return (
                <View key={exp.id} wrap={false}>
                  <View style={styles.entryHeader}>
                    <Text style={styles.entryHeaderLeft}>
                      {exp.Company?.label ?? ""}
                    </Text>
                    <Text style={styles.entryHeaderRight}>
                      {fmtRange(exp.startDate, exp.endDate)}
                    </Text>
                  </View>
                  <View style={styles.entrySubHeader}>
                    <Text style={styles.entrySubLeft}>
                      {exp.jobTitle?.label ?? ""}
                    </Text>
                    <Text style={styles.entrySubRight}>
                      {exp.location?.label ?? ""}
                    </Text>
                  </View>
                  <Bullets lines={bullets} />
                </View>
              );
            })}
          </View>
        ) : null}

        {education && (education.educations?.length ?? 0) > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>
              {education.sectionTitle || "Education"}
            </Text>
            {education.educations!.map((edu) => (
              <View key={edu.id} wrap={false}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryHeaderLeft}>{edu.institution}</Text>
                  <Text style={styles.entryHeaderRight}>
                    {fmtRange(edu.startDate, edu.endDate)}
                  </Text>
                </View>
                <View style={styles.entrySubHeader}>
                  <Text style={styles.entrySubLeft}>
                    {[edu.degree, edu.fieldOfStudy].filter(Boolean).join(", ")}
                  </Text>
                  <Text style={styles.entrySubRight}>
                    {edu.location?.label ?? ""}
                  </Text>
                </View>
                {edu.description ? (
                  <Bullets lines={paragraphsFrom(edu.description)} />
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {certification &&
        (certification.licenseOrCertifications?.length ?? 0) > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>
              {certification.sectionTitle || "Certifications"}
            </Text>
            {certification.licenseOrCertifications!.map((cert) => (
              <View key={cert.id} wrap={false}>
                <View style={styles.entryHeader}>
                  <Text style={styles.entryHeaderLeft}>
                    {cert.title}
                    {cert.credentialUrl ? "  " : ""}
                    {cert.credentialUrl ? (
                      <Link
                        src={cert.credentialUrl}
                        style={{ fontSize: 9, color: "#0a66c2" }}
                      >
                        view
                      </Link>
                    ) : null}
                  </Text>
                  <Text style={styles.entryHeaderRight}>
                    {fmtDate(cert.issueDate)}
                  </Text>
                </View>
                <Text style={styles.entrySubLeft}>{cert.organization}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

export default ResumePdf;
