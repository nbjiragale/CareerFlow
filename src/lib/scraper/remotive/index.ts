// CAREERFLOW: Remotive job board provider for Automations. Remotive's public
// API is free and needs no key; it returns full job details in one call (like
// JSearch), so there's no separate extract step. Remote-only board, so the
// automation's `location` is not used as a server-side filter — `keywords`
// drives the `search` query. Descriptions come back as HTML and are flattened
// to plain text so they read cleanly and don't pollute the AI match prompt.
import type { JobDetails, ScraperResult } from "../types";

const REMOTIVE_BASE_URL = "https://remotive.com/api/remote-jobs";
const RESULT_LIMIT = 50;

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category: string;
  job_type: string;
  publication_date: string;
  candidate_required_location: string;
  salary: string;
  description: string;
}

interface RemotiveResponse {
  "job-count": number;
  jobs: RemotiveJob[];
}

// Minimal HTML → text: Remotive descriptions are HTML fragments. We keep line
// breaks for block elements, drop the rest of the markup, and decode the few
// entities that actually show up.
function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6]|ul|ol)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export async function searchRemotiveJobs(
  keywords: string,
): Promise<ScraperResult<JobDetails[]>> {
  try {
    const url = new URL(REMOTIVE_BASE_URL);
    if (keywords.trim()) {
      url.searchParams.set("search", keywords.trim());
    }
    url.searchParams.set("limit", String(RESULT_LIMIT));

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      if (response.status === 429) {
        return {
          success: false,
          error: { type: "rate_limited", retryAfter: 60 },
        };
      }
      return {
        success: false,
        error: {
          type: "network",
          message: `API error: ${response.status} ${response.statusText}`,
        },
      };
    }

    const data: RemotiveResponse = await response.json();

    const jobs: JobDetails[] = (data.jobs || []).map((job) => ({
      title: job.title,
      company: job.company_name,
      location: job.candidate_required_location?.trim() || "Remote",
      description: htmlToText(job.description || ""),
      url: job.url,
      postedDate: job.publication_date,
      salary: job.salary?.trim() || undefined,
    }));

    return { success: true, data: jobs };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: { type: "network", message } };
  }
}
