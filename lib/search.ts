import "server-only";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "./db";
import { companies, jobs } from "./db/schema";
import { sanitizeLocation } from "./job-location";
import { buildCompanySearchQuery } from "./company-search";
import { buildPersonSearchQuery } from "./person-search";
import { jobLocationPredicate } from "./location-query";

const defaultCompanyLimit = 6;
const defaultPersonLimit = 8;
const defaultJobLimit = 10;

type SearchLimits = {
  types?: Array<"companies" | "people" | "jobs">;
  companyLimit?: number;
  personLimit?: number;
  jobLimit?: number;
};

export type SearchResponse = {
  companies: Array<{
    slug: string;
    name: string;
    logo: string | null;
    industry: string;
    location: string;
    countryCode: string;
    matchType?:
      | "exact"
      | "name-prefix"
      | "industry-or-location"
      | "fuzzy-name"
      | "alias-exact"
      | "alias-prefix";
    matchScore?: number;
    matchedAlias?: { name: string; kind: string; sourceUrl: string } | null;
  }>;
  people: Array<{
    name: string;
    role: string;
    image: string | null;
    url: string | null;
    companySlug: string;
    companyName: string;
    companyLogo: string | null;
    countryCode: string;
    matchType?: "exact-name" | "name-prefix" | "content" | "fuzzy-name";
    matchScore?: number;
  }>;
  jobs: Array<{
    title: string;
    focus: string;
    location: string;
    url: string | null;
    companySlug: string;
    companyName: string;
    companyLogo: string | null;
    countryCode: string;
  }>;
};

function companyLogo(profile: unknown) {
  if (profile && typeof profile === "object" && "logo" in profile) {
    const logo = (profile as { logo?: unknown }).logo;
    return typeof logo === "string" ? logo : null;
  }
  return null;
}

export async function search(
  query: string,
  {
    types = ["companies", "people", "jobs"],
    companyLimit = defaultCompanyLimit,
    personLimit = defaultPersonLimit,
    jobLimit = defaultJobLimit,
  }: SearchLimits = {},
): Promise<SearchResponse> {
  const normalizedQuery = query.trim().slice(0, 80);

  if (!normalizedQuery) {
    if (!types.includes("companies"))
      return { companies: [], people: [], jobs: [] };
    const suggested = await db
      .select({
        slug: companies.slug,
        name: companies.name,
        industry: companies.industry,
        location: companies.location,
        countryCode: companies.countryCode,
        profile: companies.profile,
      })
      .from(companies)
      .orderBy(companies.name)
      .limit(companyLimit);

    return {
      companies: suggested.map(({ profile, ...company }) => ({
        ...company,
        logo: companyLogo(profile),
      })),
      people: [],
      jobs: [],
    };
  }

  const pattern = `%${normalizedQuery.replace(/[\\%_]/g, "\\$&")}%`;
  const canonicalLocation = sanitizeLocation(normalizedQuery);
  const [companyResults, peopleResults, jobResults] = await Promise.all([
    types.includes("companies")
      ? db.execute(buildCompanySearchQuery(normalizedQuery, companyLimit)).then(
          (result) =>
            result.rows as Array<
              Omit<SearchResponse["companies"][number], "logo"> & {
                profile: unknown;
              }
            >,
        )
      : Promise.resolve([]),
    types.includes("people")
      ? db.execute(buildPersonSearchQuery(normalizedQuery, personLimit)).then(
          (result) =>
            result.rows as Array<
              Omit<SearchResponse["people"][number], "url" | "companyLogo"> & {
                profile: unknown;
                linkedin: string | null;
                sourceUrl: string | null;
              }
            >,
        )
      : Promise.resolve([]),
    types.includes("jobs")
      ? db
          .select({
            title: jobs.title,
            focus: jobs.focus,
            location: jobs.location,
            url: jobs.url,
            companySlug: companies.slug,
            companyName: companies.name,
            countryCode: companies.countryCode,
            profile: companies.profile,
          })
          .from(jobs)
          .innerJoin(companies, eq(jobs.companyId, companies.id))
          .where(
            and(
              or(eq(jobs.status, "open"), eq(jobs.status, "unknown")),
              or(
                ilike(jobs.searchText, pattern),
                ...(canonicalLocation !== normalizedQuery
                  ? [
                      jobLocationPredicate(
                        sql`${jobs.id}`,
                        sql`${jobs.location}`,
                        canonicalLocation,
                      ),
                    ]
                  : []),
              ),
            ),
          )
          .orderBy(
            desc(sql`similarity(${jobs.searchText}, ${normalizedQuery})`),
          )
          .limit(jobLimit)
      : Promise.resolve([]),
  ]);

  return {
    companies: companyResults.map(({ profile, ...company }) => ({
      ...company,
      logo: companyLogo(profile),
    })),
    people: peopleResults.map(
      ({ profile, linkedin, sourceUrl, ...person }) => ({
        ...person,
        url: linkedin ?? sourceUrl,
        companyLogo: companyLogo(profile),
      }),
    ),
    jobs: jobResults.map(({ profile, ...job }) => ({
      ...job,
      companyLogo: companyLogo(profile),
    })),
  };
}
