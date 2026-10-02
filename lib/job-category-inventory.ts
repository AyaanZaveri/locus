import { sql } from "drizzle-orm";
import { companies, jobs } from "./db/schema";

/** Include profile jobs too: the company-page team filter reads those records. */
export function buildJobCategoryInventoryQuery() {
  return sql`
    WITH labels AS (
      SELECT department AS label, 'jobs.department' AS source FROM ${jobs}
      UNION ALL SELECT focus, 'jobs.focus' FROM ${jobs}
      UNION ALL SELECT job->>'department', 'profile.jobs.department'
        FROM ${companies} c CROSS JOIN LATERAL jsonb_array_elements(coalesce(c.profile->'jobs', '[]'::jsonb)) job
      UNION ALL SELECT job->>'focus', 'profile.jobs.focus'
        FROM ${companies} c CROSS JOIN LATERAL jsonb_array_elements(coalesce(c.profile->'jobs', '[]'::jsonb)) job
    )
    SELECT trim(label) AS label, array_agg(DISTINCT source ORDER BY source) AS sources
    FROM labels WHERE nullif(trim(label), '') IS NOT NULL
    GROUP BY trim(label) ORDER BY trim(label)
  `;
}
