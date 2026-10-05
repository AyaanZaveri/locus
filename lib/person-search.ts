import { sql, type SQL } from "drizzle-orm";
import { allowsFuzzyCompanyName, wordStartPattern } from "./company-search";

/** Fuzzy fallback applies to names only. Role/company/content matching stays
 * literal; multiple people or company affiliations are never collapsed.
 */
export function buildPersonSearchQuery(
  query: string,
  limit: number,
  personSource: SQL = sql`people`,
  companySource: SQL = sql`companies`,
) {
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const prefix = wordStartPattern(query);
  return sql`
    WITH literal AS (
      SELECT p.*, CASE WHEN lower(p.name) = lower(${query}) THEN 0
        WHEN p.name ~* ${prefix} THEN 1 ELSE 2 END AS rank,
        similarity(p.name, ${query}) AS score
      FROM ${personSource} p
      JOIN ${companySource} c ON c.id = p.company_id
      WHERE p.search_text ILIKE ${pattern} OR p.name ~* ${prefix}
    ), candidates AS (
      SELECT *, CASE rank WHEN 0 THEN 'exact-name' WHEN 1 THEN 'name-prefix'
        ELSE 'content' END AS match_type FROM literal
      UNION ALL
      SELECT p.*, 3 AS rank, similarity(p.name, ${query}) AS score,
        'fuzzy-name' AS match_type
      FROM ${personSource} p
      JOIN ${companySource} c ON c.id = p.company_id
      WHERE ${allowsFuzzyCompanyName(query)} AND NOT EXISTS (SELECT 1 FROM literal)
        AND similarity(p.name, ${query}) >= 0.4
    )
    SELECT p.name, p.role, p.image, p.linkedin, p.source_url AS "sourceUrl",
      c.slug AS "companySlug", c.name AS "companyName",
      c.country_code AS "countryCode", jsonb_build_object('logo', c.profile->>'logo') AS profile,
      p.match_type AS "matchType", p.score AS "matchScore"
    FROM candidates p JOIN ${companySource} c ON c.id = p.company_id
    ORDER BY p.rank, p.score DESC, p.name, c.slug, p.id LIMIT ${limit}
  `;
}
