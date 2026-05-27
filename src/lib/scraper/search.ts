// CAREERFLOW: job-board dispatch. The runner used to call JSearch directly even
// though automations carry a `jobBoard`; this resolves the right provider (and
// its credentials) for the selected board. Add a `case` here when adding a
// board — keep it in sync with JobBoardSchema and JOB_BOARD_LABELS.
import { resolveApiKey } from "@/lib/api-key-resolver";
import type { JobBoard } from "@/models/automation.model";
import type { JobDetails, ScraperResult } from "./types";
import { searchJSearchJobs } from "./jsearch";
import { searchRemotiveJobs } from "./remotive";

export async function searchJobBoard(
  jobBoard: JobBoard,
  keywords: string,
  location: string,
  userId: string,
): Promise<ScraperResult<JobDetails[]>> {
  switch (jobBoard) {
    case "remotive":
      // Free, no key; remote-only so location isn't a server-side filter.
      return searchRemotiveJobs(keywords);
    case "jsearch":
    default: {
      const rapidApiKey = await resolveApiKey(userId, "rapidapi");
      return searchJSearchJobs(keywords, location, rapidApiKey);
    }
  }
}
