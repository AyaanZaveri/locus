import "server-only";

import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "./db";
import { companies, jobs, people } from "./db/schema";

const defaultCompanyLimit = 6;
const defaultPersonLimit = 8;
const defaultJobLimit = 10;

type SearchLimits = {
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
  }>;
  people: Array<{
    name: string;
    role: string;
    image: string | null;
    companySlug: string;
    companyName: string;
    companyLogo: string | null;
    countryCode: string;
  }>;
  jobs: Array<{
    title: string;
    focus: string;
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

/**
 * Search terms should start a word, rather than match arbitrary letters inside
 * a field. For example, "exa" can match "Exa", but not the middle of
 * "Texas". The query is escaped before being used as a Postgres regex.
 */
function wordStartPattern(query: string) {
  const escapedQuery = query.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
  return `(^|[^[:alnum:]])${escapedQuery}`;
}

export async function search(
  query: string,
  {
    companyLimit = defaultCompanyLimit,
    personLimit = defaultPersonLimit,
    jobLimit = defaultJobLimit,
  }: SearchLimits = {},
): Promise<SearchResponse> {
  const normalizedQuery = query.trim().slice(0, 80);

  if (!normalizedQuery) {
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
      companies: suggested.map((company) => ({
        ...company,
        logo: companyLogo(company.profile),
      })),
      people: [],
      jobs: [],
    };
  }

  const pattern = `%${normalizedQuery}%`;
  const wordStart = wordStartPattern(normalizedQuery);
  const exactName = sql`lower(${companies.name}) = lower(${normalizedQuery})`;
  const nameWordStart = sql`${companies.name} ~* ${wordStart}`;
  const exactIndustry = sql`lower(${companies.industry}) = lower(${normalizedQuery})`;
  const exactLocation = sql`lower(${companies.location}) = lower(${normalizedQuery})`;
  const industryWordStart = sql`${companies.industry} ~* ${wordStart}`;
  const locationWordStart = sql`${companies.location} ~* ${wordStart}`;
  const companyMatchRank = sql<number>`
    case
      when ${exactName} then 0
      when ${nameWordStart} then 1
      when ${exactIndustry} or ${exactLocation} then 2
      when ${industryWordStart} or ${locationWordStart} then 3
      else 4
    end
  `;
  const [companyResults, peopleResults, jobResults] = await Promise.all([
    db
      .select({
        slug: companies.slug,
        name: companies.name,
        industry: companies.industry,
        location: companies.location,
        countryCode: companies.countryCode,
        profile: companies.profile,
      })
      .from(companies)
      .where(or(nameWordStart, industryWordStart, locationWordStart))
      .orderBy(
        asc(companyMatchRank),
        desc(sql`similarity(${companies.name}, ${normalizedQuery})`),
      )
      .limit(companyLimit),
    db
      .select({
        name: people.name,
        role: people.role,
        image: people.image,
        companySlug: companies.slug,
        companyName: companies.name,
        countryCode: companies.countryCode,
        profile: companies.profile,
      })
      .from(people)
      .innerJoin(companies, eq(people.companyId, companies.id))
      .where(ilike(people.searchText, pattern))
      .orderBy(desc(sql`similarity(${people.searchText}, ${normalizedQuery})`))
      .limit(personLimit),
    db
      .select({
        title: jobs.title,
        focus: jobs.focus,
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
          ilike(jobs.searchText, pattern),
        ),
      )
      .orderBy(desc(sql`similarity(${jobs.searchText}, ${normalizedQuery})`))
      .limit(jobLimit),
  ]);

  return {
    companies: companyResults.map(({ profile, ...company }) => ({
      ...company,
      logo: companyLogo(profile),
    })),
    people: peopleResults.map(({ profile, ...person }) => ({
      ...person,
      companyLogo: companyLogo(profile),
    })),
    jobs: jobResults.map(({ profile, ...job }) => ({
      ...job,
      companyLogo: companyLogo(profile),
    })),
  };
}
