import { eq } from "drizzle-orm";

import {
  getCompaniesFromFiles,
  parseCompanyProfile,
} from "../lib/company-profile";
import { readFile } from "node:fs/promises";
import { db } from "../lib/db/client";
import {
  companies,
  jobs,
  people,
  locations,
  locationAliases,
  jobLocations,
} from "../lib/db/schema";
import { getJobLocationReviewIssues } from "../lib/job-location";
import {
  LocationCatalog,
  type CanonicalLocation,
} from "./lib/location-catalog";

function searchText(
  companyName: string,
  job: Awaited<
    ReturnType<typeof getCompaniesFromFiles>
  >[number]["jobs"][number],
) {
  return [
    companyName,
    job.title,
    job.location,
    job.focus,
    job.department,
    job.workplaceType,
    job.employmentType,
    job.experience?.level,
    job.description,
    ...(job.skills ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

async function main() {
  const importPath = process.argv[2];
  const profiles = importPath
    ? [
        parseCompanyProfile(
          JSON.parse(await readFile(importPath, "utf8")) as Record<
            string,
            unknown
          >,
        ),
      ]
    : await getCompaniesFromFiles();
  let jobCount = 0;
  let peopleCount = 0;
  const catalog = new LocationCatalog(
    (await db.select().from(locations)) as CanonicalLocation[],
    await db.select().from(locationAliases),
  );
  for (const profile of profiles) {
    const sourceLabel = profile.location.sourceLabel ?? profile.location.label;
    const place = catalog.place(sourceLabel, profile.location.countryCode);
    profile.location = {
      ...profile.location,
      label: place?.displayLabel ?? profile.location.label,
      locationId: place?.id ?? null,
      sourceLabel,
    };
    profile.jobs = profile.jobs.map((job) => ({
      ...job,
      ...catalog.job(job, {
        inferRemoteEligibility: profile.slug !== "cursor",
      }),
    }));
  }

  // Check the entire import before any writes. An unchanged normalization
  // result can mean an unknown alias, not a correctly formatted place.
  const locationIssues = profiles.flatMap((profile) =>
    profile.jobs.flatMap((job) =>
      getJobLocationReviewIssues(job.location).map(
        (place) => `${profile.slug}: ${job.title}: ${place}`,
      ),
    ),
  );
  if (locationIssues.length) {
    throw new Error(
      `Unreviewed job locations. Verify the posting, qualify ambiguous places, and extend the shared aliases/tests before importing:\n${locationIssues.join("\n")}`,
    );
  }

  catalog.seedVerifiedAliases();
  if (catalog.places.size)
    await db
      .insert(locations)
      .values([...catalog.places.values()])
      .onConflictDoNothing();
  if (catalog.aliases.size)
    await db
      .insert(locationAliases)
      .values(
        [...catalog.aliases].map(([alias, locationId]) => ({
          alias,
          locationId,
        })),
      )
      .onConflictDoNothing();

  for (const profile of profiles) {
    const [company] = await db
      .insert(companies)
      .values({
        slug: profile.slug,
        name: profile.name,
        industry: profile.industry,
        stage: profile.stage,
        location: profile.location.label,
        countryCode: profile.location.countryCode,
        headquartersLocationId: profile.location.locationId ?? null,
        employeeCount: profile.employees,
        profile,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: companies.slug,
        set: {
          name: profile.name,
          industry: profile.industry,
          stage: profile.stage,
          location: profile.location.label,
          countryCode: profile.location.countryCode,
          headquartersLocationId: profile.location.locationId ?? null,
          employeeCount: profile.employees,
          profile,
          updatedAt: new Date(),
        },
      })
      .returning({ id: companies.id });

    await db.delete(jobs).where(eq(jobs.companyId, company.id));
    await db.delete(people).where(eq(people.companyId, company.id));

    if (profile.jobs.length) {
      const importedJobs = await db
        .insert(jobs)
        .values(
          profile.jobs.map((job) => ({
            companyId: company.id,
            title: job.title,
            location: job.location,
            focus: job.focus,
            url: job.url ?? null,
            description: job.description ?? null,
            status: job.status ?? "unknown",
            workplaceType: job.workplaceType ?? null,
            employmentType: job.employmentType ?? null,
            department: job.department ?? null,
            skills: job.skills ?? [],
            minimumExperienceYears:
              job.experience?.minimumYears?.toString() ?? null,
            maximumExperienceYears:
              job.experience?.maximumYears?.toString() ?? null,
            experienceLevel: job.experience?.level ?? null,
            acceptsNewGrads: job.experience?.acceptsNewGrads ?? null,
            salaryMinimum:
              job.compensation?.salary?.minimum?.toString() ?? null,
            salaryMaximum:
              job.compensation?.salary?.maximum?.toString() ?? null,
            salaryCurrency: job.compensation?.salary?.currency ?? null,
            salaryPeriod: job.compensation?.salary?.period ?? null,
            equityMinimumPercent:
              job.compensation?.equity?.minimumPercent?.toString() ?? null,
            equityMaximumPercent:
              job.compensation?.equity?.maximumPercent?.toString() ?? null,
            requiresUsWorkAuthorization:
              job.visa?.requiresUSWorkAuthorization ?? null,
            visaSponsorship: job.visa?.sponsorship ?? null,
            citizenshipRequired: job.visa?.citizenshipRequired ?? null,
            interviewProcessAvailable: job.interviewProcess?.available ?? null,
            interviewProcessSummary: job.interviewProcess?.summary ?? null,
            interviewProcessUrl: job.interviewProcess?.url ?? null,
            postedAt: job.postedAt ?? null,
            lastSeenAt: job.lastSeenAt ?? null,
            searchText: searchText(profile.name, job),
            updatedAt: new Date(),
          })),
        )
        .returning({
          id: jobs.id,
          title: jobs.title,
          url: jobs.url,
          location: jobs.location,
        });
      // Match explicit identities, not an assumed INSERT RETURNING order.
      const available = [...importedJobs];
      const links = profile.jobs.flatMap((job) => {
        const index = available.findIndex(
          (row) =>
            row.title === job.title &&
            row.url === (job.url ?? null) &&
            row.location === job.location,
        );
        if (index < 0) throw new Error(`Missing imported job: ${job.title}`);
        const [row] = available.splice(index, 1);
        return (job.locations ?? []).map((ref, position) => ({
          jobId: row.id,
          position,
          locationId: ref.locationId,
          relation: ref.relation,
          qualifier: ref.qualifier,
          sourceLabel: ref.sourceLabel,
          label: ref.label,
        }));
      });
      if (links.length) await db.insert(jobLocations).values(links);
      jobCount += profile.jobs.length;
    }

    if (profile.people.length) {
      await db.insert(people).values(
        profile.people.map((person) => ({
          companyId: company.id,
          name: person.name,
          role: person.role,
          image: person.image,
          linkedin: person.linkedin,
          x: person.x ?? null,
          sourceUrl: person.sourceUrl ?? null,
          isFounder: person.isFounder ?? false,
          searchText: `${person.name} ${person.role} ${profile.name}`,
        })),
      );
      peopleCount += profile.people.length;
    }
  }

  console.log(
    `Imported ${profiles.length} companies, ${jobCount} jobs, and ${peopleCount} people.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
