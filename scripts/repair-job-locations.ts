import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";

import { parseCompanyProfile } from "../lib/company-profile";
import { db } from "../lib/db/client";
import { companies, jobs } from "../lib/db/schema";
import { sanitizeLocation } from "../lib/job-location";

const apply = process.argv.includes("--apply");
const databaseUrl = process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Missing database URL");
const sql = neon(databaseUrl);

async function main() {
  const records = await db
    .select({
      id: companies.id,
      slug: companies.slug,
      profile: companies.profile,
    })
    .from(companies);
  let changed = 0;

  for (const company of records) {
    const profile = company.profile as {
      jobs?: Array<{ title: string; url?: string | null; location: string }>;
    };
    if (!profile.jobs?.length) continue;

    const updates = profile.jobs
      .map((job) => ({ job, next: sanitizeLocation(job.location) }))
      .filter(({ job, next }) => job.location !== next);
    if (!updates.length) continue;

    const rows = await db
      .select({
        id: jobs.id,
        url: jobs.url,
        title: jobs.title,
        location: jobs.location,
        searchText: jobs.searchText,
      })
      .from(jobs)
      .where(eq(jobs.companyId, company.id));
    const repairs = updates.map(({ job, next }) => {
      const matches = rows.filter(
        (row) =>
          row.location === job.location &&
          (job.url ? row.url === job.url : row.title === job.title),
      );
      if (matches.length !== 1) {
        throw new Error(
          `${company.slug}: expected one row for ${job.title} at ${job.location}; found ${matches.length}`,
        );
      }
      const row = matches[0];
      if (!row.searchText.includes(job.location)) {
        throw new Error(
          `${company.slug}: search text missing old location for ${job.title}`,
        );
      }
      return {
        row,
        next,
        searchText: row.searchText.replace(job.location, next),
      };
    });

    const nextProfile = {
      ...profile,
      jobs: profile.jobs.map((job) => ({
        ...job,
        location: sanitizeLocation(job.location),
      })),
    };
    parseCompanyProfile(nextProfile);
    console.log(`${company.slug}: ${updates.length} job location(s)`);
    for (const { job, next } of updates.slice(0, 5)) {
      console.log(`  ${job.title}: ${job.location} -> ${next}`);
    }
    if (updates.length > 5) console.log(`  …and ${updates.length - 5} more`);

    if (apply) {
      // Keep profile JSON and normalized job rows in sync without deleting jobs
      // (which would change their IDs and discard other independent updates).
      const results = await sql.transaction([
        sql`UPDATE companies SET profile = ${JSON.stringify(nextProfile)}::jsonb, updated_at = now()
            WHERE id = ${company.id} AND profile = ${JSON.stringify(company.profile)}::jsonb RETURNING id`,
        ...repairs.map(
          ({ row, next, searchText }) =>
            sql`UPDATE jobs SET location = ${next}, search_text = ${searchText}, updated_at = now()
              WHERE id = ${row.id} AND location = ${row.location} RETURNING id`,
        ),
      ]);
      if (results.some((result) => result.length !== 1)) {
        throw new Error(
          `${company.slug}: optimistic update conflict; inspect rows before retrying`,
        );
      }
    }
    changed += updates.length;
  }

  console.log(
    `${apply ? "Repaired" : "Would repair"} ${changed} job locations.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
