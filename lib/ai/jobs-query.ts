import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { companies, jobs } from "../db/schema";
import { jobLocationPredicate } from "../location-query";
import { jobFitEvidence } from "./job-fit-evidence";

export const JOB_FIT_CANDIDATE_POOL_SIZE = 15;

export const jobsQuerySchema = z
  .object({
    resultMode: z
      .enum(["inline", "candidates"])
      .optional()
      .describe(
        "inline (default) displays retrieved jobs immediately for ordinary lists. candidates is REQUIRED for best-fit recommendations: retrieve at least 15 candidates, do not display this pool, compare evidence, then call presentLocusResults with your verified shortlist (normally 3).",
      ),
    companySlugs: z
      .array(
        z
          .string()
          .trim()
          .regex(/^[a-z0-9-]+$/)
          .max(100),
      )
      .min(1)
      .max(50)
      .optional()
      .describe(
        "Verified company slugs from page context or searchLocus. For best fit at HiringCafe, use ['hiringcafe'] after resolving identity. Omit for all companies; never send an empty array or guessed display names.",
      ),
    query: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .describe(
        "Optional HARD full-text keyword constraint. Every non-OR term restricts results. Use only explicitly requested lexical terms, not the question, resume or background. Omit for conceptual fit unless the user also requested exact keywords.",
      ),
    semanticQuery: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .optional()
      .describe(
        "Compact role responsibilities or personal-fit intent: aim for 200–350 characters, hard maximum 500. Summarize core skills and work; do not paste the profile or include every preference. Use for 'best role for me', including at one known company. Example: full-stack product engineering with React, TypeScript, backend APIs and end-to-end ownership. This ranks description evidence, not a hard skills filter. Omit if no usable intent/background exists.",
      ),
    queryScope: z
      .enum(["role", "allContent"])
      .default("role")
      .describe(
        "Scope of lexical query only: role searches title/skills; allContent also searches descriptions/department. Does not control semanticQuery. Defaults role; omit when not needed.",
      ),
    title: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional()
      .describe(
        "HARD literal title substring, only when requested. Not a desired-role ranking hint: use semanticQuery for that.",
      ),
    department: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional()
      .describe(
        "HARD recorded department/focus substring (e.g. Engineering), only for an explicit team restriction. Does not establish a specific role.",
      ),
    skills: z
      .array(z.string().trim().min(1).max(80))
      .min(1)
      .max(10)
      .optional()
      .describe(
        "HARD AND constraints: every listed skill must appear in recorded job skills. At most 10. Only explicit must-have technologies; never copy the user's profile skills here for fit ranking. Use semanticQuery for experience/strengths.",
      ),
    location: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional()
      .describe(
        "HARD job location restriction explicitly requested, e.g. Toronto or Canada. Home location alone does not prove eligibility or an exact requested workplace restriction. Do not invent a location filter.",
      ),
    industry: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional()
      .describe(
        "HARD company-industry substring explicitly requested, not the candidate's current industry.",
      ),
    workplaceType: z
      .enum(["remote", "hybrid", "onsite", "flexible"])
      .optional()
      .describe(
        "HARD workplace arrangement explicitly requested. Values remote, hybrid, onsite, flexible. Remote does not establish worldwide eligibility.",
      ),
    experienceLevel: z
      .enum([
        "intern",
        "entry",
        "mid",
        "senior",
        "staff",
        "principal",
        "manager",
        "director",
        "executive",
      ])
      .optional()
      .describe(
        "HARD recorded seniority level explicitly requested. Unknown levels do not satisfy it; do not infer from a candidate's title or desired growth.",
      ),
    employmentType: z
      .enum(["full-time", "part-time", "contract", "internship", "temporary"])
      .optional()
      .describe(
        "HARD employment type when explicitly requested; omit for unspecified types.",
      ),
    minimumSalary: z
      .number()
      .finite()
      .nonnegative()
      .optional()
      .describe(
        "HARD minimum guaranteed annual USD salary lower bound. Unknown, non-USD, non-annual or maximum-only compensation does not qualify.",
      ),
    visaSponsorship: z
      .enum(["available", "unavailable", "unknown"])
      .optional()
      .describe(
        "HARD recorded visa-sponsorship state explicitly requested. Do not infer eligibility from nationality or home location.",
      ),
    acceptsNewGrads: z
      .boolean()
      .optional()
      .describe(
        "HARD recorded new-grad eligibility only when requested; missing values are not positive evidence.",
      ),
    status: z
      .enum(["open", "openOrUnknown", "closed"])
      .default("open")
      .describe(
        "open = confirmed open; openOrUnknown = recorded roles including unconfirmed status; closed = closed. Use openOrUnknown for role discovery/fit unless confirmed-current openings were explicitly requested. Never call unknown status confirmed open.",
      ),
    sortBy: z
      .enum(["relevance", "salary", "postedAt"])
      .default("relevance")
      .describe(
        "relevance for semantic personal-fit ranking. salary sorts annual USD lower bounds; postedAt sorts known posting dates. Preserve an explicit user ordering.",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe(
        "Retrieved record count, 1–50, not total candidates. For resultMode candidates use 15 (server enforces a minimum pool of 15); the final displayed count is separately set in presentLocusResults, normally 3. For inline lists set to the requested role count. Never send null.",
      ),
  })
  .strict();

export type JobsQuery = z.infer<typeof jobsQuerySchema>;

export function buildJobsQuery(
  input: JobsQuery,
  asOf: string,
  source?: SQL,
  additionalFilters: SQL[] = [],
  fullCandidates = false,
) {
  const filters: SQL[] = [
    sql`(j.posted_at IS NULL OR j.posted_at <= ${asOf})`,
    ...additionalFilters,
  ];
  const roleVector = sql`(setweight(to_tsvector('english', coalesce(j.title, '')), 'A') || setweight(to_tsvector('english', coalesce(array_to_string(j.skills, ' '), '')), 'B'))`;
  const searchVector =
    input.queryScope === "allContent"
      ? sql`(${roleVector} || setweight(to_tsvector('english', concat_ws(' ', j.focus, j.department, j.description)), 'D'))`
      : roleVector;
  if (input.companySlugs)
    filters.push(
      sql`c.slug IN (${sql.join(
        input.companySlugs.map((slug) => sql`${slug}`),
        sql`, `,
      )})`,
    );
  if (input.query)
    filters.push(
      sql`${searchVector} @@ websearch_to_tsquery('english', ${input.query})`,
    );
  if (input.title)
    filters.push(sql`strpos(lower(j.title), lower(${input.title})) > 0`);
  if (input.department)
    filters.push(
      sql`(strpos(lower(j.department), lower(${input.department})) > 0 OR strpos(lower(j.focus), lower(${input.department})) > 0)`,
    );
  for (const skill of input.skills ?? [])
    filters.push(
      sql`EXISTS (SELECT 1 FROM unnest(j.skills) s WHERE strpos(lower(s), lower(${skill})) > 0)`,
    );
  if (input.location)
    filters.push(
      jobLocationPredicate(sql`j.id`, sql`j.location`, input.location),
    );
  if (input.industry)
    filters.push(
      sql`strpos(lower(c.profile->>'industry'), lower(${input.industry})) > 0`,
    );
  if (input.workplaceType)
    filters.push(sql`j.workplace_type = ${input.workplaceType}`);
  if (input.experienceLevel)
    filters.push(sql`j.experience_level = ${input.experienceLevel}`);
  if (input.employmentType)
    filters.push(sql`j.employment_type = ${input.employmentType}`);
  if (input.minimumSalary !== undefined)
    filters.push(
      sql`j.salary_minimum IS NOT NULL AND j.salary_currency = 'USD' AND j.salary_period = 'year' AND j.salary_minimum::numeric >= ${input.minimumSalary}`,
    );
  if (input.visaSponsorship)
    filters.push(
      input.visaSponsorship === "unknown"
        ? sql`(j.visa_sponsorship IS NULL OR j.visa_sponsorship = 'unknown')`
        : sql`j.visa_sponsorship = ${input.visaSponsorship}`,
    );
  if (input.acceptsNewGrads !== undefined)
    filters.push(sql`j.accepts_new_grads = ${input.acceptsNewGrads}`);
  if (input.status === "open") filters.push(sql`j.status = 'open'`);
  if (input.status === "openOrUnknown")
    filters.push(sql`j.status IN ('open', 'unknown')`);
  if (input.status === "closed") filters.push(sql`j.status = 'closed'`);
  if (input.sortBy === "postedAt") filters.push(sql`j.posted_at IS NOT NULL`);
  const order =
    input.sortBy === "salary"
      ? sql`CASE WHEN salary_currency = 'USD' AND salary_period = 'year' THEN salary_minimum::numeric END DESC NULLS LAST`
      : input.sortBy === "postedAt"
        ? sql`posted_at DESC NULLS LAST`
        : input.query
          ? sql`relevance DESC, posted_at DESC NULLS LAST`
          : sql`title ASC`;
  // Company profiles contain full imported jobs and are often large/toasted.
  // Extract tiny display fields once per company, not repeatedly per job.
  const effectiveSource =
    source ?? sql`${jobs} j INNER JOIN company_context c ON j.company_id=c.id`;
  return sql`WITH company_context AS MATERIALIZED (
    SELECT id,slug,name,jsonb_build_object('logo',profile->>'logo','industry',profile->>'industry','location',profile->'location') AS profile
    FROM ${companies}
    ${
      input.companySlugs
        ? sql`WHERE slug IN (${sql.join(
            input.companySlugs.map((slug) => sql`${slug}`),
            sql`, `,
          )})`
        : sql``
    }
  ), matches AS (
    SELECT j.*, c.slug AS company_slug, c.name AS company_name,
      c.profile->>'logo' AS company_logo, c.profile->'location'->>'countryCode' AS country_code,
      c.profile->>'industry' AS company_industry,
      ${input.query ? sql`ts_rank_cd(${searchVector}, websearch_to_tsquery('english', ${input.query}))` : sql`0`} AS relevance
    FROM ${effectiveSource}
    WHERE ${sql.join(filters, sql` AND `)}
  ) SELECT *, count(*) OVER() AS total_matches,
      (SELECT count(DISTINCT company_slug) FROM matches) AS company_matches,
      (SELECT jsonb_agg(summary ORDER BY summary->>'companyName') FROM (
        SELECT jsonb_build_object('companySlug', company_slug, 'companyName', company_name, 'jobCount', count(*)) AS summary
        FROM matches GROUP BY company_slug, company_name ORDER BY company_name LIMIT 50
      ) company_counts) AS company_summaries
    FROM matches
     ORDER BY ${order}, title, company_slug, id ${fullCandidates ? sql`` : sql`LIMIT ${input.limit}`}`;
}

export function jobsQueryResult(
  rows: Record<string, unknown>[],
  input: JobsQuery,
  asOf: string,
) {
  const totalMatches = Number(rows[0]?.total_matches ?? 0);
  return {
    asOf,
    filters: input,
    totalMatches,
    hasMore: totalMatches > rows.length,
    totalCompanies: Number(rows[0]?.company_matches ?? 0),
    companySummaries: rows[0]?.company_summaries ?? [],
    datePolicy:
      "Future postings are excluded. Recency sorting requires a known posted date; salary bounds require annual USD minimum salary. Role-scope keywords search titles/skills; allContent also searches descriptions and department. Recorded remote status does not imply worldwide eligibility; preserve location/travel restrictions.",
    jobs: rows.map((row) => ({
      title: row.title,
      focus: row.focus,
      location: row.location,
      url: row.url,
      companySlug: row.company_slug,
      companyName: row.company_name,
      companyLogo: row.company_logo,
      countryCode: row.country_code,
      department: row.department,
      skills: row.skills,
      workplaceType: row.workplace_type,
      employmentType: row.employment_type,
      experienceLevel: row.experience_level,
      minimumExperienceYears: row.minimum_experience_years,
      maximumExperienceYears: row.maximum_experience_years,
      acceptsNewGrads: row.accepts_new_grads,
      salary: {
        minimum: row.salary_minimum == null ? null : Number(row.salary_minimum),
        maximum: row.salary_maximum == null ? null : Number(row.salary_maximum),
        currency: row.salary_currency,
        period: row.salary_period,
      },
      visaSponsorship: row.visa_sponsorship,
      requiresUsWorkAuthorization: row.requires_us_work_authorization,
      citizenshipRequired: row.citizenship_required,
      status: row.status,
      postedAt: row.posted_at,
      ...(row.semantic_score !== undefined || input.resultMode === "candidates"
        ? {
            ...(row.semantic_score !== undefined
              ? { semanticScore: Number(row.semantic_score) }
              : {}),
            descriptionExcerpt: String(row.description ?? "").slice(0, 1800),
            ...(input.resultMode === "candidates"
              ? jobFitEvidence(String(row.description ?? ""))
              : {}),
          }
        : {}),
    })),
  };
}
