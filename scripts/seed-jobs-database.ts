import { eq } from "drizzle-orm";

import {
  getCompaniesFromFiles,
  parseCompanyProfile,
} from "../lib/company-profile";
import { readFile } from "node:fs/promises";
import { db } from "../lib/db/client";
import { companies, jobs, people } from "../lib/db/schema";

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
          employeeCount: profile.employees,
          profile,
          updatedAt: new Date(),
        },
      })
      .returning({ id: companies.id });

    await db.delete(jobs).where(eq(jobs.companyId, company.id));
    await db.delete(people).where(eq(people.companyId, company.id));

    if (profile.jobs.length) {
      await db.insert(jobs).values(
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
          salaryMinimum: job.compensation?.salary?.minimum?.toString() ?? null,
          salaryMaximum: job.compensation?.salary?.maximum?.toString() ?? null,
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
      );
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
