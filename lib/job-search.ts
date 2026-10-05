import { sql, type SQL } from "drizzle-orm";
import { allowsFuzzyCompanyName, wordStartPattern } from "./company-search";
import { sanitizeLocation } from "./job-location";
import { jobLocationPredicate } from "./location-query";

/** Fast lexical CMD-K search. Company context is projected once, avoiding
 * carrying the (potentially large) profile JSON through every job row. */
export function buildJobSearchQuery(
  query: string,
  limit: number,
  jobSource: SQL = sql`jobs`,
  companySource: SQL = sql`companies`,
) {
  const words = query.trim().split(/\s+/).filter(Boolean);
  const pattern = wordStartPattern(query.trim());
  const escaped = query.trim().replace(/[\\%_]/g, "\\$&");
  const canonicalLocation = sanitizeLocation(query);
  const locationMatch =
    canonicalLocation !== query
      ? jobLocationPredicate(sql`j.id`, sql`j.location`, canonicalLocation)
      : sql`false`;
  const wordTitlePredicate = words.length
    ? sql`(${sql.join(
        words.map(
          (word) =>
            sql`lower(j.title) LIKE ${`%${word.replace(/[\\%_]/g, "\\$&").toLowerCase()}%`} ESCAPE E'\\\\'`,
        ),
        sql` AND `,
      )})`
    : sql`false`;
  return sql`
    WITH company_context AS MATERIALIZED (
      SELECT id, slug, name, country_code, profile->>'logo' AS logo
      FROM ${companySource}
    ), candidates AS (
      SELECT j.title, j.focus, j.location, j.url,
        c.slug AS "companySlug", c.name AS "companyName",
        c.country_code AS "countryCode",
        CASE WHEN c.logo IS NULL THEN NULL ELSE jsonb_build_object('logo', c.logo) END AS profile,
        CASE
          WHEN lower(j.title) = lower(${query}) THEN 0
          WHEN lower(j.title) LIKE ${`%${escaped.toLowerCase()}%`} ESCAPE E'\\\\' THEN 1
          WHEN ${wordTitlePredicate} THEN 2
          WHEN lower(c.name) LIKE ${`%${escaped.toLowerCase()}%`} ESCAPE E'\\\\' THEN 3
          WHEN ${allowsFuzzyCompanyName(query)} AND similarity(j.title, ${query}) >= 0.4 THEN 4
          WHEN lower(j.focus) LIKE ${`%${escaped.toLowerCase()}%`} ESCAPE E'\\\\'
            OR lower(j.location) LIKE ${`%${escaped.toLowerCase()}%`} ESCAPE E'\\\\'
            OR ${locationMatch} THEN 5
          WHEN j.description ILIKE ${`%${escaped}%`} ESCAPE E'\\\\'
            OR j.search_text ILIKE ${`%${escaped}%`} ESCAPE E'\\\\' THEN 6
          ELSE 99
        END AS rank,
        CASE WHEN ${allowsFuzzyCompanyName(query)} THEN similarity(j.title, ${query}) ELSE 0 END AS score
      FROM ${jobSource} j
      JOIN company_context c ON c.id = j.company_id
      WHERE j.status IN ('open', 'unknown') AND (
        lower(j.title) LIKE ${`%${escaped.toLowerCase()}%`} ESCAPE E'\\\\'
        OR ${wordTitlePredicate}
        OR lower(c.name) LIKE ${`%${escaped.toLowerCase()}%`} ESCAPE E'\\\\'
        OR lower(j.focus) LIKE ${`%${escaped.toLowerCase()}%`} ESCAPE E'\\\\'
        OR lower(j.location) LIKE ${`%${escaped.toLowerCase()}%`} ESCAPE E'\\\\'
        OR j.description ILIKE ${`%${escaped}%`} ESCAPE E'\\\\'
        OR j.search_text ILIKE ${`%${escaped}%`} ESCAPE E'\\\\'
        OR (${allowsFuzzyCompanyName(query)} AND similarity(j.title, ${query}) >= 0.4)
        OR ${locationMatch}
        OR j.title ~* ${pattern}
      )
    )
    SELECT title, focus, location, url, "companySlug", "companyName", "countryCode", profile
    FROM candidates WHERE rank < 99
    ORDER BY rank, score DESC, lower(title), "companySlug", url NULLS LAST
    LIMIT ${Math.max(0, Math.floor(limit))}
  `;
}
