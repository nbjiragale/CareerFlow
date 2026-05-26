// CAREERFLOW: client-only inner for the resume PDF preview. All @react-pdf
// imports (PDFViewer + the ResumePdf document, which itself imports
// @react-pdf primitives) live here so they're reached ONLY through the
// ssr:false dynamic import in ResumePdfPreview. @react-pdf/renderer is ESM-only;
// keeping it behind that boundary stops it from entering the webpack server
// build graph (which would fail with "ESM packages need to be imported").
"use client";

import { PDFViewer } from "@react-pdf/renderer";
import { Resume } from "@/models/profile.model";
import { ResumePdf } from "./ResumePdf";

export default function ResumePdfPreviewInner({ resume }: { resume: Resume }) {
  return (
    <div className="w-full h-[800px] border rounded-md overflow-hidden bg-muted">
      <PDFViewer width="100%" height="100%" showToolbar style={{ border: 0 }}>
        <ResumePdf resume={resume} />
      </PDFViewer>
    </div>
  );
}
