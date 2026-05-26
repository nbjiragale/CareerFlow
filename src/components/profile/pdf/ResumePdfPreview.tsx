// CAREERFLOW: thin wrapper that loads the PDF preview client-only. The actual
// @react-pdf usage lives in ResumePdfPreviewInner, dynamically imported with
// ssr:false so the ESM-only @react-pdf/renderer never enters the server build.
"use client";

import dynamic from "next/dynamic";
import { Resume } from "@/models/profile.model";
import Loading from "../../Loading";

const ResumePdfPreviewInner = dynamic(
  () => import("./ResumePdfPreviewInner"),
  { ssr: false, loading: () => <Loading /> },
);

export function ResumePdfPreview({ resume }: { resume: Resume }) {
  if (!resume) return null;
  return <ResumePdfPreviewInner resume={resume} />;
}

export default ResumePdfPreview;
