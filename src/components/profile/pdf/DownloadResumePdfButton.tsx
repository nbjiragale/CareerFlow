"use client";

import dynamic from "next/dynamic";
import { Resume } from "@/models/profile.model";
import { ResumePdf } from "./ResumePdf";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFDownloadLink),
  { ssr: false },
);

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function DownloadResumePdfButton({ resume }: { resume: Resume }) {
  const fileName = `${slugify(resume.title || "resume")}.pdf`;
  return (
    <PDFDownloadLink
      document={<ResumePdf resume={resume} />}
      fileName={fileName}
    >
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

export default DownloadResumePdfButton;
