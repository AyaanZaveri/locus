import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { companies } from "../db/schema";
import { companyLocationPredicate } from "../location-query";

const companySlug = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]+$/)
  .max(100);
const companyText = z.string().trim().min(1).max(120);

export const fundingQuerySchema = z
  .strictObject({
    announcedAfter: z.string().date().optional(),
    announcedBefore: z.string().date().optional(),
    companySlug: companySlug
      .optional()
      .describe(
        "One verified company slug. Omit for cross-company discovery; do not also supply companySlugs.",
      ),
    companySlugs: z
      .array(companySlug)
      .min(1)
      .max(50)
      .optional()
      .describe(
        "Match any of these verified company slugs. Omit when no specific companies are requested.",
      ),
    industry: companyText
      .optional()
      .describe(
        "Case-insensitive literal substring of company industry, e.g. 'search' for search companies. Omit unless requested.",
      ),
    location: companyText
      .optional()
      .describe(
        "Case-insensitive literal substring of company location, not investor location. Omit unless requested.",
      ),
    countryCode: z
      .string()
      .trim()
      .regex(/^[a-zA-Z]{2}$/)
      .toLowerCase()
      .optional()
      .describe(
        "Exact two-letter company country code, e.g. 'us' or 'ca'. Omit unless requested.",
      ),
    stage: z.string().trim().min(1).max(100).optional(),
    minimumAmount: z.number().finite().nonnegative().optional(),
    investor: z.string().trim().min(1).max(120).optional(),
    sortBy: z.enum(["announcedAt", "amount"]).default("announcedAt"),
    limit: z.number().int().min(1).max(50).default(10),
  })
  .refine(
    (value) =>
      !value.announcedAfter ||
      !value.announcedBefore ||
      value.announcedAfter <= value.announcedBefore,
    {
      message: "announcedAfter must not exceed announcedBefore.",
      path: ["announcedBefore"],
    },
  )
  .refine((value) => !value.companySlug || !value.companySlugs, {
    message: "Use companySlug or companySlugs, not both.",
    path: ["companySlugs"],
  });

export type FundingQuery = z.infer<typeof fundingQuerySchema>;

// The source seam lets regression tests execute the real SQL against inline
// fixtures, without creating tables or mutating the database.
export function buildFundingQuery(
  input: FundingQuery,
  asOf: string,
  source: SQL = sql`${companies} c`,
  additionalFilters: SQL[] = [],
) {
  const filters: SQL[] = [
    sql`(announced_at IS NULL OR announced_at <= ${asOf})`,
    ...additionalFilters,
  ];
  if (input.announcedAfter)
    filters.push(sql`announced_at >= ${input.announcedAfter}`);
  if (input.announcedBefore)
    filters.push(sql`announced_at <= ${input.announcedBefore}`);
  if (input.companySlug) filters.push(sql`slug = ${input.companySlug}`);
  if (input.companySlugs)
    filters.push(
      sql`slug IN (${sql.join(
        input.companySlugs.map((slug) => sql`${slug}`),
        sql`, `,
      )})`,
    );
  if (input.industry)
    filters.push(sql`strpos(lower(industry), lower(${input.industry})) > 0`);
  if (input.location)
    filters.push(
      companyLocationPredicate(
        sql`headquarters_location_id`,
        sql`location`,
        input.location,
      ),
    );
  if (input.countryCode)
    filters.push(sql`lower(country_code) = ${input.countryCode}`);
  if (input.stage) filters.push(sql`lower(stage) = lower(${input.stage})`);
  if (input.minimumAmount !== undefined)
    filters.push(sql`currency = 'USD' AND amount >= ${input.minimumAmount}`);
  if (input.investor)
    filters.push(sql`EXISTS (
    SELECT 1 FROM jsonb_array_elements(lead_investors || investors) investor
    WHERE strpos(lower(investor->>'name'), lower(${input.investor})) > 0
  )`);
  // An unknown date cannot establish recency. Amount queries may still include
  // undated rounds, unless the caller supplies a date window.
  if (input.sortBy === "announcedAt")
    filters.push(sql`announced_at IS NOT NULL`);
  const order =
    input.sortBy === "amount"
      ? sql`amount DESC NULLS LAST, announced_at DESC NULLS LAST`
      : sql`announced_at DESC NULLS LAST, amount DESC NULLS LAST`;

  return sql`
    WITH rounds AS (
      SELECT c.slug, c.name, c.profile->>'industry' AS industry,
        c.headquarters_location_id,
        c.profile->'location'->>'label' AS location,
        c.profile->'location'->>'countryCode' AS country_code,
        c.profile->>'logo' AS logo,
        round->>'id' AS round_id, round->>'stage' AS stage,
        CASE WHEN round->>'announcedAt' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
          THEN round->>'announcedAt' END AS announced_at,
        CASE WHEN jsonb_typeof(round->'amount'->'amount') = 'number'
          THEN (round->'amount'->>'amount')::numeric END AS amount,
        round->'amount'->>'currency' AS currency,
        round->'amount'->>'display' AS amount_display,
        round->'valuation' AS valuation,
        coalesce(round->'leadInvestors', '[]'::jsonb) AS lead_investors,
        coalesce(round->'investors', '[]'::jsonb) AS investors,
        round->>'sourceUrl' AS source_url
      FROM ${source}
      CROSS JOIN LATERAL jsonb_array_elements(coalesce(c.profile->'funding'->'rounds', '[]'::jsonb)) round
    )
    SELECT *, count(*) OVER() AS total_matches
    FROM rounds WHERE ${sql.join(filters, sql` AND `)}
    ORDER BY ${order}, name, slug, round_id
    LIMIT ${input.limit}
  `;
}

export function fundingQueryResult(
  rows: Record<string, unknown>[],
  input: FundingQuery,
  asOf: string,
) {
  const totalMatches = Number(rows[0]?.total_matches ?? 0);
  return {
    asOf,
    filters: input,
    totalMatches,
    hasMore: totalMatches > rows.length,
    datePolicy:
      "Date bounds are inclusive. Future rounds are excluded. Recency requires a full announcement date; unknown or partial dates are not evidence of recency. Amount filters are in USD.",
    rounds: rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      industry: row.industry,
      location: row.location,
      countryCode: row.country_code,
      logo: row.logo,
      roundId: row.round_id,
      stage: row.stage,
      announcedAt: row.announced_at,
      amount: {
        amount: row.amount === null ? null : Number(row.amount),
        currency: row.currency,
        display: row.amount_display,
      },
      valuation: row.valuation,
      leadInvestors: row.lead_investors,
      investors: row.investors,
      sourceUrl: row.source_url,
      pageUrl: `/company/${row.slug}`,
    })),
  };
}
