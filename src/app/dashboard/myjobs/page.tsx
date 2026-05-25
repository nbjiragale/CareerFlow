import { Metadata } from "next";

import {
  getApplicationsBoard,
  getJobSourceList,
  getStatusList,
} from "@/actions/job.actions";
import ApplicationsView from "@/components/myjobs/ApplicationsView";
import { getAllCompanies } from "@/actions/company.actions";
import { getAllJobTitles } from "@/actions/jobtitle.actions";
import { getAllJobLocations } from "@/actions/jobLocation.actions";
import { getAllTags } from "@/actions/tag.actions";

export const metadata: Metadata = {
  title: "Applications",
};

async function MyJobs() {
  const [statuses, companies, titles, locations, sources, tags, board] =
    await Promise.all([
      getStatusList(),
      getAllCompanies(),
      getAllJobTitles(),
      getAllJobLocations(),
      getJobSourceList(),
      getAllTags(),
      getApplicationsBoard(),
    ]);
  return (
    <ApplicationsView
      boardJobs={board?.data ?? []}
      companies={companies}
      titles={titles}
      locations={locations}
      sources={sources}
      statuses={statuses}
      tags={tags ?? []}
    />
  );
}

export default MyJobs;
