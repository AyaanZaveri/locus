import "server-only";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "./db";
import { companies, jobs } from "./db/schema";
import { sanitizeLocation } from "./job-location";
import { buildCompanySearchQuery } from "./company-search";
import { buildPersonSearchQuery } from "./person-search";
import { jobLocationPredicate } from "./location-query";
import { retrieveSemantic } from "./ai/semantic-search";

const defaultCompanyLimit = 6;
const defaultPersonLimit = 8;
const defaultJobLimit = 10;

type SearchLimits = {
  types?: Array<"companies" | "people" | "jobs">;
  companyLimit?: number;
  personLimit?: number;
  jobLimit?: number;
  semantic?: boolean;
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
    semantic = false,
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
                ...(normalizedQuery.length >= 4
                  ? [
                      sql`similarity(${jobs.searchText}, ${normalizedQuery}) >= 0.35`,
                    ]
                  : []),
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

  const response: SearchResponse = {
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

  if (semantic && process.env.LOCUS_SEMANTIC_SEARCH !== "off") {
    const semanticTypes = types.filter(
      (type) => type === "companies" || type === "jobs",
    );
    const requests = await Promise.all(
      semanticTypes.map(async (type) => {
        try {
          const base =
            type === "jobs"
              ? sql`SELECT j.*, c.slug AS company_slug, c.name AS company_name,
              c.profile->>'industry' AS company_industry,
              c.profile AS company_profile,
              c.profile->'location'->>'countryCode' AS country_code
            FROM jobs j INNER JOIN companies c ON j.company_id=c.id
            WHERE j.status IN ('open','unknown')`
              : sql`SELECT c.id, c.slug, c.name, c.profile->>'industry' AS industry,
              c.profile->>'tagline' AS tagline, c.profile->>'description' AS description,
              c.profile AS profile, c.location, c.country_code
            FROM companies c`;
          const limit = type === "jobs" ? jobLimit : companyLimit;
          const result = await retrieveSemantic(
            base,
            type,
            normalizedQuery,
            limit,
            "relevance",
          );
          if (result.unavailable) return null;
          return { type, rows: result.rows };
        } catch {
          // Semantic discovery is additive: existing lexical results remain available.
          return null;
        }
      }),
    );
    for (const request of requests) {
      if (!request) continue;
      if (request.type === "jobs") {
        const semanticJobs = request.rows.map((row) => ({
          title: String(row.title ?? ""),
          focus: String(row.focus ?? ""),
          location: String(row.location ?? ""),
          url: (row.url as string | null) ?? null,
          companySlug: String(row.company_slug ?? ""),
          companyName: String(row.company_name ?? ""),
          companyLogo: companyLogo(row.company_profile),
          countryCode: String(row.country_code ?? ""),
        }));
        response.jobs = [...semanticJobs, ...response.jobs]
          .filter(
            (job, index, all) =>
              all.findIndex(
                (item) =>
                  item.companySlug === job.companySlug &&
                  item.title === job.title,
              ) === index,
          )
          .slice(0, jobLimit);
      } else {
        const semanticCompanies = request.rows.map((row) => ({
          slug: String(row.slug ?? ""),
          name: String(row.name ?? ""),
          industry: String(row.industry ?? ""),
          location: String(row.location ?? ""),
          countryCode: String(row.country_code ?? ""),
          logo: companyLogo(row.profile),
        }));
        response.companies = [...semanticCompanies, ...response.companies]
          .filter(
            (company, index, all) =>
              all.findIndex((item) => item.slug === company.slug) === index,
          )
          .slice(0, companyLimit);
      }
    }
  }
  return response;
}
