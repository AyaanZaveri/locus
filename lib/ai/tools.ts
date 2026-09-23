import "server-only";

import { tool } from "ai";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
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
const searchResultLimitSchema = z.number().int().min(1).max(12).default(3);
const searchResultTypeSchema = z.enum(["companies", "people", "jobs"]);

const jobRelevanceStopWords = new Set([
  "a",
  "an",
  "and",
  "at",
  "best",
  "do",
  "for",
  "good",
  "i",
  "if",
  "in",
  "job",
  "jobs",
  "me",
  "my",
  "role",
  "should",
  "that",
  "the",
  "what",
  "with",
]);

function jobSearchStem(word: string) {
  if (word === "eng" || word === "engineering" || word === "engineers") {
    return "engineer";
  }
  return word;
}

function jobSearchTerms(criteria?: string) {
  if (!criteria) return [];

  return [
    ...new Set(
      criteria
        .toLowerCase()
        .match(/[a-z0-9][a-z0-9-]{1,}/g)
        ?.map(jobSearchStem)
        .filter((word) => !jobRelevanceStopWords.has(word)) ?? [],
    ),
  ];
}

function jobSearchWords(value: string | null | undefined) {
  return new Set(
    value
      ?.toLowerCase()
      .match(/[a-z0-9][a-z0-9-]{1,}/g)
      ?.map(jobSearchStem) ?? [],
  );
}

function jobRelevanceScore(
  job: {
    title: string;
    focus: string | null;
    department: string | null;
    skills: string[] | null;
    searchText: string;
  },
  terms: string[],
) {
  if (!terms.length) return 0;

  const title = jobSearchWords(job.title);
  const focus = jobSearchWords(job.focus);
  const department = jobSearchWords(job.department);
  const skills = jobSearchWords(job.skills?.join(" "));
  const description = jobSearchWords(job.searchText);

  return terms.reduce((score, term) => {
    return (
      score +
      Number(title.has(term)) * 12 +
      Number(focus.has(term)) * 7 +
      Number(department.has(term)) * 5 +
      Number(skills.has(term)) * 3 +
      Number(description.has(term))
    );
  }, 0);
}

function companyLogo(profile: unknown) {
  if (profile && typeof profile === "object" && "logo" in profile) {
    const logo = (profile as { logo?: unknown }).logo;
    return typeof logo === "string" ? logo : null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPresent<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

function factQueryTerms(query: string) {
  return [
    ...new Set(
      query
        .toLowerCase()
        .match(/[a-z0-9][a-z0-9-]{2,}/g)
        ?.filter((word) => !searchStopWords.has(word)) ?? [],
    ),
  ].slice(0, 4);
}

function profileFacts(profile: unknown, terms: string[]) {
  if (!isRecord(profile)) return [];

  const activity = Array.isArray(profile.activity) ? profile.activity : [];
  return activity
    .filter(isRecord)
    .filter((item) =>
      terms.some((term) => JSON.stringify(item).toLowerCase().includes(term)),
    )
    .slice(0, 2)
    .map((item) => ({
      type: typeof item.type === "string" ? item.type : "activity",
      title: typeof item.title === "string" ? item.title : "Untitled activity",
      date: typeof item.dateTime === "string" ? item.dateTime : null,
      description:
        typeof item.description === "string"
          ? item.description.slice(0, 500)
          : null,
      sourceUrl: typeof item.sourceUrl === "string" ? item.sourceUrl : null,
    }));
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
  const directResult = await search(query, {
    companyLimit: limit,
    personLimit: limit,
    jobLimit: limit,
  });
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
    const result = await search(keyword, {
      companyLimit: limit,
      personLimit: limit,
      jobLimit: limit,
    });
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
      "Navigate the user to a Locus result they explicitly asked to open, show, or visit. Use searchLocus first to resolve the exact company slug. Set destination to company for the company page, person for the exact person's card, or job for the exact job's details drawer. A person destination requires the exact personName and should include personUrl returned by searchLocus or listCompanyPeople. A job destination requires the exact jobTitle and jobLocation returned by searchLocus or listCompanyJobs. This is client-side navigation and runs automatically. Do not use it merely to present search results or to answer a research question.",
    // DeepSeek requires a top-level JSON Schema object for every function.
    // Keep the job requirement at runtime instead of using a top-level union,
    // which serializes to a schema without a `type: "object"`.
    inputSchema: z
      .object({
        companySlug: companySlugSchema,
        destination: z.enum(["company", "person", "job"]),
        personName: z.string().trim().min(1).max(120).optional(),
        personUrl: z.string().url().max(2_000).optional(),
        jobTitle: z.string().trim().min(1).max(200).optional(),
        jobLocation: z.string().trim().min(1).max(200).optional(),
      })
      .superRefine((value, context) => {
        if (value.destination === "person" && !value.personName) {
          context.addIssue({
            code: "custom",
            message: "A person destination requires personName.",
            path: ["personName"],
          });
        }
        if (value.destination !== "job") return;

        if (!value.jobTitle) {
          context.addIssue({
            code: "custom",
            message: "A job destination requires jobTitle.",
            path: ["jobTitle"],
          });
        }
        if (!value.jobLocation) {
          context.addIssue({
            code: "custom",
            message: "A job destination requires jobLocation.",
            path: ["jobLocation"],
          });
        }
      }),
  }),
  presentLocusResults: tool({
    description:
      "Render the final, curated result cards in the user's answer. Call this at most once, only after research is complete and only for the exact companies, people, or jobs you are actually recommending or listing in your answer. Do not include exploratory matches. The returned cards are verified against Locus before display.",
    inputSchema: z.object({
      companySlugs: z.array(companySlugSchema).max(4).default([]),
      people: z
        .array(
          z.object({
            companySlug: companySlugSchema,
            name: z.string().trim().min(1).max(120),
          }),
        )
        .max(4)
        .default([]),
      jobs: z
        .array(
          z.object({
            companySlug: companySlugSchema,
            title: z.string().trim().min(1).max(200),
            location: z.string().trim().min(1).max(200),
          }),
        )
        .max(5)
        .default([]),
    }),
    execute: async ({
      companySlugs,
      people: selectedPeople,
      jobs: selectedJobs,
    }) => {
      const [selectedCompanies, verifiedPeople, verifiedJobs] =
        await Promise.all([
          Promise.all(
            companySlugs.map(async (slug) => {
              const [company] = await db
                .select({
                  slug: companies.slug,
                  name: companies.name,
                  logo: companies.profile,
                  industry: companies.industry,
                  location: companies.location,
                  countryCode: companies.countryCode,
                })
                .from(companies)
                .where(eq(companies.slug, slug))
                .limit(1);
              return company
                ? { ...company, logo: companyLogo(company.logo) }
                : null;
            }),
          ),
          Promise.all(
            selectedPeople.map(async ({ companySlug, name }) => {
              const [person] = await db
                .select({
                  name: people.name,
                  role: people.role,
                  image: people.image,
                  linkedin: people.linkedin,
                  sourceUrl: people.sourceUrl,
                  companySlug: companies.slug,
                  companyName: companies.name,
                  countryCode: companies.countryCode,
                  companyProfile: companies.profile,
                })
                .from(people)
                .innerJoin(companies, eq(people.companyId, companies.id))
                .where(
                  and(eq(companies.slug, companySlug), eq(people.name, name)),
                )
                .limit(1);
              return person
                ? {
                    ...person,
                    url: person.linkedin ?? person.sourceUrl,
                    companyLogo: companyLogo(person.companyProfile),
                  }
                : null;
            }),
          ),
          Promise.all(
            selectedJobs.map(async ({ companySlug, title, location }) => {
              const [job] = await db
                .select({
                  title: jobs.title,
                  location: jobs.location,
                  focus: jobs.focus,
                  url: jobs.url,
                  companySlug: companies.slug,
                  companyName: companies.name,
                  countryCode: companies.countryCode,
                  companyProfile: companies.profile,
                })
                .from(jobs)
                .innerJoin(companies, eq(jobs.companyId, companies.id))
                .where(
                  and(
                    eq(companies.slug, companySlug),
                    eq(jobs.title, title),
                    eq(jobs.location, location),
                  ),
                )
                .limit(1);
              return job
                ? { ...job, companyLogo: companyLogo(job.companyProfile) }
                : null;
            }),
          ),
        ]);

      return {
        companies: selectedCompanies.filter(isPresent),
        people: verifiedPeople
          .filter(isPresent)
          .map(({ companyProfile: _companyProfile, ...person }) => person),
        jobs: verifiedJobs
          .filter(isPresent)
          .map(({ companyProfile: _companyProfile, ...job }) => job),
      };
    },
  }),
  searchLocus: tool({
    description:
      "Search Locus for companies, people, and currently open jobs. Set types to exactly the entity categories the user requested. Use limit 3 for a focused lookup or recommendation. Use a larger limit (up to 12) when the user asks for all results in an industry, category, or location, or asks a follow-up such as 'what else' or 'anything else'. Results are ordered by relevance. Use this before answering a broad or ambiguous lookup question.",
    inputSchema: z.object({
      query: z.string().trim().min(1).max(80),
      types: z
        .array(searchResultTypeSchema)
        .min(1)
        .max(3)
        .default(["companies", "people", "jobs"]),
      limit: searchResultLimitSchema,
    }),
    execute: async ({ query, types, limit }) =>
      searchLocus(query, types, limit),
  }),
  getCompany: tool({
    description:
      "Get the core Locus profile fields for one company when you know its slug. Use searchLocus first when the slug is unknown. For acquisitions, funding events, or other historical facts, use searchCompanyFacts instead.",
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
  searchCompanyFacts: tool({
    description:
      "Find evidence for historical company facts such as acquisitions, funding, launches, partnerships, or executive changes. Search for distinctive names or a short fact phrase. Returns only matching activity snippets and source URLs, never complete company profiles.",
    inputSchema: z.object({
      query: z.string().trim().min(3).max(80),
      limit: resultLimitSchema,
    }),
    execute: async ({ query, limit }) => {
      const terms = factQueryTerms(query);
      if (terms.length === 0) return [];

      const results = await db
        .select({
          slug: companies.slug,
          name: companies.name,
          industry: companies.industry,
          location: companies.location,
          profile: companies.profile,
        })
        .from(companies)
        .where(
          and(
            ...terms.map((term) =>
              ilike(sql`${companies.profile}::text`, `%${term}%`),
            ),
          ),
        )
        .limit(limit);

      return results.map(({ profile, ...company }) => ({
        ...company,
        facts: profileFacts(profile, terms),
      }));
    },
  }),
  recommendOutreachTargets: tool({
    description:
      "Recommend companies to contact based on a user's current company and location. It ranks companies with active hiring signals in that location, prioritizing the same industry as the user's current company. Use this for questions like 'I work at X, who should I reach out to near Y?'.",
    inputSchema: z.object({
      fromCompanySlug: companySlugSchema,
      location: z.string().trim().min(2).max(80),
      limit: resultLimitSchema,
    }),
    execute: async ({ fromCompanySlug, location, limit }) => {
      const [sourceCompany] = await db
        .select({ industry: companies.industry })
        .from(companies)
        .where(eq(companies.slug, fromCompanySlug))
        .limit(1);

      if (!sourceCompany) {
        return { error: `No company found for slug \"${fromCompanySlug}\".` };
      }

      const matchedJobs = await db
        .select({
          title: jobs.title,
          location: jobs.location,
          companySlug: companies.slug,
          companyName: companies.name,
          industry: companies.industry,
          companyLocation: companies.location,
          countryCode: companies.countryCode,
          companyLogo: sql<string | null>`${companies.profile}->>'logo'`,
        })
        .from(jobs)
        .innerJoin(companies, eq(jobs.companyId, companies.id))
        .where(
          and(
            or(eq(jobs.status, "open"), eq(jobs.status, "unknown")),
            ilike(jobs.searchText, `%${location}%`),
          ),
        )
        .orderBy(
          desc(
            sql`case when ${companies.industry} = ${sourceCompany.industry} then 1 else 0 end`,
          ),
          asc(companies.name),
        )
        .limit(100);

      const candidates = new Map<
        string,
        {
          slug: string;
          name: string;
          industry: string;
          location: string;
          logo: string | null;
          countryCode: string;
          jobs: Array<{ title: string; location: string; evidence: string }>;
        }
      >();

      for (const job of matchedJobs) {
        const candidate = candidates.get(job.companySlug) ?? {
          slug: job.companySlug,
          name: job.companyName,
          industry: job.industry,
          location: job.companyLocation,
          logo: job.companyLogo,
          countryCode: job.countryCode,
          jobs: [],
        };
        if (candidate.jobs.length < 2) {
          candidate.jobs.push({
            title: job.title,
            location: job.location,
            evidence: job.location,
          });
        }
        candidates.set(job.companySlug, candidate);
      }

      return [...candidates.values()]
        .sort(
          (a, b) =>
            Number(b.industry === sourceCompany.industry) -
              Number(a.industry === sourceCompany.industry) ||
            a.name.localeCompare(b.name),
        )
        .slice(0, limit)
        .map((candidate) => ({
          ...candidate,
          reason:
            candidate.industry === sourceCompany.industry
              ? `Same industry as ${fromCompanySlug}: ${sourceCompany.industry}.`
              : `Active hiring signal in ${location}.`,
        }));
    },
  }),
  listCompanyJobs: tool({
    description:
      "List open or unknown-status jobs at a company. Use the company slug returned by searchLocus. When recommending a role based on a user's background, include their concise skills or role criteria in criteria. Matching jobs are ranked by title, focus, department, skills, and description relevance instead of alphabetically.",
    inputSchema: z.object({
      slug: companySlugSchema,
      limit: resultLimitSchema,
      criteria: z.string().trim().min(1).max(120).optional(),
    }),
    execute: async ({ slug, limit, criteria }) => {
      const terms = jobSearchTerms(criteria);
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
          searchText: jobs.searchText,
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
        .limit(200);

      return results
        .map(({ companyProfile, searchText, ...job }) => ({
          ...job,
          companyLogo: companyLogo(companyProfile),
          relevance: jobRelevanceScore({ ...job, searchText }, terms),
        }))
        .sort(
          (a, b) => b.relevance - a.relevance || a.title.localeCompare(b.title),
        )
        .slice(0, limit)
        .map(({ relevance: _relevance, ...job }) => ({
          ...job,
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
          sourceUrl: people.sourceUrl,
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
        url: person.linkedin ?? person.sourceUrl,
        companyLogo: companyLogo(companyProfile),
      }));
    },
  }),
};
