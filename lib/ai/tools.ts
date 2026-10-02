import "server-only";

import { tool } from "ai";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { companies, jobs, people } from "@/lib/db/schema";
import { parseCompanyProfile } from "@/lib/company-profile";
import { search, type SearchResponse } from "@/lib/search";
import {
  buildFundingQuery,
  fundingQueryResult,
  fundingQuerySchema,
} from "./funding-query";

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

function jobWords(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/fullstack/g, "full stack")
      .match(/[a-z0-9]{2,}/g)
      ?.map(jobSearchStem) ?? []
  );
}

function jobSearchTerms(criteria?: string) {
  if (!criteria) return [];

  return [
    ...new Set(
      jobWords(criteria).filter((word) => !jobRelevanceStopWords.has(word)),
    ),
  ];
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

const pageCompanyPath = /^\/company\/([a-z0-9-]{1,100})\/?$/;

export async function getPageCompanyContext(pagePath: unknown) {
  if (typeof pagePath !== "string") return null;
  const match = pageCompanyPath.exec(pagePath);
  if (!match) return null;

  const [row] = await db
    .select({ profile: companies.profile })
    .from(companies)
    .where(eq(companies.slug, match[1]))
    .limit(1);
  if (!row) return null;

  const profile = parseCompanyProfile(row.profile as Record<string, unknown>);
  return {
    type: "company" as const,
    slug: profile.slug,
    name: profile.name,
    logo: profile.logo,
    tagline: profile.tagline,
    description: profile.description,
    industry: profile.industry,
    location: profile.location.label,
    stage: profile.stage,
    employees: profile.employees,
    foundedYear: profile.foundedYear,
    financials: profile.financials,
    recentActivity: [...profile.activity]
      .sort((a, b) => b.dateTime.localeCompare(a.dateTime))
      .slice(0, 3)
      .map(({ title, dateTime, description, sourceUrl }) => ({
        title,
        dateTime,
        description: description.slice(0, 400),
        sourceUrl,
      })),
    peopleCount: profile.people.length,
    jobsCount: profile.jobs.filter((job) => job.status !== "closed").length,
  };
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
  queryFunding: tool({
    description:
      "Query structured funding rounds across the Locus database. Use for latest/recent funding, largest rounds, or filters by inclusive announcement dates, company, exact stage (case-insensitive), minimum USD amount, and investor name substring (lead or participating). Sort descending by announcedAt or amount. Returns round amounts, dates, investors, source URLs and totalMatches/hasMore. These are rounds, not company funding totals. Future rounds are excluded; recency excludes unknown or partial dates. Prefer this over text search for filtering or ranking funding. Use getCompanyProfile for total funding.",
    inputSchema: fundingQuerySchema,
    execute: async (input) => {
      const asOf = new Date().toISOString().slice(0, 10);
      const result = await db.execute(buildFundingQuery(input, asOf));
      return fundingQueryResult(result.rows, input, asOf);
    },
  }),
  navigateLocus: tool({
    description:
      "Navigate the user to a Locus result they explicitly asked to open, show, or visit. Also use for a verified person on the CURRENT company page when asked who holds a specific role: this highlights their card without closing Focus. For other destinations resolve the exact company slug first. A person requires the exact personName and should include personUrl from findCompanyPeople. A job requires the exact jobTitle and jobLocation returned by searchLocus or listCompanyJobs. Do not navigate for general research questions.",
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
      "Get the core Locus profile fields for one company when you know its slug. Use searchLocus first when the slug is unknown. For funding rounds use queryFunding; for acquisitions or other historical facts use searchKnowledge.",
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
  getCompanyProfile: tool({
    description:
      "Read authoritative, complete company profile sections from the database. Use for About/what it does, employee count, funding totals/rounds/investors, or dated activity. The current page slug may be used directly. People and jobs have separate focused tools.",
    inputSchema: z.object({
      slug: companySlugSchema,
      section: z.enum(["overview", "funding", "activity"]),
    }),
    execute: async ({ slug, section }) => {
      const [row] = await db
        .select({ profile: companies.profile })
        .from(companies)
        .where(eq(companies.slug, slug))
        .limit(1);
      if (!row) return { error: `No company found for slug "${slug}".` };
      const profile = parseCompanyProfile(
        row.profile as Record<string, unknown>,
      );
      if (section === "funding") {
        return {
          slug,
          name: profile.name,
          logo: profile.logo,
          financials: profile.financials,
          funding: profile.funding,
        };
      }
      if (section === "activity") {
        return {
          slug,
          name: profile.name,
          logo: profile.logo,
          activity: profile.activity,
        };
      }
      const {
        name,
        logo,
        tagline,
        description,
        website,
        foundedYear,
        industry,
        location,
        stage,
        employees,
        financials,
      } = profile;
      return {
        slug,
        name,
        logo,
        tagline,
        description,
        website,
        foundedYear,
        industry,
        location,
        stage,
        employees,
        financials,
      };
    },
  }),
  findCompanyPeople: tool({
    description:
      "Find a person by role or name within a specific company, e.g. CTO, Chief Technology Officer, founder. Filter BEFORE limiting. The current page slug may be used directly. Returns verified people with URLs usable for cards and navigation.",
    inputSchema: z.object({
      slug: companySlugSchema,
      query: z.string().trim().min(2).max(80),
      limit: searchResultLimitSchema,
    }),
    execute: async ({ slug, query, limit }) => {
      const normalized = query.toLowerCase();
      const alternatives =
        normalized === "cto"
          ? ["cto", "chief technology officer", "chief technical officer"]
          : normalized === "ceo"
            ? ["ceo", "chief executive officer"]
            : [normalized];
      const matches = await db
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
          and(
            eq(companies.slug, slug),
            or(
              ...alternatives.flatMap((term) => [
                ilike(people.name, `%${term}%`),
                ilike(people.role, `%${term}%`),
              ]),
            ),
          ),
        )
        .orderBy(asc(people.name))
        .limit(limit);
      return matches.map(
        ({ companyProfile, linkedin, sourceUrl, ...person }) => ({
          ...person,
          url: linkedin ?? sourceUrl,
          companyLogo: companyLogo(companyProfile),
        }),
      );
    },
  }),
  searchKnowledge: tool({
    description:
      'Search across company About/tagline, funding rounds/investors, and dated activity for claims, products, compliance terms, funding news, and concepts. Give 1-6 distinctive search terms (not a conversational sentence); wrap an exact compliance phrase in double quotes, e.g. "SOC 1 Type 1". Quote returned excerpt and source, not just a hit. Use companySlug to narrow to one company, otherwise search globally. Returns top passages, not an exhaustive list. This searches text, not numeric comparisons or the current job/people tables.',
    inputSchema: z.object({
      query: z.string().trim().min(2).max(100),
      companySlug: companySlugSchema.optional(),
      limit: z.number().int().min(1).max(10).default(5),
    }),
    execute: async ({ query, companySlug, limit }) => {
      // The GIN expression index covers the candidate set. Only matching
      // passages are returned, so unrelated text elsewhere in the JSON cannot
      // be mistaken for evidence.
      const result = await db.execute(sql`
        WITH q AS (SELECT websearch_to_tsquery('english', ${query}) AS terms),
        candidates AS (
          SELECT c.slug, c.name, c.profile
          FROM ${companies} c, q
          WHERE to_tsvector('english', c.profile) @@ q.terms
            ${companySlug ? sql`AND c.slug = ${companySlug}` : sql``}
        )
        SELECT c.slug, c.name, passage.section, passage.title,
          passage.content, passage.date, passage.source_url AS "sourceUrl",
          ts_rank_cd(to_tsvector('english', passage.content), q.terms) AS relevance
        FROM candidates c CROSS JOIN q
        CROSS JOIN LATERAL (
          SELECT 'about' AS section, 'About' AS title,
            coalesce(c.profile->>'tagline', '') || ' ' || coalesce(c.profile->>'description', '') AS content,
            NULL::text AS date, c.profile->>'website' AS source_url
          UNION ALL
          SELECT 'activity', item->>'title',
            coalesce(item->>'title', '') || ' ' || coalesce(item->>'description', ''),
            item->>'dateTime', item->>'sourceUrl'
          FROM jsonb_array_elements(coalesce(c.profile->'activity', '[]'::jsonb)) item
          UNION ALL
          SELECT 'funding', 'Funding ' || coalesce(round->>'stage', ''),
            concat_ws(' ', round->>'stage', round->'amount'->>'display',
              round->'valuation'->>'display',
              (SELECT string_agg(investor->>'name', ' ')
               FROM jsonb_array_elements(coalesce(round->'leadInvestors', '[]'::jsonb)) investor),
              (SELECT string_agg(investor->>'name', ' ')
               FROM jsonb_array_elements(coalesce(round->'investors', '[]'::jsonb)) investor)),
            round->>'announcedAt', round->>'sourceUrl'
          FROM jsonb_array_elements(coalesce(c.profile->'funding'->'rounds', '[]'::jsonb)) round
        ) passage
        WHERE to_tsvector('english', passage.content) @@ q.terms
        ORDER BY relevance DESC, passage.date DESC NULLS LAST, c.name
        LIMIT ${limit}
      `);
      return result.rows.map((row) => ({
        slug: row.slug,
        name: row.name,
        section: row.section,
        title: row.title,
        excerpt: String(row.content).slice(0, 900),
        date: row.date,
        sourceUrl: row.sourceUrl,
        pageUrl: `/company/${row.slug}`,
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
      "List open or unknown-status jobs at a company. Use the current page slug directly when applicable; otherwise resolve it with searchLocus. When recommending a role based on a user's background, include concise skills or role criteria. All matching jobs are ranked by title, focus, department, skills, and description before applying the result limit.",
    inputSchema: z.object({
      slug: companySlugSchema,
      limit: resultLimitSchema,
      criteria: z.string().trim().min(1).max(120).optional(),
    }),
    execute: async ({ slug, limit, criteria }) => {
      const terms = jobSearchTerms(criteria);
      const relevance = terms.length
        ? sql<number>`(${sql.join(
            terms.map((term) => {
              const pattern = `%${term}%`;
              return sql`(
              CASE WHEN ${jobs.title} ILIKE ${pattern} THEN 12 ELSE 0 END +
              CASE WHEN ${jobs.focus} ILIKE ${pattern} THEN 7 ELSE 0 END +
              CASE WHEN ${jobs.department} ILIKE ${pattern} THEN 5 ELSE 0 END +
              CASE WHEN array_to_string(${jobs.skills}, ' ') ILIKE ${pattern} THEN 3 ELSE 0 END +
              CASE WHEN ${jobs.searchText} ILIKE ${pattern} THEN 1 ELSE 0 END
            )`;
            }),
            sql` + `,
          )})`
        : sql<number>`0`;
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
        .orderBy(desc(relevance), asc(jobs.title))
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
