import { neon } from "@neondatabase/serverless";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { parseCompanyProfile } from "../lib/company-profile";
import {
  type LocationCompany,
  type LocationJobRow,
  type LocationOverride,
  planLocationRepairs,
} from "./lib/job-location-repairs";

const apply = process.argv.includes("--apply");
function option(name: string) {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}`);
  return value;
}
const databaseUrl = process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Missing database URL");
const sql = neon(databaseUrl);

async function snapshot() {
  // One consistent read snapshot: profiles and job rows cannot be observed on
  // opposite sides of an import. No credentials are included in these results.
  const [companies, jobs] = await sql.transaction([
    sql`SELECT id, slug, name, profile, md5(profile::text) AS profile_hash FROM companies ORDER BY slug`,
    sql`SELECT id, company_id, title, url, location, search_text,
      md5(search_text) AS search_text_hash,
      md5((to_jsonb(j) - 'location' - 'search_text' - 'updated_at')::text) AS other_fields_hash
      FROM jobs j ORDER BY company_id, id`,
  ], { isolationLevel: "RepeatableRead", readOnly: true });
  return { companies, jobs } as { companies: LocationCompany[]; jobs: LocationJobRow[] };
}

async function main() {
  const overridesPath = option("--overrides");
  const overrides: LocationOverride[] = overridesPath
    ? JSON.parse(await readFile(overridesPath, "utf8"))
    : [];
  const before = await snapshot();
  const plan = planLocationRepairs(before.companies, before.jobs, overrides);
  for (const change of plan.companyChanges) parseCompanyProfile(change.profile as Record<string, unknown>);
  const summary = {
    companiesAudited: before.companies.length,
    jobsAudited: before.jobs.length,
    companiesToChange: plan.companyChanges.length,
    jobsToChange: plan.jobChanges.length,
    unresolved: plan.unresolved,
  };
  console.log(JSON.stringify(summary, null, 2));
  const reportPath = option("--report");
  if (reportPath) {
    await mkdir(dirname(resolve(reportPath)), { recursive: true });
    await writeFile(reportPath, JSON.stringify({ summary, changes: plan.jobChanges.map(({ expected_search_text, search_text, ...change }) => change) }, null, 2), { mode: 0o600 });
  }
  if (!apply) return;
  assert.equal(plan.unresolved.length, 0, "Resolve every unknown location before applying");
  if (!plan.jobChanges.length) {
    console.log("Already normalized; no writes needed.");
    return;
  }
  const backupPath = option("--backup");
  assert.ok(backupPath, "--apply requires --backup /absolute/path.json");
  await mkdir(dirname(resolve(backupPath)), { recursive: true });
  await writeFile(backupPath, JSON.stringify({ createdAt: new Date().toISOString(), ...before, overrides }, null, 2), { mode: 0o600, flag: "wx" });

  // Send only location patches and old-value fingerprints. Sending two full
  // copies of every profile/search body would exceed Neon's HTTP size limits.
  const companyInputs = plan.companyChanges.map((change) => ({
    id: change.id,
    expected_hash: before.companies.find((company) => company.id === change.id)!.profile_hash,
    locations: (change.profile as LocationCompany["profile"]).jobs.map((job) => job.location),
  }));
  const jobInputs = plan.jobChanges.map((change) => ({
    id: change.id,
    company_id: change.company_id,
    expected_location: change.expected_location,
    location: change.location,
    expected_search_hash: before.jobs.find((job) => job.id === change.id)!.search_text_hash,
    prefix_length: [...`${before.companies.find((company) => company.id === change.company_id)!.name} ${change.title} ${change.expected_location}`].length,
    prefix: `${before.companies.find((company) => company.id === change.company_id)!.name} ${change.title} ${change.location}`,
  }));

  // All planned profile and row changes commit as one SQL statement. Every old
  // value is checked under row locks; a conflict makes *both* updates no-ops.
  // Checking RETURNING after a multi-query transaction is too late: it could
  // already have committed one side of a conflicting pair.
  const [result] = await sql`WITH
    input_companies AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(companyInputs)}::jsonb)
      AS x(id uuid, expected_hash text, locations jsonb)
    ),
    input_jobs AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(jobInputs)}::jsonb)
      AS x(id uuid, company_id uuid, expected_location text, location text, expected_search_hash text, prefix_length int, prefix text)
    ),
    locked_companies AS MATERIALIZED (
      SELECT c.id FROM companies c JOIN input_companies i ON c.id = i.id
      WHERE md5(c.profile::text) = i.expected_hash FOR UPDATE OF c
    ),
    locked_jobs AS MATERIALIZED (
      SELECT j.id FROM jobs j JOIN input_jobs i ON j.id = i.id AND j.company_id = i.company_id
      WHERE j.location = i.expected_location AND md5(j.search_text) = i.expected_search_hash FOR UPDATE OF j
    ),
    ready AS MATERIALIZED (
      SELECT (SELECT count(*) FROM locked_companies) = ${plan.companyChanges.length}
         AND (SELECT count(*) FROM locked_jobs) = ${plan.jobChanges.length} AS ok
    ),
    updated_companies AS (
      UPDATE companies c SET profile = jsonb_set(c.profile, '{jobs}', (
        SELECT jsonb_agg(jsonb_set(entry, '{location}', to_jsonb(i.locations->>(ordinality::int - 1))) ORDER BY ordinality)
        FROM jsonb_array_elements(c.profile->'jobs') WITH ORDINALITY AS entries(entry, ordinality)
      )), updated_at = now()
      FROM input_companies i, ready r WHERE c.id = i.id AND r.ok RETURNING c.id
    ),
    updated_jobs AS (
      UPDATE jobs j SET location = i.location, search_text = i.prefix || substring(j.search_text FROM i.prefix_length + 1), updated_at = now()
      FROM input_jobs i, ready r WHERE j.id = i.id AND r.ok RETURNING j.id
    )
    SELECT (SELECT ok FROM ready) AS ok,
      (SELECT count(*)::int FROM updated_companies) AS companies,
      (SELECT count(*)::int FROM updated_jobs) AS jobs`;
  assert.ok(result.ok, "Concurrent edit detected; no location writes were applied. Rerun the audit.");
  assert.equal(result.companies, plan.companyChanges.length);
  assert.equal(result.jobs, plan.jobChanges.length);

  const after = await snapshot();
  const verification = planLocationRepairs(after.companies, after.jobs);
  assert.equal(verification.jobChanges.length, 0, "Readback is not idempotent");
  assert.equal(verification.unresolved.length, 0, "Readback contains unknown locations");
  const expectedLocations = new Map(plan.jobChanges.map((change) => [change.id, change.location]));
  const afterJobs = new Map(after.jobs.map((job) => [job.id, job]));
  assert.equal(after.jobs.length, before.jobs.length, "Job count changed");
  assert.equal(after.companies.length, before.companies.length, "Company count changed");
  for (const company of before.companies) {
    const stored = after.companies.find((candidate) => candidate.id === company.id);
    assert.ok(stored, `Company ID lost: ${company.id}`);
    const change = plan.companyChanges.find((candidate) => candidate.id === company.id);
    assert.deepEqual(stored.profile, change?.profile ?? company.profile, `Unexpected profile edit: ${company.slug}`);
  }
  for (const job of before.jobs) {
    const stored = afterJobs.get(job.id);
    assert.ok(stored, `Job ID lost: ${job.id}`);
    assert.equal(stored.location, expectedLocations.get(job.id) ?? job.location);
    const omitChangedFields = (row: LocationJobRow) => Object.fromEntries(
      Object.entries(row).filter(([key]) => !["location", "search_text", "search_text_hash", "updated_at"].includes(key)),
    );
    assert.deepEqual(omitChangedFields(stored), omitChangedFields(job), `Non-location data changed: ${job.id}`);
  }
  console.log(`Normalized ${result.jobs} jobs across ${result.companies} companies. All ${after.jobs.length} jobs verified; IDs and non-location data preserved. Backup: ${backupPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
