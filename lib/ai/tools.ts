import "server-only";

import { tool } from "ai";
import { and, asc, eq, or } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { companies, jobs, people } from "@/lib/db/schema";
import { search, type SearchResponse } from "@/lib/search";

const companySlugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]+$/)
  .max(100);

const resultLimitSchema = z.number().int().min(1).max(3).default(3);
const searchResultTypeSchema = z.enum(["companies", "people", "jobs"]);

function companyLogo(profile: unknown) {
  if (profile && typeof profile === "object" && "logo" in profile) {
    const logo = (profile as { logo?: unknown }).logo;
    return typeof logo === "string" ? logo : null;
  }
  return null;
}

const searchStopWords = new Set([
  "about",
  "are",
  "based",
  "can",
  "company",
  "companies",
  "find",
  "for",
  "from",
  "how",
  "in",
  "is",
  "jobs",
  "locus",
  "people",
  "please",
  "show",
  "that",
  "the",
  "through",
  "what",
  "which",
  "who",
  "with",
]);

function hasSearchResults(result: SearchResponse) {
  return (
    result.companies.length > 0 ||
    result.people.length > 0 ||
    result.jobs.length > 0
  );
}

/**
 * The database search is intentionally a literal substring lookup. If an
 * agent sends a whole conversational sentence, retry its useful keywords so
 * "which companies are based in Toronto" still finds "Toronto" records.
 */
async function searchLocus(
  query: string,
  types: Array<z.infer<typeof searchResultTypeSchema>>,
  limit: number,
) {
  const directResult = await search(query);
  if (hasSearchResults(directResult)) {
    return filterSearchResults(directResult, types, limit);
  }

  const keywords = [
    ...new Set(
      query
        .toLowerCase()
        .match(/[a-z0-9][a-z0-9-]{2,}/g)
        ?.filter((word) => !searchStopWords.has(word)) ?? [],
    ),
  ].slice(0, 4);

  for (const keyword of keywords) {
    const result = await search(keyword);
    if (hasSearchResults(result)) {
      return filterSearchResults(result, types, limit);
    }
  }

  return filterSearchResults(directResult, types, limit);
}

function filterSearchResults(
  result: SearchResponse,
  types: Array<z.infer<typeof searchResultTypeSchema>>,
  limit: number,
): SearchResponse {
  return {
    companies: types.includes("companies")
      ? result.companies.slice(0, limit)
      : [],
    people: types.includes("people") ? result.people.slice(0, limit) : [],
    jobs: types.includes("jobs") ? result.jobs.slice(0, limit) : [],
  };
}

/**
 * The agent has a deliberately narrow, read-only view of the Locus dataset.
 * Every query is constructed through Drizzle; it cannot execute model-authored
 * SQL or mutate a record.
 */
export const locusTools = {
  navigateLocus: tool({
    description:
      "Navigate the user to a Locus result they explicitly asked to open, show, or visit. Use searchLocus first to resolve the exact company slug. Set destination to company for the company page, person for that company's people section, or job for that company's jobs section. This is client-side navigation and runs automatically. Do not use it merely to present search results or to answer a research question.",
    inputSchema: z.object({
      companySlug: companySlugSchema,
      destination: z.enum(["company", "person", "job"]),
    }),
  }),
  searchLocus: tool({
    description:
      "Search Locus for companies, people, and currently open jobs. Set types to exactly the entity categories the user requested. Return at most three of each category, ordered by relevance. Use this before answering a broad or ambiguous lookup question.",
    inputSchema: z.object({
      query: z.string().trim().min(1).max(80),
      types: z
        .array(searchResultTypeSchema)
        .min(1)
        .max(3)
        .default(["companies", "people", "jobs"]),
      limit: resultLimitSchema,
    }),
    execute: async ({ query, types, limit }) =>
      searchLocus(query, types, limit),
  }),
  getCompany: tool({
    description:
      "Get the full Locus profile for one company when you know its slug. Use searchLocus first when the slug is unknown.",
    inputSchema: z.object({ slug: companySlugSchema }),
    execute: async ({ slug }) => {
      const [company] = await db
        .select({
          slug: companies.slug,
          name: companies.name,
          industry: companies.industry,
          stage: companies.stage,
          location: companies.location,
          countryCode: companies.countryCode,
          employeeCount: companies.employeeCount,
          logo: companies.profile,
        })
        .from(companies)
        .where(eq(companies.slug, slug))
        .limit(1);

      return company
        ? { ...company, logo: companyLogo(company.logo) }
        : { error: `No company found for slug "${slug}".` };
    },
  }),
  listCompanyJobs: tool({
    description:
      "List open or unknown-status jobs at a company. Use the company slug returned by searchLocus.",
    inputSchema: z.object({
      slug: companySlugSchema,
      limit: resultLimitSchema,
    }),
    execute: async ({ slug, limit }) => {
      const results = await db
        .select({
          title: jobs.title,
          location: jobs.location,
          focus: jobs.focus,
          url: jobs.url,
          status: jobs.status,
          workplaceType: jobs.workplaceType,
          employmentType: jobs.employmentType,
          department: jobs.department,
          skills: jobs.skills,
          experienceLevel: jobs.experienceLevel,
          companySlug: companies.slug,
          companyName: companies.name,
          countryCode: companies.countryCode,
          companyProfile: companies.profile,
        })
        .from(jobs)
        .innerJoin(companies, eq(jobs.companyId, companies.id))
        .where(
          and(
            eq(companies.slug, slug),
            or(eq(jobs.status, "open"), eq(jobs.status, "unknown")),
          ),
        )
        .orderBy(asc(jobs.title))
        .limit(limit);
      return results.map(({ companyProfile, ...job }) => ({
        ...job,
        companyLogo: companyLogo(companyProfile),
      }));
    },
  }),
  listCompanyPeople: tool({
    description:
      "List people recorded for a company. Use the company slug returned by searchLocus.",
    inputSchema: z.object({
      slug: companySlugSchema,
      limit: resultLimitSchema,
    }),
    execute: async ({ slug, limit }) => {
      const results = await db
        .select({
          name: people.name,
          role: people.role,
          image: people.image,
          linkedin: people.linkedin,
          x: people.x,
          isFounder: people.isFounder,
          companySlug: companies.slug,
          companyName: companies.name,
          countryCode: companies.countryCode,
          companyProfile: companies.profile,
        })
        .from(people)
        .innerJoin(companies, eq(people.companyId, companies.id))
        .where(eq(companies.slug, slug))
        .orderBy(asc(people.name))
        .limit(limit);
      return results.map(({ companyProfile, ...person }) => ({
        ...person,
        companyLogo: companyLogo(companyProfile),
      }));
    },
  }),
};
