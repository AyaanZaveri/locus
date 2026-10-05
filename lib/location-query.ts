import { sql, type SQL } from "drizzle-orm";
import { sanitizeLocation } from "./job-location";

/** Exact catalog labels/aliases resolve to identities before considering legacy text.
 * Unknown labels retain a literal substring fallback for older records.
 */
function locationMatch(
  locationId: SQL,
  legacyLabel: SQL,
  query: string,
  linkTable: "job_locations" | "company",
) {
  const normalized = sanitizeLocation(query.trim()).toLowerCase();
  const knownId = sql`(SELECT l.id FROM locations l WHERE l.id::text = ${normalized} OR lower(trim(l.name)) = ${normalized} OR lower(trim(l.display_label)) = ${normalized} UNION SELECT la.location_id FROM location_aliases la WHERE la.alias = ${normalized} LIMIT 1)`;
  const countryIds = sql`SELECT p.id FROM locations p JOIN locations country ON country.country_code=p.country_code AND country.kind='country' WHERE lower(country.name)=${normalized} OR country.id::text=${normalized} OR EXISTS (SELECT 1 FROM location_aliases a WHERE a.location_id=country.id AND a.alias=${normalized})`;
  const catalogIds = sql`(SELECT l.id FROM locations l WHERE l.id::text = ${normalized} OR lower(trim(l.name)) = ${normalized} OR lower(trim(l.display_label)) = ${normalized} UNION SELECT la.location_id FROM location_aliases la WHERE la.alias = ${normalized} UNION ${countryIds})`;
  if (linkTable === "job_locations")
    return sql`(
    EXISTS (SELECT 1 FROM job_locations jl WHERE jl.job_id = ${locationId} AND jl.location_id IN ${catalogIds})
    OR (NOT EXISTS (SELECT 1 FROM locations l WHERE l.id = ${knownId}) AND strpos(lower(coalesce(${legacyLabel}, '')), lower(${query.trim()})) > 0)
  )`;
  return sql`(
    (${locationId} IN ${catalogIds})
    OR (NOT EXISTS (SELECT 1 FROM locations l WHERE l.id = ${knownId}) AND strpos(lower(coalesce(${legacyLabel}, '')), lower(${query.trim()})) > 0)
  )`;
}

export function jobLocationPredicate(
  jobId: SQL,
  legacyLabel: SQL,
  query: string,
) {
  return locationMatch(jobId, legacyLabel, query, "job_locations");
}

export function companyLocationPredicate(
  locationId: SQL,
  legacyLabel: SQL,
  query: string,
) {
  return locationMatch(locationId, legacyLabel, query, "company");
}
