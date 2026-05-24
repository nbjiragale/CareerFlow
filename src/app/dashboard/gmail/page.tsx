// CAREERFLOW: Phase 1 — Gmail dashboard page. Shell that renders the
// All / Needs Review tab container. Data fetching is client-side via
// /api/gmail/threads to keep the page itself a thin server component.
import { Metadata } from "next";

import GmailTabsContainer from "@/components/gmail/GmailTabsContainer";

export const metadata: Metadata = {
  title: "Gmail | CareerFlow",
};

function GmailPage() {
  return (
    <div className="col-span-3">
      <GmailTabsContainer />
    </div>
  );
}

export default GmailPage;
