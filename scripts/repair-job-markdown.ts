import { eq } from "drizzle-orm";

import { db } from "../lib/db/client";
import { companies, jobs } from "../lib/db/schema";
import { sanitizeJobMarkdown } from "./lib/job-markdown";

type Profile = { jobs?: Array<{ description?: unknown }> };

const apply = process.argv.includes("--apply");

function repairProfile(profile: unknown) {
  if (!profile || typeof profile !== "object")
    return { profile, changed: false };

  const nextProfile = structuredClone(profile) as Profile;
  let changed = false;
  for (const job of nextProfile.jobs ?? []) {
    if (typeof job.description !== "string") continue;
    const description = sanitizeJobMarkdown(job.description);
    if (description === job.description) continue;
    job.description = description;
    changed = true;
  }

  return { profile: nextProfile, changed };
}

async function main() {
  const [companyRows, jobRows] = await Promise.all([
    db.select({ id: companies.id, profile: companies.profile }).from(companies),
    db
      .select({
        id: jobs.id,
        description: jobs.description,
        searchText: jobs.searchText,
      })
      .from(jobs),
  ]);

  const profilesToRepair = companyRows
    .map((company) => ({ company, repair: repairProfile(company.profile) }))
    .filter(({ repair }) => repair.changed);
  const jobsToRepair = jobRows
    .filter((job) => typeof job.description === "string")
    .map((job) => ({ job, description: sanitizeJobMarkdown(job.description!) }))
    .filter(({ job, description }) => description !== job.description);

  console.log(
    `${apply ? "Repairing" : "Would repair"} ${profilesToRepair.length} company profiles and ${jobsToRepair.length} job rows.`,
  );
  if (!apply || (!profilesToRepair.length && !jobsToRepair.length)) return;

  const updatedAt = new Date();
  for (const { company, repair } of profilesToRepair) {
    await db
      .update(companies)
      .set({ profile: repair.profile, updatedAt })
      .where(eq(companies.id, company.id));
  }

  for (const { job, description } of jobsToRepair) {
    await db
      .update(jobs)
      .set({
        description,
        searchText: job.searchText.replace(job.description!, description),
        updatedAt,
      })
      .where(eq(jobs.id, job.id));
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
