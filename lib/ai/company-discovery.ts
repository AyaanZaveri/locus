import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { companies, jobs, people } from "../db/schema";
import {
  activityQuerySchema,
  buildActivityQuery,
  buildCompaniesQuery,
  buildPeopleQuery,
  companiesQueryResult,
  companiesQuerySchema,
  peopleQuerySchema,
  activityQueryResult,
  peopleQueryResult,
} from "./entity-queries";
import {
  buildFundingQuery,
  fundingQueryResult,
  fundingQuerySchema,
} from "./funding-query";
import { buildJobsQuery, jobsQueryResult, jobsQuerySchema } from "./jobs-query";

// Relation inputs contain filters only: outer company filters and the final
// limit control discovery. Each relation must satisfy all its filters on ONE
// record. The fixed inner limit bounds evidence, never the company candidate set.
const funding = z
  .strictObject({
    announcedAfter: fundingQuerySchema.shape.announcedAfter,
    announcedBefore: fundingQuerySchema.shape.announcedBefore,
    stage: fundingQuerySchema.shape.stage,
    minimumAmount: fundingQuerySchema.shape.minimumAmount,
    investor: fundingQuerySchema.shape.investor,
  })
  .refine(
    (v) =>
      !v.announcedAfter ||
      !v.announcedBefore ||
      v.announcedAfter <= v.announcedBefore,
    {
      message: "announcedAfter must not exceed announcedBefore.",
      path: ["announcedBefore"],
    },
  );
const hiring = jobsQuerySchema
  .omit({ companySlugs: true, industry: true, limit: true, sortBy: true })
  .safeExtend({
    query: jobsQuerySchema.shape.query.describe(
      "Role/title keywords, e.g. 'engineer OR technical staff'. Use this for engineers/designers; do not put role names in skills. Supports quoted phrases, OR and exclusions.",
    ),
    skills: jobsQuerySchema.shape.skills.describe(
      "ALL required technology/skill keywords, e.g. ['Python', 'PostgreSQL']. Not role names: use query/title for 'engineer'. Omit unless actual skills are requested.",
    ),
    queryScope: jobsQuerySchema.shape.queryScope.describe(
      "role searches titles and skills; allContent also searches responsibilities/descriptions. Use role for role requests.",
    ),
  })
  .strict();
const person = peopleQuerySchema
  .pick({ name: true, role: true, isFounder: true })
  .strict();
const activity = z
  .strictObject({
    type: activityQuerySchema.shape.type,
    query: activityQuerySchema.shape.query,
    after: activityQuerySchema.shape.after,
    before: activityQuerySchema.shape.before,
  })
  .refine((v) => !v.after || !v.before || v.after <= v.before, {
    message: "after must not exceed before.",
    path: ["before"],
  });

export const companyDiscoverySchema = companiesQuerySchema
  .safeExtend({
    countryCode: fundingQuerySchema.shape.countryCode,
    funding: funding
      .optional()
      .describe(
        "Require a matching funding round. All round filters must match the same round. {} requires a dated, non-future round.",
      ),
    jobs: hiring
      .optional()
      .describe(
        "Require a matching job. All hiring filters must match the same job; confirmed open by default. Location here is JOB location, not company location.",
      ),
    people: person
      .optional()
      .describe(
        "Require a matching recorded person. Name, role and founder filters must match the same person.",
      ),
    activity: activity
      .optional()
      .describe(
        "Require a matching dated activity item. Type, keywords and inclusive date bounds must match the same item; future/unknown dates are excluded.",
      ),
  })
  .strict();

export type CompanyDiscovery = z.infer<typeof companyDiscoverySchema>;
type DiscoverySources = { companies: SQL; jobs: SQL; people: SQL };
const evidenceLimit = 3;

function relationInputs(input: CompanyDiscovery) {
  return {
    funding: input.funding
      ? fundingQuerySchema.parse({ ...input.funding, limit: evidenceLimit })
      : undefined,
    jobs: input.jobs
      ? jobsQuerySchema.parse({ ...input.jobs, limit: evidenceLimit })
      : undefined,
    people: input.people
      ? peopleQuerySchema.parse({ ...input.people, limit: evidenceLimit })
      : undefined,
    activity: input.activity
      ? activityQuerySchema.parse({ ...input.activity, limit: evidenceLimit })
      : undefined,
  };
}

export function buildCompanyDiscoveryQuery(
  input: CompanyDiscovery,
  asOf: string,
  sources: DiscoverySources = {
    companies: sql`${companies} c`,
    jobs: sql`${jobs} j INNER JOIN ${companies} c ON j.company_id = c.id`,
    people: sql`${people} p INNER JOIN ${companies} c ON p.company_id = c.id`,
  },
) {
  const queries = relationInputs(input);
  const relations = {
    joins: [] as SQL[],
    filters: [] as SQL[],
    columns: [] as SQL[],
  };
  // Each correlated retrieval filters the FULL relation for this company before
  // taking three evidence records. Aggregation yields exactly one joined row,
  // so multiple rounds/jobs/people never inflate the distinct-company count.
  const add = (name: string, query: SQL) => {
    const alias = sql.identifier(`${name}_evidence`);
    relations.joins.push(sql`CROSS JOIN LATERAL (
      SELECT jsonb_agg(to_jsonb(matched) - 'description' - 'company_summaries') AS records
      FROM (${query}) matched
    ) ${alias}`);
    relations.filters.push(sql`${alias}.records IS NOT NULL`);
    relations.columns.push(
      sql`${alias}.records AS ${sql.identifier(`${name}_records`)}`,
    );
  };
  if (queries.funding)
    add(
      "funding",
      buildFundingQuery(queries.funding, asOf, sources.companies, [
        sql`rounds.slug = bounds.slug`,
      ]),
    );
  if (queries.jobs)
    add(
      "jobs",
      buildJobsQuery(queries.jobs, asOf, sources.jobs, [
        sql`c.slug = bounds.slug`,
      ]),
    );
  if (queries.people)
    add(
      "people",
      buildPeopleQuery(queries.people, sources.people, [
        sql`candidates.slug = bounds.slug`,
      ]),
    );
  // Keep the bounded activity excerpt available to the result mapper.
  if (queries.activity) {
    const query = buildActivityQuery(
      queries.activity,
      asOf,
      sources.companies,
      [sql`events.slug = bounds.slug`],
    );
    relations.joins.push(sql`CROSS JOIN LATERAL (
      SELECT jsonb_agg(to_jsonb(matched) || jsonb_build_object('description', left(matched.description, 900))) AS records
      FROM (${query}) matched
    ) activity_evidence`);
    relations.filters.push(sql`activity_evidence.records IS NOT NULL`);
    relations.columns.push(sql`activity_evidence.records AS activity_records`);
  }
  return buildCompaniesQuery(input, sources.companies, relations);
}

function records(value: unknown): Record<string, unknown>[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (row) => row !== null && typeof row === "object" && !Array.isArray(row),
    )
  ) {
    throw new Error("Invalid company discovery evidence.");
  }
  return value;
}

export function companyDiscoveryResult(
  rows: Record<string, unknown>[],
  input: CompanyDiscovery,
  asOf: string,
) {
  const base = companiesQueryResult(rows, input);
  const queries = relationInputs(input);
  return {
    ...base,
    asOf,
    countUnit: "companies" as const,
    policy: `${base.policy} All supplied relations are intersected before counting and limiting companies. Filters within each relation must match the same record. Evidence is capped at ${evidenceLimit} records per relation per company; evidence counts are not company counts. Job eligibility and date policies are returned with the evidence.`,
    companies: base.companies.map((company, index) => ({
      ...company,
      ...(Object.values(queries).some(Boolean)
        ? {
            evidence: {
              ...(queries.funding
                ? {
                    funding: fundingQueryResult(
                      records(rows[index].funding_records),
                      queries.funding,
                      asOf,
                    ),
                  }
                : {}),
              ...(queries.jobs
                ? {
                    jobs: jobsQueryResult(
                      records(rows[index].jobs_records),
                      queries.jobs,
                      asOf,
                    ),
                  }
                : {}),
              ...(queries.people
                ? {
                    people: peopleQueryResult(
                      records(rows[index].people_records),
                      queries.people,
                    ),
                  }
                : {}),
              ...(queries.activity
                ? {
                    activity: activityQueryResult(
                      records(rows[index].activity_records),
                      queries.activity,
                      asOf,
                    ),
                  }
                : {}),
            },
          }
        : {}),
    })),
  };
}
