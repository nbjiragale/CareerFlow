"use client";

import dynamic from "next/dynamic";
import { Resume } from "@/models/profile.model";
import { ResumePdf } from "./ResumePdf";
import Loading from "../../Loading";

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFViewer),
  { ssr: false, loading: () => <Loading /> },
);

export function ResumePdfPreview({ resume }: { resume: Resume }) {
  if (!resume) return null;
  return (
    <div className="w-full h-[800px] border rounded-md overflow-hidden bg-muted">
      <PDFViewer
        width="100%"
        height="100%"
        showToolbar
        style={{ border: 0 }}
      >
        <ResumePdf resume={resume} />
      </PDFViewer>
    </div>
  );
}

export default ResumePdfPreview;
