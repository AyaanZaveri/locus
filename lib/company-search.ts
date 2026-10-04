import { sql, type SQL } from "drizzle-orm";
import { companyAliases, type companyAliasSchema } from "./company-aliases";
import type { z } from "zod";

export function wordStartPattern(query: string) {
  return `(^|[^[:alnum:]])${query.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")}`;
}

// Only short, name-like inputs get fuzzy matching. Never fuzzy-match locations,
// industries, salaries, dates or other structured query filters.
export function allowsFuzzyCompanyName(query: string) {
  return (
    query.length >= 4 &&
    query.length <= 40 &&
    /^[\p{L}\p{N}][\p{L}\p{N} .&'-]*$/u.test(query) &&
    query.split(/\s+/).length <= 3
  );
}

/** Literal matches suppress fuzzy fallback before limiting. One DB round trip;
 * fixed threshold avoids connection/session-dependent pg_trgm settings.
 * Name scans are intentional at the current small catalog size. The existing
 * combined-field trigram index is NOT an index on company names alone.
 */
export function buildCompanySearchQuery(
  query: string,
  limit: number,
  source: SQL = sql`companies`,
  aliases: Array<z.infer<typeof companyAliasSchema>> = companyAliases,
) {
  const pattern = wordStartPattern(query);
  return sql`
    WITH alias_data AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(aliases)}::jsonb)
        AS a("companySlug" text, name text, kind text, "sourceUrl" text)
    ), literal AS (
      SELECT slug, name, industry, location, country_code, profile,
        CASE
          WHEN lower(name) = lower(${query}) OR lower(slug) = lower(${query}) THEN 0
          WHEN alias_match.exact THEN 1
          WHEN name ~* ${pattern} OR slug ~* ${pattern} THEN 2
          WHEN alias_match.record IS NOT NULL THEN 3
          WHEN lower(industry) = lower(${query}) OR lower(location) = lower(${query}) THEN 4
          ELSE 5
        END AS rank,
        greatest(similarity(name, ${query}), alias_match.score) AS score,
        alias_match.record AS matched_alias
      FROM ${source} c
      LEFT JOIN LATERAL (
        SELECT lower(a.name) = lower(${query}) AS exact,
          similarity(a.name, ${query}) AS score,
          jsonb_build_object('name', a.name, 'kind', a.kind, 'sourceUrl', a."sourceUrl") AS record
        FROM alias_data a WHERE a."companySlug" = c.slug AND a.name ~* ${pattern}
        ORDER BY (lower(a.name) = lower(${query})) DESC, a.name LIMIT 1
      ) alias_match ON true
      WHERE name ~* ${pattern} OR slug ~* ${pattern}
        OR industry ~* ${pattern} OR location ~* ${pattern}
        OR alias_match.record IS NOT NULL
    ), candidates AS (
      SELECT *, CASE rank WHEN 0 THEN 'exact' WHEN 1 THEN 'alias-exact'
        WHEN 2 THEN 'name-prefix' WHEN 3 THEN 'alias-prefix'
        ELSE 'industry-or-location' END AS match_type FROM literal
      UNION ALL
      SELECT slug, name, industry, location, country_code, profile,
        6 AS rank, similarity(name, ${query}) AS score, NULL::jsonb AS matched_alias,
        'fuzzy-name' AS match_type
      FROM ${source}
      WHERE ${allowsFuzzyCompanyName(query)}
        AND NOT EXISTS (SELECT 1 FROM literal)
        AND similarity(name, ${query}) >= 0.4
    )
    SELECT slug, name, industry, location, country_code AS "countryCode", profile,
      match_type AS "matchType", score AS "matchScore", matched_alias AS "matchedAlias"
    FROM candidates ORDER BY rank, score DESC, name, slug LIMIT ${limit}
  `;
}
