import "server-only";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "./db";
import { companies, jobs, people } from "./db/schema";

const companyLimit = 6;
const personLimit = 8;
const jobLimit = 10;

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
  }>;
  jobs: Array<{
    title: string;
    focus: string;
    url: string | null;
    companySlug: string;
    companyName: string;
    companyLogo: string | null;
  }>;
};

function companyLogo(profile: unknown) {
  if (profile && typeof profile === "object" && "logo" in profile) {
    const logo = (profile as { logo?: unknown }).logo;
    return typeof logo === "string" ? logo : null;
  }
  return null;
}

export async function search(query: string): Promise<SearchResponse> {
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
      .where(
        or(
          ilike(companies.name, pattern),
          ilike(companies.industry, pattern),
          ilike(companies.location, pattern),
        ),
      )
      .orderBy(desc(sql`similarity(${companies.name}, ${normalizedQuery})`))
      .limit(companyLimit),
    db
      .select({
        name: people.name,
        role: people.role,
        image: people.image,
        companySlug: companies.slug,
        companyName: companies.name,
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
    companies: companyResults.map((company) => ({
      ...company,
      logo: companyLogo(company.profile),
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
