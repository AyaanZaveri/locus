import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { companies, people } from "../db/schema";
import { companyLocationPredicate } from "../location-query";

const shortText = z.string().trim().min(1).max(120);
const companySlugs = z
  .array(
    z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(100),
  )
  .min(1)
  .max(50);
const limit = z.number().int().min(1).max(50).default(10);
const count = z.number().int().nonnegative().max(1_000_000_000);
const companyFilters = {
  companySlugs: companySlugs.optional(),
  industry: shortText.optional(),
  location: shortText.optional(),
  countryCode: z.string().length(2).optional(),
};

export const companiesQuerySchema = z
  .object({
    ...companyFilters,
    query: shortText.optional(),
    semanticQuery: z.string().trim().min(1).max(500).optional(),
    stage: shortText.optional(),
    minimumEmployees: count.optional(),
    maximumEmployees: count.optional(),
    foundedAfter: z.number().int().min(1800).max(2100).optional(),
    foundedBefore: z.number().int().min(1800).max(2100).optional(),
    minimumTotalFunding: z.number().finite().nonnegative().optional(),
    sortBy: z
      .enum(["name", "relevance", "totalFunding", "employees", "foundedYear"])
      .default("name"),
    limit,
  })
  .strict()
  .refine(
    (v) =>
      v.minimumEmployees === undefined ||
      v.maximumEmployees === undefined ||
      v.minimumEmployees <= v.maximumEmployees,
    { message: "minimumEmployees must not exceed maximumEmployees." },
  )
  .refine(
    (v) =>
      v.foundedAfter === undefined ||
      v.foundedBefore === undefined ||
      v.foundedAfter <= v.foundedBefore,
    { message: "foundedAfter must not exceed foundedBefore." },
  );

export const peopleQuerySchema = z.object({
  ...companyFilters,
  name: shortText.optional(),
  role: shortText.optional(),
  isFounder: z.boolean().optional(),
  limit,
});

export const activityQuerySchema = z
  .object({
    ...companyFilters,
    type: z
      .enum([
        "documentation",
        "funding",
        "growth",
        "hiring",
        "news",
        "people",
        "product",
      ])
      .optional(),
    query: shortText.optional(),
    after: z.string().date().optional(),
    before: z.string().date().optional(),
    sortBy: z.enum(["date", "relevance"]).default("date"),
    limit,
  })
  .refine((v) => !v.after || !v.before || v.after <= v.before, {
    message: "after must not exceed before.",
  });

type CompanyFilters = z.infer<typeof peopleQuerySchema>;
// Literal substring matches: '%' and '_' have no wildcard meaning.
function contains(field: SQL, value: string) {
  return sql`strpos(lower(${field}), lower(${value})) > 0`;
}
function commonFilters(input: CompanyFilters) {
  const filters: SQL[] = [];
  if (input.companySlugs)
    filters.push(
      sql`slug IN (${sql.join(
        input.companySlugs.map((s) => sql`${s}`),
        sql`, `,
      )})`,
    );
  if (input.industry) filters.push(contains(sql`industry`, input.industry));
  if (input.location)
    filters.push(
      companyLocationPredicate(
        sql`headquarters_location_id`,
        sql`location`,
        input.location,
      ),
    );
  if (input.countryCode)
    filters.push(sql`lower(country_code) = lower(${input.countryCode})`);
  return filters;
}
function where(filters: SQL[]) {
  return filters.length ? sql.join(filters, sql` AND `) : sql`true`;
}
const datePattern = "^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$";

export function buildCompaniesQuery(
  input: z.infer<typeof companiesQuerySchema>,
  source: SQL = sql`${companies} c`,
  relations: { joins: SQL[]; filters: SQL[]; columns: SQL[] } = {
    joins: [],
    filters: [],
    columns: [],
  },
  fullCandidates = false,
) {
  const filters = [...commonFilters(input), ...relations.filters];
  if (input.query)
    filters.push(
      sql`to_tsvector('english', concat_ws(' ', name, tagline, description)) @@ websearch_to_tsquery('english', ${input.query})`,
    );
  if (input.stage) filters.push(sql`lower(stage) = lower(${input.stage})`);
  // Require the known range to fit the requested bounds, not just overlap.
  if (input.minimumEmployees !== undefined)
    filters.push(sql`employee_min >= ${input.minimumEmployees}`);
  if (input.maximumEmployees !== undefined)
    filters.push(sql`employee_max <= ${input.maximumEmployees}`);
  if (input.foundedAfter !== undefined)
    filters.push(sql`founded_year >= ${input.foundedAfter}`);
  if (input.foundedBefore !== undefined)
    filters.push(sql`founded_year <= ${input.foundedBefore}`);
  if (input.minimumTotalFunding !== undefined)
    filters.push(
      sql`funding_currency = 'USD' AND total_funding >= ${input.minimumTotalFunding}`,
    );
  const order = {
    name: sql`name ASC`,
    relevance: input.query
      ? sql`ts_rank_cd(to_tsvector('english',concat_ws(' ',name,tagline,description)),websearch_to_tsquery('english',${input.query})) DESC`
      : sql`name ASC`,
    totalFunding: sql`CASE WHEN funding_currency = 'USD' THEN total_funding END DESC NULLS LAST`,
    employees: sql`employee_min DESC NULLS LAST`,
    foundedYear: sql`founded_year DESC NULLS LAST`,
  }[input.sortBy];
  return sql`
    WITH base AS (
      SELECT c.slug, c.name, c.industry, c.stage, c.location, c.country_code, c.headquarters_location_id,
        c.employee_count, c.profile->>'logo' AS logo, c.profile->>'tagline' AS tagline,
        c.profile->>'description' AS description, c.profile->>'website' AS source_url,
        regexp_replace(replace(c.employee_count, ',', ''), ' employees.*$', '') AS employee_spec,
        CASE WHEN jsonb_typeof(c.profile->'foundedYear') = 'number' THEN (c.profile->>'foundedYear')::numeric END AS founded_year,
        CASE WHEN jsonb_typeof(c.profile->'financials'->'totalFunding'->'amount') = 'number' THEN (c.profile->'financials'->'totalFunding'->>'amount')::numeric END AS total_funding,
        c.profile->'financials'->'totalFunding'->>'currency' AS funding_currency,
        c.profile->'financials'->'totalFunding'->>'display' AS funding_display
      FROM ${source}
    ), bounds AS (
      SELECT *,
        CASE WHEN employee_spec ~ '^[0-9]+(-[0-9]+|[+])?$' THEN substring(employee_spec FROM '^[0-9]+')::numeric END AS employee_min,
        CASE WHEN employee_spec ~ '^[0-9]+$' THEN employee_spec::numeric
          WHEN employee_spec ~ '^[0-9]+-[0-9]+$' THEN split_part(employee_spec, '-', 2)::numeric END AS employee_max
      FROM base
    )
    SELECT slug, name, industry, stage, location, country_code, logo, tagline,
       employee_count, employee_min, employee_max, founded_year, total_funding,
       ${fullCandidates ? sql`description,` : sql``}
       funding_currency, funding_display, source_url, count(*) OVER() AS total_matches
       ${relations.columns.length ? sql`, ${sql.join(relations.columns, sql`, `)}` : sql``}
    FROM bounds ${sql.join(relations.joins, sql` `)}
     WHERE ${where(filters)} ORDER BY ${order}, slug ${fullCandidates ? sql`` : sql`LIMIT ${input.limit}`}
  `;
}

export function buildPeopleQuery(
  input: z.infer<typeof peopleQuerySchema>,
  source: SQL = sql`${people} p INNER JOIN ${companies} c ON p.company_id = c.id`,
  additionalFilters: SQL[] = [],
) {
  const filters = [...commonFilters(input), ...additionalFilters];
  if (input.name) filters.push(contains(sql`name`, input.name));
  if (input.role) {
    const aliases: Record<string, string> = {
      cto: "\\mcto\\M|chief (technology|technical) officer",
      ceo: "\\mceo\\M|chief executive officer",
      cfo: "\\mcfo\\M|chief financial officer",
      coo: "\\mcoo\\M|chief operating officer",
    };
    filters.push(
      Object.hasOwn(aliases, input.role.toLowerCase())
        ? sql`role ~* ${aliases[input.role.toLowerCase()]}`
        : contains(sql`role`, input.role),
    );
  }
  if (input.isFounder !== undefined)
    filters.push(sql`is_founder = ${input.isFounder}`);
  return sql`
    WITH candidates AS (
      SELECT p.id, p.name, p.role, p.image, p.linkedin, p.source_url,
        CASE
          WHEN p.is_founder = true OR p.role ~* ${"\\m(co[- ]?founder|founder)\\M"} THEN true
          ELSE (SELECT (person->>'isFounder')::boolean
            FROM jsonb_array_elements(coalesce(c.profile->'people', '[]'::jsonb)) person
            WHERE person->>'name' = p.name AND person->>'role' = p.role
              AND jsonb_typeof(person->'isFounder') = 'boolean'
            LIMIT 1)
        END AS is_founder,
        c.slug, c.name AS company_name, c.industry, c.location, c.country_code, c.headquarters_location_id,
        c.profile->>'logo' AS company_logo
      FROM ${source}
    )
    SELECT *, count(*) OVER() AS total_matches FROM candidates
    WHERE ${where(filters)} ORDER BY name, company_name, id LIMIT ${input.limit}
  `;
}

export function buildActivityQuery(
  input: z.infer<typeof activityQuerySchema>,
  asOf: string,
  source: SQL = sql`${companies} c`,
  additionalFilters: SQL[] = [],
) {
  const filters = [...commonFilters(input), ...additionalFilters];
  filters.push(sql`date IS NOT NULL AND date <= ${asOf}`);
  if (input.type) filters.push(sql`type = ${input.type}`);
  if (input.after) filters.push(sql`date >= ${input.after}`);
  if (input.before) filters.push(sql`date <= ${input.before}`);
  const terms = sql`websearch_to_tsquery('english', ${input.query ?? ""})`;
  const vector = sql`to_tsvector('english', concat_ws(' ', title, description))`;
  if (input.query) filters.push(sql`${vector} @@ ${terms}`);
  const order =
    input.sortBy === "relevance" && input.query
      ? sql`ts_rank_cd(${vector}, ${terms}) DESC, date DESC`
      : sql`date DESC`;
  return sql`
    WITH events AS (
      SELECT c.slug, c.name, c.industry, c.location, c.country_code, c.headquarters_location_id,
        c.profile->>'logo' AS logo, item->>'type' AS type,
        item->>'title' AS title, item->>'description' AS description,
        CASE WHEN item->>'dateTime' ~ ${datePattern} THEN item->>'dateTime' END AS date,
        item->>'sourceUrl' AS source_url, ordinal
      FROM ${source}
      CROSS JOIN LATERAL jsonb_array_elements(coalesce(c.profile->'activity', '[]'::jsonb)) WITH ORDINALITY AS events(item, ordinal)
    )
    SELECT *, count(*) OVER() AS total_matches FROM events
    WHERE ${where(filters)} ORDER BY ${order}, name, slug, ordinal LIMIT ${input.limit}
  `;
}

function metadata(rows: Record<string, unknown>[], filters: unknown) {
  const totalMatches = Number(rows[0]?.total_matches ?? 0);
  return { filters, totalMatches, hasMore: totalMatches > rows.length };
}
function numberOrNull(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}
function companyCard(row: Record<string, unknown>) {
  return {
    slug: row.slug,
    name: row.name,
    industry: row.industry,
    location: row.location,
    countryCode: row.country_code,
    logo: row.logo,
    pageUrl: `/company/${row.slug}`,
  };
}

export function companiesQueryResult(
  rows: Record<string, unknown>[],
  input: z.infer<typeof companiesQuerySchema>,
) {
  return {
    ...metadata(rows, input),
    policy:
      "Employee bounds match only when the entire known range fits; open-ended/unknown upper bounds cannot satisfy a maximum. Employee sorting uses the lower bound, not an exact count. Funding filters/sorting use USD company totals, not round amounts. Founded-year bounds are inclusive. Source URLs are profile references, not necessarily evidence for every field.",
    companies: rows.map((row) => ({
      ...companyCard(row),
      tagline: row.tagline,
      stage: row.stage,
      employees: {
        display: row.employee_count,
        minimum: numberOrNull(row.employee_min),
        maximum: numberOrNull(row.employee_max),
      },
      foundedYear: numberOrNull(row.founded_year),
      totalFunding: {
        amount: numberOrNull(row.total_funding),
        currency: row.funding_currency,
        display: row.funding_display,
      },
      sourceUrl: row.source_url,
      ...(row.semantic_score !== undefined
        ? {
            semanticScore: Number(row.semantic_score),
            descriptionExcerpt: row.description,
          }
        : {}),
    })),
  };
}

export function peopleQueryResult(
  rows: Record<string, unknown>[],
  input: z.infer<typeof peopleQuerySchema>,
) {
  return {
    ...metadata(rows, input),
    policy:
      "Roles are recorded profile fields, not independently verified present-day employment. Founder status uses an explicit true flag or a founder/co-founder title; false requires an explicit profile flag, otherwise unknown. Location and industry filters refer to the company, not the person's residence.",
    people: rows.map((row) => ({
      name: row.name,
      role: row.role,
      image: row.image,
      isFounder: row.is_founder,
      url: row.linkedin ?? row.source_url,
      sourceUrl: row.source_url,
      companySlug: row.slug,
      companyName: row.company_name,
      companyLogo: row.company_logo,
      countryCode: row.country_code,
      companyIndustry: row.industry,
      companyLocation: row.location,
    })),
  };
}

export function activityQueryResult(
  rows: Record<string, unknown>[],
  input: z.infer<typeof activityQuerySchema>,
  asOf: string,
) {
  return {
    ...metadata(rows, input),
    asOf,
    policy:
      "Date bounds are inclusive. Undated, partial-date and future events are excluded. Results are recorded activity, not a complete live news feed; text matches are evidence leads, not proof of a claim. Product activity can include case studies/research posts, not just launches; preserve the excerpt's distinction. Counts are events, not distinct companies.",
    activity: rows.map((row) => ({
      ...companyCard(row),
      type: row.type,
      title: row.title,
      date: row.date,
      excerpt: String(row.description ?? "").slice(0, 900),
      sourceUrl: row.source_url,
    })),
  };
}
