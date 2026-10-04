type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type ObjectValue = { [key: string]: Json };

const assetFields = new Set(["logo", "image", "companyLogo"]);
const contextFields = ["asOf", "filters", "policy", "datePolicy"] as const;
const relationRecords = {
  funding: "rounds",
  jobs: "jobs",
  people: "people",
  activity: "activity",
} as const;

function isObject(value: Json | undefined): value is ObjectValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function withoutAssets(value: Json): Json {
  if (Array.isArray(value)) return value.map(withoutAssets);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !assetFields.has(key))
      .map(([key, child]) => [key, withoutAssets(child)]),
  );
}

function context(value: ObjectValue): ObjectValue {
  return Object.fromEntries(
    contextFields
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, value[key]]),
  );
}

// Supporting records inherit their company context from the enclosing company.
// Remove only values that actually equal it. Preserve disagreements/unknowns,
// job locations, person names, sources, and exact navigation identities.
function removeRepeatedCompanyFields(
  record: ObjectValue,
  company: ObjectValue,
  relation: string,
) {
  const aliases: Record<string, string> =
    relation === "funding" || relation === "activity"
      ? {
          slug: "slug",
          name: "name",
          industry: "industry",
          location: "location",
          countryCode: "countryCode",
          pageUrl: "pageUrl",
        }
      : {
          companySlug: "slug",
          companyName: "name",
          companyIndustry: "industry",
          companyLocation: "location",
          countryCode: "countryCode",
        };
  for (const [key, parentKey] of Object.entries(aliases)) {
    if (
      record[key] !== undefined &&
      company[parentKey] !== undefined &&
      JSON.stringify(record[key]) === JSON.stringify(company[parentKey])
    ) {
      delete record[key];
    }
  }
}

/** Model-only projection. Never truncates rows/text or removes financial facts,
 * investors, evidence sources, counts, unknowns, eligibility or error details.
 * The JSON round-trip mirrors SDK serialization and keeps the UI result intact.
 */
export function compactToolResult(output: unknown): Json {
  const serialized = JSON.stringify(output);
  const value = withoutAssets(
    serialized === undefined ? null : JSON.parse(serialized),
  );
  if (!isObject(value) || !Array.isArray(value.companies)) return value;
  const companies = value.companies.filter(isObject);
  const sharedContext: ObjectValue = {};
  for (const [relation, recordsKey] of Object.entries(relationRecords)) {
    const entries = companies.flatMap((company) => {
      const evidence = company.evidence;
      const result = isObject(evidence) ? evidence[relation] : undefined;
      return isObject(result) ? [{ company, result }] : [];
    });
    if (!entries.length) continue;
    const firstContext = context(entries[0].result);
    if (
      Object.keys(firstContext).length &&
      entries.every(
        ({ result }) =>
          JSON.stringify(context(result)) === JSON.stringify(firstContext),
      )
    ) {
      sharedContext[relation] = firstContext;
      for (const { result } of entries) {
        for (const key of contextFields) delete result[key];
      }
    }
    for (const { company, result } of entries) {
      const records = result[recordsKey];
      if (Array.isArray(records)) {
        for (const record of records) {
          if (isObject(record))
            removeRepeatedCompanyFields(record, company, relation);
        }
      }
    }
  }
  if (Object.keys(sharedContext).length) value.evidenceContext = sharedContext;
  return value;
}

export function compactToolOutput({ output }: { output: unknown }) {
  return { type: "json" as const, value: compactToolResult(output) };
}
