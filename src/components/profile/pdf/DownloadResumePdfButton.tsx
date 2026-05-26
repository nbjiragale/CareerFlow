// CAREERFLOW: thin wrapper that loads the PDF download button client-only. The
// actual @react-pdf usage lives in ResumePdfDownloadInner, dynamically imported
// with ssr:false so the ESM-only @react-pdf/renderer never enters the server
// build.
"use client";

import dynamic from "next/dynamic";
import { Resume } from "@/models/profile.model";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const ResumePdfDownloadInner = dynamic(
  () => import("./ResumePdfDownloadInner"),
  {
    ssr: false,
    loading: () => (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5"
        disabled
      >
        <Download className="h-3.5 w-3.5" />
        Download PDF
      </Button>
    ),
  },
);

export function DownloadResumePdfButton({ resume }: { resume: Resume }) {
  return <ResumePdfDownloadInner resume={resume} />;
}

export default DownloadResumePdfButton;
