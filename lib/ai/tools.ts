import "server-only";

import { tool } from "ai";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { compactToolOutput } from "./compact-tool-output";
import {
  retrieveSemantic,
  semanticResult,
  unembeddedCompanyCandidatesQuery,
} from "./semantic-search";
import {
  presentationOptionsSchema,
  selectPresentation,
  withResultPresentation,
} from "./result-presentation";

import { db } from "@/lib/db";
import { companies, jobs, people } from "@/lib/db/schema";
import { jobLocationPredicate } from "@/lib/location-query";
import { parseCompanyProfile } from "@/lib/company-profile";
import { search, type SearchResponse } from "@/lib/search";
import {
  buildFundingQuery,
  fundingQueryResult,
  fundingQuerySchema,
} from "./funding-query";
import {
  buildJobsQuery,
  jobsQueryResult,
  jobsQuerySchema,
  JOB_FIT_CANDIDATE_POOL_SIZE,
} from "./jobs-query";
import { withJobPresentation } from "./job-candidate-presentation";
import { withCompanyPresentation } from "./company-candidate-presentation";
import {
  buildCompanyDiscoveryQuery,
  companyDiscoveryResult,
  companyDiscoverySchema,
  COMPANY_CANDIDATE_POOL_SIZE,
} from "./company-discovery";
import {
  buildPeopleQuery,
  peopleQueryResult,
  peopleQuerySchema,
  buildActivityQuery,
  activityQueryResult,
  activityQuerySchema,
} from "./entity-queries";

const companySlugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]+$/)
  .max(100)
  .describe(
    "Exact lowercase company slug returned by a verified page context or company lookup (for example hiringcafe), not its display name or URL. Do not guess a slug from a name.",
  );

const resultLimitSchema = z
  .number()
  .int()
  .min(1)
  .max(3)
  .default(3)
  .describe(
    "Preview record count, an integer from 1 to 3. Omit for 3; never send null.",
  );
const searchResultLimitSchema = z.number().int().min(1).max(12).default(3);
const searchResultTypeSchema = z.enum(["companies", "people", "jobs"]);

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

// Search only requested entities, without silently retrying separate words
// and dropping the rest of the request. Structured filters use query tools.
async function searchLocus(
  query: string,
  types: Array<z.infer<typeof searchResultTypeSchema>>,
  limit: number,
) {
  const directResult = await search(query, {
    types,
    companyLimit: limit,
    personLimit: limit,
    jobLimit: limit,
  });
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
// Responses can normalize omitted `strict` into strict schemas, making every
// optional filter required. Explicitly opt out: Zod still validates tool input,
// and callers can omit filters they do not need instead of inventing values.
export const locusTools = {
  queryJobs: tool({
    toModelOutput: compactToolOutput,
    strict: false,
    description:
      "The single job retrieval tool for company inventories, cross-company discovery, exact filtering and personal-fit ranking. For best-fit recommendations use resultMode candidates, limit 15 and semanticQuery. This returns an undisplayed pool; compare description/requirements evidence with the user's experience and goals, then call presentLocusResults with a verified shortlist (default 3). Semantic similarity is not suitability. For simple lists omit resultMode or use inline and set limit to the requested displayed count. Supply companySlugs for a known employer. Omit semanticQuery for names, exact skills, or salary/location/status-only filters. Semantic ranks only current vector-covered candidates and reports coverage, scores and description evidence; not exhaustive relevance counts. query remains an additional strict lexical constraint if supplied. Defaults confirmed open; explicitly use openOrUnknown for recorded roles with unconfirmed status, never call them open. " +
      "Filter/rank jobs by role keywords, title, department, ALL skills, job location, company industry, workplace type, seniority, employment type, minimum annual USD salary, sponsorship and new-grad eligibility. queryScope defaults role (title/skills only); allContent also searches descriptions/departments and can match unrelated roles. Department filters are recorded team labels, not proof of an engineering role. companySlugs composes with other queries. Unknown fields never satisfy positive filters. Salary uses the lower bound, not maximum. Returns limited job records plus counts and coverage. Candidate pool limit and final shortlist display count are separate. Remote does not mean worldwide: preserve location/travel restrictions.",
    inputSchema: jobsQuerySchema,
    execute: async (input) => {
      input = jobsQuerySchema.parse(input);
      if (input.resultMode === "candidates")
        input = {
          ...input,
          limit: Math.max(input.limit, JOB_FIT_CANDIDATE_POOL_SIZE),
        };
      const asOf = new Date().toISOString().slice(0, 10);
      if (input.semanticQuery) {
        let unavailable =
          "Embedding service unavailable, rate-limited, or request budget exhausted";
        try {
          const semantic = await retrieveSemantic(
            buildJobsQuery(input, asOf, undefined, [], true),
            "jobs",
            input.semanticQuery,
            input.limit,
            input.sortBy,
          );
          if (!semantic.unavailable)
            return withJobPresentation(
              {
                ...semanticResult(jobsQueryResult(semantic.rows, input, asOf)),
                retrieval: semantic.metadata,
              },
              input.resultMode,
            );
          unavailable = semantic.unavailable;
        } catch {
          /* Controlled lexical fallback; never relax exact filters. */
        }
        const fallback = {
          ...input,
          query: input.query ?? input.semanticQuery,
        };
        const result = await db.execute(buildJobsQuery(fallback, asOf));
        return withJobPresentation(
          {
            ...jobsQueryResult(result.rows, input, asOf),
            retrieval: {
              mode: "lexical-fallback",
              queryUsed: fallback.query,
              reason: unavailable,
              policy:
                "Semantic retrieval was unavailable. These are keyword matches under unchanged structured filters, not vector results. No synonyms or filter relaxation were applied.",
            },
          },
          input.resultMode,
        );
      }
      const result = await db.execute(buildJobsQuery(input, asOf));
      return withJobPresentation(
        jobsQueryResult(result.rows, input, asOf),
        input.resultMode,
      );
    },
  }),
  queryCompanies: tool({
    toModelOutput: compactToolOutput,
    strict: false,
    description:
      "FIRST tool for a ROLE at companies matching a product/mission, recent funding, people or activity condition. Use resultMode candidates and limit 15; describe COMPANY PRODUCT/USERS/USE CASE in semanticQuery, combine exact funding/relation filters, and normally require jobs.status only (no inferred title/skills filters). Review descriptions plus unrankedCompanies, select product-relevant verified slugs, THEN queryJobs candidates for role fit and presentLocusResults for the final role cards. For ordinary company answers use inline (default). " +
      "Use top-level semanticQuery for conceptual company About/product discovery with sortBy relevance. It ranks vector-covered companies AFTER all exact and relation filters, with coverage disclosure. Hidden candidate mode also supplies up to 5 unembedded companies separately as unrankedCompanies under unchanged exact filters, with descriptions/evidence, never invented scores. Omit semanticQuery for names, aliases, or structured-only requests. query adds a strict keyword constraint; nested jobs uses lexical/structured filters only. Semantic counts are covered candidates, not proof of relevance. " +
      "Discover companies by description keywords, industry/location literal substring, country, exact company stage, founded-year/employee bounds and minimum total USD funding. Combine nested funding, jobs, people and activity filters in ONE call for cross-entity questions such as recently funded companies hiring remotely. All relations must match; all filters within a relation must match ONE record. Intersect the full candidate set BEFORE counting or limiting companies, not separate limited funding/job previews. jobs.location is job location; top-level location is company location. jobs defaults confirmed open; recorded remote does not imply worldwide eligibility. Returns final company cards with bounded matching evidence (3 records per relation per company), exact company totalMatches/countUnit and hasMore. Omit unrequested relations; {} explicitly requires a qualifying record. Nested funding filters apply to rounds; minimumTotalFunding applies to company TOTAL. Employee filters require the entire known range to fit; unknown bounds are not positive matches. Sort name ascending or totalFunding/employees/foundedYear descending (employees sorts lower bounds).",
    inputSchema: companyDiscoverySchema,
    execute: async (input) => {
      input = companyDiscoverySchema.parse(input);
      if (input.resultMode === "candidates")
        input = {
          ...input,
          limit: Math.max(input.limit, COMPANY_CANDIDATE_POOL_SIZE),
        };
      const asOf = new Date().toISOString().slice(0, 10);
      // An edited company About can lack a current vector while its jobs have
      // full coverage. Keep a small separately labelled evidence supplement.
      const includeUnembeddedCompanies = input.resultMode === "candidates";
      let unranked: {
        unrankedCompanies?: ReturnType<
          typeof companyDiscoveryResult
        >["companies"];
      } = {};
      if (input.semanticQuery) {
        let unavailable =
          "Embedding service unavailable, rate-limited, or request budget exhausted";
        try {
          const semantic = await retrieveSemantic(
            buildCompanyDiscoveryQuery(input, asOf, undefined, true),
            "companies",
            input.semanticQuery,
            input.limit,
            input.sortBy,
            { includeUnembeddedCompanies },
          );
          if (includeUnembeddedCompanies)
            unranked = {
              unrankedCompanies: companyDiscoveryResult(
                semantic.unembeddedRows,
                input,
                asOf,
              ).companies,
            };
          if (!semantic.unavailable)
            return withCompanyPresentation(
              {
                ...semanticResult(
                  companyDiscoveryResult(semantic.rows, input, asOf),
                ),
                retrieval: semantic.metadata,
                ...unranked,
              },
              input.resultMode,
            );
          unavailable = semantic.unavailable;
        } catch {
          // Exceptional path only: semantic retrieval may fail before returning
          // coverage. Preserve the unranked evidence under unchanged constraints.
          if (includeUnembeddedCompanies)
            unranked = {
              unrankedCompanies: companyDiscoveryResult(
                (
                  await db.execute(
                    unembeddedCompanyCandidatesQuery(
                      buildCompanyDiscoveryQuery(input, asOf, undefined, true),
                    ),
                  )
                ).rows,
                input,
                asOf,
              ).companies,
            };
        }
        const fallback = {
          ...input,
          query: input.query ?? input.semanticQuery,
        };
        const result = await db.execute(
          buildCompanyDiscoveryQuery(fallback, asOf),
        );
        return withCompanyPresentation(
          {
            ...companyDiscoveryResult(result.rows, input, asOf),
            ...unranked,
            retrieval: {
              mode: "lexical-fallback",
              queryUsed: fallback.query,
              reason: unavailable,
              policy:
                "Semantic unavailable. Keyword-only results, with all original structured and relation filters preserved.",
            },
          },
          input.resultMode,
        );
      }
      const result = await db.execute(buildCompanyDiscoveryQuery(input, asOf));
      return withCompanyPresentation(
        companyDiscoveryResult(result.rows, input, asOf),
        input.resultMode,
      );
    },
  }),
  queryPeople: tool({
    toModelOutput: compactToolOutput,
    strict: false,
    description:
      "Filter recorded people across companies by name, role, founder status, companySlugs, company industry/location and country. Role CTO/CEO/CFO/COO includes spelled-out titles; other roles use literal substring. Location refers to the COMPANY, not the person's residence. Returns recorded roles, source/profile links, company context, totalMatches and hasMore. Use for cross-company people discovery; do not infer current employment from historical activity.",
    inputSchema: peopleQuerySchema,
    execute: async (input) => {
      const result = await db.execute(buildPeopleQuery(input));
      return withResultPresentation(peopleQueryResult(result.rows, input));
    },
  }),
  queryActivity: tool({
    toModelOutput: compactToolOutput,
    strict: false,
    description:
      "Query dated company activity by event type, inclusive after/before dates, short text keywords, companySlugs, company industry/location and country. Sort newest first or text relevance. Returns events with dated excerpts and source URLs, totalMatches and hasMore (counts EVENTS, not companies). Unknown/partial dates and future events are excluded. Use for recent launches, hiring signals and news; use queryFunding for structured funding amounts/stages/investors. Text matches are leads, not proof of certification or present-day status.",
    inputSchema: activityQuerySchema,
    execute: async (input) => {
      const asOf = new Date().toISOString().slice(0, 10);
      const result = await db.execute(buildActivityQuery(input, asOf));
      return withResultPresentation(
        activityQueryResult(result.rows, input, asOf),
        "activity",
      );
    },
  }),
  queryFunding: tool({
    toModelOutput: compactToolOutput,
    strict: false,
    description:
      "Query structured funding rounds across the Locus database. Combine inclusive announcement dates with company industry/location literal substrings, exact countryCode, companySlug or companySlugs, exact stage (case-insensitive), minimum USD amount, and investor name substring (lead or participating). For 'search company raised in September 2025', use industry: 'search', announcedAfter: '2025-09-01', announcedBefore: '2025-09-30' in ONE call. All filters apply before counting and limiting; omit unrequested filters. Sort descending by announcedAt or amount. Returns round amounts, dates, investors, source URLs and totalMatches/hasMore. Counts are rounds, not distinct companies or funding totals. Future rounds are excluded; recency excludes unknown or partial dates. Prefer this over text search for filtering or ranking funding. Use getCompanyProfile for total funding.",
    inputSchema: fundingQuerySchema,
    execute: async (input) => {
      const asOf = new Date().toISOString().slice(0, 10);
      const result = await db.execute(buildFundingQuery(input, asOf));
      return withResultPresentation(
        fundingQueryResult(result.rows, input, asOf),
        "rounds",
      );
    },
  }),
  navigateLocus: tool({
    toModelOutput: compactToolOutput,
    strict: false,
    description:
      "Navigate only when the user asks to open or visit a result's page/details, not to show, sort or select chat widgets. Also use for a verified person on the CURRENT company page when asked who holds a specific role: this highlights their card without closing Focus. For other destinations resolve the exact company slug first. A person requires the exact personName and should include personUrl from findCompanyPeople. A job requires the exact jobTitle and jobLocation returned by queryJobs or a verified searchLocus job lookup. Do not navigate for general research questions.",
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
    toModelOutput: compactToolOutput,
    strict: false,
    description:
      "Display previously verified entities as fresh widgets. REQUIRED after queryJobs resultMode candidates to publish only your defensible shortlist: select exact job identities from that pool, compare required experience/seniority and practical constraints with the user's evidence, normally show 3, and prefer distinct companies when equally suitable. The candidate pool itself has not been displayed. Also use for explicit redisplay, reordering or selection from prior turns. Call directly without announcing it. input preserves your chosen ranking order; limit caps total cards. Supply verified identities, not invented matches: the server re-fetches actual records. If evidence is missing, retrieve it rather than inventing fit. Do not redundantly display already-visible current-turn results. Prose adds evidence/caveats not visible in cards.",
    inputSchema: z.object({
      ...presentationOptionsSchema.shape,
      companySlugs: z.array(companySlugSchema).max(50).default([]),
      people: z
        .array(
          z.object({
            companySlug: companySlugSchema,
            name: z.string().trim().min(1).max(120),
          }),
        )
        .max(50)
        .default([]),
      jobs: z
        .array(
          z.object({
            companySlug: companySlugSchema,
            title: z.string().trim().min(1).max(200),
            location: z.string().trim().min(1).max(200),
          }),
        )
        .max(50)
        .default([]),
    }),
    execute: async ({
      companySlugs,
      people: selectedPeople,
      jobs: selectedJobs,
      sort,
      limit,
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

      return withResultPresentation(
        selectPresentation(
          {
            companies: selectedCompanies.filter(isPresent),
            people: verifiedPeople
              .filter(isPresent)
              .map(({ companyProfile: _companyProfile, ...person }) => person),
            jobs: verifiedJobs
              .filter(isPresent)
              .map(({ companyProfile: _companyProfile, ...job }) => job),
          },
          { sort, limit },
        ),
      );
    },
  }),
  searchLocus: tool({
    toModelOutput: compactToolOutput,
    strict: false,
    description:
      "Resolve names/aliases of companies or people, or find recorded jobs by short keywords. For a role at a named employer whose slug is unknown, FIRST resolve only that employer with types ['companies'], then use queryJobs with the returned companySlugs. This identity lookup is not the job recommendation. For other requests set types to the requested entities. Job results include open and unknown-status records, not guaranteed confirmed openings. Use limit 3 for focused lookup, up to 12 for broader discovery. Do not put a resume or a fit description in query; use queryJobs.semanticQuery for fit.",
    inputSchema: z.object({
      query: z
        .string()
        .trim()
        .min(1)
        .max(80)
        .describe(
          "Short name, alias or distinctive lexical phrase, at most 80 characters. For employer resolution use only its name, e.g. HiringCafe, not the user's entire question.",
        ),
      types: z
        .array(searchResultTypeSchema)
        .min(1)
        .max(3)
        .default(["companies", "people", "jobs"])
        .describe(
          "Entity categories to resolve. Use ['companies'] to resolve a named employer before a job-fit search, even when the user ultimately wants jobs.",
        ),
      limit: searchResultLimitSchema.describe(
        "Preview count per entity type, 1–12; use 3 for a focused company lookup. This does not change queryJobs' eventual role limit.",
      ),
    }),
    execute: async ({ query, types, limit }) =>
      withResultPresentation(await searchLocus(query, types, limit)),
  }),
  getCompany: tool({
    toModelOutput: compactToolOutput,
    strict: false,
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
    toModelOutput: compactToolOutput,
    strict: false,
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
    toModelOutput: compactToolOutput,
    strict: false,
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
    toModelOutput: compactToolOutput,
    strict: false,
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
    toModelOutput: compactToolOutput,
    strict: false,
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
            jobLocationPredicate(
              sql`${jobs.id}`,
              sql`${jobs.location}`,
              location,
            ),
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
  listCompanyPeople: tool({
    toModelOutput: compactToolOutput,
    strict: false,
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
