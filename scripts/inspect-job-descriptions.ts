import { asc, eq } from "drizzle-orm";

import { db } from "../lib/db/client";
import { companies, jobs } from "../lib/db/schema";

const slug = process.argv[2] ?? "parallel";
const full = process.argv.includes("--full");

const sectionChecks = [
  ["role", /(^|\n)#{1,3}\s*(about us|about the role|the role|role)\b|\*\*Job[: ]/im],
  ["responsibilities", /(^|\n)#{1,3}\s*(what you.?ll do|responsibilities)\b/im],
  ["requirements", /(^|\n)#{1,3}\s*(about you|what we.?re looking for|you might be a good fit)\b/im],
  ["benefits", /(^|\n)#{1,3}\s*(compensation|compensation & benefits|what you can expect|benefits)\b/im],
  ["values", /(^|\n)#{1,3}\s*life at parallel\b/im],
  ["interview", /(^|\n)#{1,3}\s*(hiring process|interview process)\b/im],
] as const;

function normalized(value: string | null | undefined) {
  return value?.replace(/\r\n/g, "\n").trim() ?? "";
}

async function main() {
  const rows = await db
    .select({
      companySlug: companies.slug,
      companyName: companies.name,
      companyProfile: companies.profile,
      job: jobs,
    })
    .from(jobs)
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .where(eq(companies.slug, slug))
    .orderBy(asc(jobs.title));

  if (!rows.length) {
    throw new Error(
      `No jobs found for company slug "${slug}". Pass the database slug, e.g. "parallel".`,
    );
  }

  const results = rows.map(({ companyProfile, job, companyName, companySlug }) => {
    const profile = companyProfile as {
      jobs?: Array<{ title?: string; url?: string | null; description?: string | null }>;
    };
    const profileJob = profile.jobs?.find(
      (candidate) =>
        (candidate.url && candidate.url === job.url) ||
        candidate.title === job.title,
    );
    const dbDescription = normalized(job.description);
    const profileDescription = normalized(profileJob?.description);
    const sections = Object.fromEntries(
      sectionChecks.map(([name, pattern]) => [name, pattern.test(dbDescription)]),
    );

    return {
      company: companyName,
      slug: companySlug,
      title: job.title,
      url: job.url,
      databaseDescriptionLength: dbDescription.length,
      profileDescriptionLength: profileDescription.length || null,
      databaseMatchesProfile: Boolean(profileDescription) && dbDescription === profileDescription,
      databaseLooksTruncated:
        Boolean(profileDescription) && dbDescription.length < profileDescription.length,
      sections,
      missingSections: Object.entries(sections)
        .filter(([, present]) => !present)
        .map(([name]) => name),
      databasePreview: full ? dbDescription : dbDescription.slice(0, 240),
      databaseDescription: full ? dbDescription : undefined,
    };
  });

  const incomplete = results.filter(
    (result) =>
      result.databaseDescriptionLength === 0 ||
      result.databaseLooksTruncated ||
      result.missingSections.some((section) =>
        ["role", "values", "benefits"].includes(section),
      ),
  );

  console.log(
    JSON.stringify(
      {
        company: slug,
        jobCount: results.length,
        incompleteCount: incomplete.length,
        incompleteTitles: incomplete.map((result) => result.title),
        jobs: results,
      },
      null,
      2,
    ),
  );

  if (incomplete.length) process.exitCode = 2;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
