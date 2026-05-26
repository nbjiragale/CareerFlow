// CAREERFLOW: client-only inner for the resume PDF download button. Holds the
// static @react-pdf imports (PDFDownloadLink + the ResumePdf document) so they
// are reached ONLY via the ssr:false dynamic import in DownloadResumePdfButton,
// keeping the ESM-only @react-pdf/renderer out of the server build graph.
"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import { Resume } from "@/models/profile.model";
import { ResumePdf } from "./ResumePdf";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function ResumePdfDownloadInner({ resume }: { resume: Resume }) {
  const fileName = `${slugify(resume.title || "resume")}.pdf`;
  return (
    <PDFDownloadLink document={<ResumePdf resume={resume} />} fileName={fileName}>
      {({ loading }) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          disabled={loading}
        >
          <Download className="h-3.5 w-3.5" />
          {loading ? "Building PDF…" : "Download PDF"}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
