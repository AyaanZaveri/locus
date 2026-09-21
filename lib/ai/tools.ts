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

const resultLimitSchema = z.number().int().min(1).max(20).default(10);

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
async function searchLocus(query: string) {
  const directResult = await search(query);
  if (hasSearchResults(directResult)) return directResult;

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
    if (hasSearchResults(result)) return result;
  }

  return directResult;
}

/**
 * The agent has a deliberately narrow, read-only view of the Locus dataset.
 * Every query is constructed through Drizzle; it cannot execute model-authored
 * SQL or mutate a record.
 */
export const locusTools = {
  searchLocus: tool({
    description:
      "Search Locus for companies, people, and currently open jobs. Use this before answering a broad or ambiguous lookup question.",
    inputSchema: z.object({
      query: z.string().trim().min(1).max(80),
    }),
      execute: async ({ query }) => searchLocus(query),
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
          employeeCount: companies.employeeCount,
          profile: companies.profile,
        })
        .from(companies)
        .where(eq(companies.slug, slug))
        .limit(1);

      return company ?? { error: `No company found for slug "${slug}".` };
    },
  }),
  listCompanyJobs: tool({
    description:
      "List open or unknown-status jobs at a company. Use the company slug returned by searchLocus.",
    inputSchema: z.object({
      slug: companySlugSchema,
      limit: resultLimitSchema,
    }),
    execute: async ({ slug, limit }) =>
      db
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
        .limit(limit),
  }),
  listCompanyPeople: tool({
    description:
      "List people recorded for a company. Use the company slug returned by searchLocus.",
    inputSchema: z.object({
      slug: companySlugSchema,
      limit: resultLimitSchema,
    }),
    execute: async ({ slug, limit }) =>
      db
        .select({
          name: people.name,
          role: people.role,
          linkedin: people.linkedin,
          x: people.x,
          isFounder: people.isFounder,
        })
        .from(people)
        .innerJoin(companies, eq(people.companyId, companies.id))
        .where(eq(companies.slug, slug))
        .orderBy(asc(people.name))
        .limit(limit),
  }),
};
