import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { neon } from "@neondatabase/serverless";
import {
  LocationCatalog,
  type CanonicalLocation,
} from "./lib/location-catalog";
import { type LocationReference } from "../lib/location-reference";

const sql = neon(process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL!);
const apply = process.argv.includes("--apply");
const option = (key: string) => {
  const i = process.argv.indexOf(key);
  return i < 0 ? undefined : process.argv[i + 1];
};

async function snapshot() {
  const [companies, jobs, places, aliases, links] = await sql.transaction(
    [
      sql`SELECT *, md5(profile::text) AS hash FROM companies ORDER BY id`,
      sql`SELECT j.id,j.company_id,j.title,j.url,j.location,j.workplace_type,
      md5(to_jsonb(j)::text) AS hash,
      md5((to_jsonb(j)-'location'-'search_text'-'updated_at')::text) AS other_hash,
      left(j.search_text,length(c.name || ' ' || j.title || ' ' || j.location)) = c.name || ' ' || j.title || ' ' || j.location AS prefix_ok
      FROM jobs j JOIN companies c ON c.id=j.company_id ORDER BY j.id`,
      sql`SELECT id, identity_key AS "identityKey", name, display_label AS "displayLabel", kind, country_code AS "countryCode", subdivision_code AS "subdivisionCode" FROM locations`,
      sql`SELECT alias, location_id AS "locationId" FROM location_aliases`,
      sql`SELECT * FROM job_locations ORDER BY job_id, position`,
    ],
    { isolationLevel: "RepeatableRead", readOnly: true },
  );
  return { companies, jobs, places, aliases, links };
}

async function main() {
  const before = await snapshot();
  const catalog = new LocationCatalog(
    before.places as CanonicalLocation[],
    before.aliases as { alias: string; locationId: string }[],
  );
  const companyInputs = before.companies.map((c) => {
    const sourceLabel = c.profile.location.sourceLabel ?? c.location;
    const place = catalog.place(sourceLabel, c.country_code);
    if (!place) catalog.unresolved.add(`Company ${c.slug}: ${c.location}`);
    const location = place?.displayLabel ?? c.location;
    return {
      id: c.id,
      hash: c.hash,
      location,
      location_id: place?.id ?? null,
      profile_location: {
        ...c.profile.location,
        label: location,
        locationId: place?.id ?? null,
        sourceLabel,
      },
      job_locations: c.profile.jobs
        .map(
          (j: {
            location: string;
            workplaceType?: string;
            locations?: LocationReference[];
          }) => catalog.job(j, { inferRemoteEligibility: c.slug !== "cursor" }),
        )
        .map((j: { location: string; locations: LocationReference[] }) => ({
          location: j.location,
          locations: j.locations,
        })),
    };
  });
  const jobInputs = before.jobs.map((j) => {
    const c = before.companies.find((c) => c.id === j.company_id)!;
    // Source comes from the existing links on repeats, preserving qualifiers.
    const refs = before.links
      .filter((l) => l.job_id === j.id)
      .map((l) => ({
        locationId: l.location_id,
        label: l.label,
        relation: l.relation,
        qualifier: l.qualifier,
        sourceLabel: l.source_label,
      })) as LocationReference[];
    const next = catalog.job(
      {
        location: j.location,
        workplaceType: j.workplace_type,
        locations: refs,
      },
      { inferRemoteEligibility: c.slug !== "cursor" },
    );
    const oldPrefix = `${c.name} ${j.title} ${j.location}`;
    assert.ok(
      j.prefix_ok,
      `Unexpected search text prefix: ${j.id}; cannot safely rewrite`,
    );
    return {
      id: j.id,
      hash: j.hash,
      location: next.location,
      prefix_length: [...oldPrefix].length,
      prefix: `${c.name} ${j.title} ${next.location}`,
      refs: next.locations,
    };
  });
  catalog.seedVerifiedAliases();
  const companiesToChange = companyInputs.filter((input) => {
    const company = before.companies.find((c) => c.id === input.id)!;
    return (
      company.location !== input.location ||
      company.headquarters_location_id !== input.location_id ||
      !isDeepStrictEqual(company.profile.location, input.profile_location) ||
      company.profile.jobs.some(
        (
          job: { location: string; locations?: LocationReference[] },
          i: number,
        ) =>
          job.location !== input.job_locations[i].location ||
          !isDeepStrictEqual(job.locations, input.job_locations[i].locations),
      )
    );
  }).length;
  const jobsToChange = jobInputs.filter((input) => {
    const row = before.jobs.find((j) => j.id === input.id)!;
    const links = before.links.filter((l) => l.job_id === input.id);
    return (
      row.location !== input.location ||
      links.length !== input.refs.length ||
      input.refs.some((ref, i) => {
        const link = links.find((l) => l.position === i);
        return (
          !link ||
          link.location_id !== ref.locationId ||
          link.label !== ref.label ||
          link.relation !== ref.relation ||
          link.qualifier !== ref.qualifier ||
          link.source_label !== ref.sourceLabel
        );
      })
    );
  }).length;
  const aliasesToAdd = [...catalog.aliases].filter(
    ([alias]) => !before.aliases.some((a) => a.alias === alias),
  ).length;
  const summary = {
    companies: before.companies.length,
    jobs: before.jobs.length,
    canonicalPlaces: catalog.places.size,
    companiesToChange,
    jobsToChange,
    aliasesToAdd,
    aliases: catalog.aliases.size,
    links: jobInputs.reduce((n, j) => n + j.refs.length, 0),
    unresolved: [...catalog.unresolved].sort(),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (option("--report"))
    await writeFile(
      option("--report")!,
      JSON.stringify(
        { summary, places: [...catalog.places.values()] },
        null,
        2,
      ),
    );
  if (!apply) return;
  if (!companiesToChange && !jobsToChange && !aliasesToAdd) {
    console.log("Already migrated; no writes needed.");
    return;
  }
  const backup = option("--backup");
  assert.ok(
    backup && backup.startsWith("/"),
    "--apply requires a new absolute --backup path",
  );
  // Full job rows are fetched in bounded chunks to stay below Neon's 64MB HTTP
  // response cap. Fingerprints ensure this backup belongs to our snapshot.
  const fullJobs = [];
  for (let offset = 0; offset < before.jobs.length; offset += 200) {
    const ids = before.jobs.slice(offset, offset + 200).map((j) => j.id);
    const rows =
      await sql`SELECT *,md5(to_jsonb(j)::text) AS hash FROM jobs j WHERE id=ANY(${ids}::uuid[])`;
    for (const row of rows)
      assert.equal(
        row.hash,
        before.jobs.find((j) => j.id === row.id)!.hash,
        "Concurrent edit during backup",
      );
    assert.equal(rows.length, ids.length, "Job removed during backup");
    fullJobs.push(...rows);
  }
  await writeFile(backup, JSON.stringify({ ...before, jobs: fullJobs }), {
    flag: "wx",
    mode: 0o600,
  });
  const payload = JSON.stringify({
    companies: companyInputs,
    jobs: jobInputs,
    places: [...catalog.places.values()],
    aliases: [...catalog.aliases].map(([alias, locationId]) => ({
      alias,
      locationId,
    })),
  });
  // One atomic statement: snapshot conflicts abort the whole statement, including
  // catalog inserts. No job IDs, embeddings, descriptions or people are replaced.
  const [result] = await sql`WITH
    input AS (SELECT ${payload}::jsonb AS data),
    ci AS (SELECT x.* FROM input, jsonb_to_recordset(data->'companies') AS x(id uuid, hash text, location text, location_id uuid, profile_location jsonb, job_locations jsonb)),
    ji AS (SELECT x.* FROM input, jsonb_to_recordset(data->'jobs') AS x(id uuid, hash text, location text, prefix_length int,prefix text, refs jsonb)),
    locked_c AS MATERIALIZED (SELECT c.id FROM companies c JOIN ci ON c.id=ci.id WHERE md5(c.profile::text)=ci.hash FOR UPDATE OF c),
    locked_j AS MATERIALIZED (SELECT j.id FROM jobs j JOIN ji ON j.id=ji.id WHERE md5(to_jsonb(j)::text)=ji.hash FOR UPDATE OF j),
    guard AS MATERIALIZED (SELECT 1 / CASE WHEN (SELECT count(*) FROM locked_c)=${before.companies.length}
      AND (SELECT count(*) FROM locked_j)=${before.jobs.length}
      AND (SELECT count(*) FROM companies)=${before.companies.length}
      AND (SELECT count(*) FROM jobs)=${before.jobs.length} THEN 1 ELSE 0 END AS ok),
    inserted_places AS (INSERT INTO locations(id,identity_key,name,display_label,kind,country_code,subdivision_code)
      SELECT x.id,x."identityKey",x.name,x."displayLabel",x.kind,x."countryCode",x."subdivisionCode"
      FROM input,guard,jsonb_to_recordset(data->'places') AS x(id uuid,"identityKey" text,name text,"displayLabel" text,kind text,"countryCode" text,"subdivisionCode" text)
      WHERE guard.ok=1 ON CONFLICT(id) DO NOTHING RETURNING id),
    inserted_aliases AS (INSERT INTO location_aliases(alias,location_id)
      SELECT x.alias,x."locationId" FROM input,guard,jsonb_to_recordset(data->'aliases') AS x(alias text,"locationId" uuid)
      WHERE guard.ok=1 AND (SELECT count(*) FROM inserted_places)>=0 ON CONFLICT(alias) DO NOTHING RETURNING alias),
    updated_c AS (UPDATE companies c SET location=ci.location, headquarters_location_id=ci.location_id,
      profile=jsonb_set(jsonb_set(c.profile,'{location}',ci.profile_location),'{jobs}',
        (SELECT coalesce(jsonb_agg(entry || (ci.job_locations->(ordinality::int-1)) ORDER BY ordinality),'[]'::jsonb)
         FROM jsonb_array_elements(c.profile->'jobs') WITH ORDINALITY AS e(entry,ordinality))), updated_at=now()
      FROM ci,guard WHERE c.id=ci.id AND guard.ok=1 AND (SELECT count(*) FROM inserted_places)>=0 RETURNING c.id),
    updated_j AS (UPDATE jobs j SET location=ji.location, search_text=ji.prefix || substring(j.search_text FROM ji.prefix_length+1),updated_at=now()
      FROM ji,guard WHERE j.id=ji.id AND guard.ok=1 RETURNING j.id),
    written_links AS (INSERT INTO job_locations(job_id,position,location_id,relation,qualifier,source_label,label)
      SELECT ji.id,(ordinality-1)::int,(entry->>'locationId')::uuid,entry->>'relation',entry->>'qualifier',entry->>'sourceLabel',entry->>'label'
      FROM ji,guard,jsonb_array_elements(ji.refs) WITH ORDINALITY AS r(entry,ordinality)
      WHERE guard.ok=1 AND (SELECT count(*) FROM inserted_places)>=0
      ON CONFLICT(job_id,position) DO UPDATE SET location_id=excluded.location_id,relation=excluded.relation,qualifier=excluded.qualifier,source_label=excluded.source_label,label=excluded.label RETURNING job_id)
    SELECT (SELECT count(*) FROM updated_c)::int AS companies,(SELECT count(*) FROM updated_j)::int AS jobs,(SELECT count(*) FROM written_links)::int AS links`;
  assert.equal(result.companies, before.companies.length);
  assert.equal(result.jobs, before.jobs.length);
  const after = await snapshot();
  assert.equal(after.jobs.length, before.jobs.length);
  assert.equal(after.companies.length, before.companies.length);
  for (const j of before.jobs) {
    const actual = after.jobs.find((r) => r.id === j.id)!;
    const expected = jobInputs.find((r) => r.id === j.id)!;
    assert.equal(
      actual.other_hash,
      j.other_hash,
      `${j.id}: non-location fields changed`,
    );
    assert.equal(actual.location, expected.location);
    assert.ok(actual.prefix_ok, `${j.id}: search text prefix drift`);
    const links = after.links.filter((l) => l.job_id === j.id);
    assert.equal(links.length, expected.refs.length);
    for (let position = 0; position < links.length; position++) {
      const link = links.find((l) => l.position === position)!;
      const ref = expected.refs[position];
      assert.deepEqual(
        [
          link.location_id,
          link.label,
          link.relation,
          link.qualifier,
          link.source_label,
        ],
        [
          ref.locationId,
          ref.label,
          ref.relation,
          ref.qualifier,
          ref.sourceLabel,
        ],
      );
    }
  }
  for (const c of before.companies) {
    const actual = after.companies.find((r) => r.id === c.id)!;
    const expected = companyInputs.find((r) => r.id === c.id)!;
    assert.equal(actual.location, expected.location);
    assert.equal(actual.headquarters_location_id, expected.location_id);
    assert.deepEqual(actual.profile.location, expected.profile_location);
    assert.equal(actual.profile.jobs.length, c.profile.jobs.length);
    for (let i = 0; i < c.profile.jobs.length; i++) {
      const { location: _old, locations: _refs, ...oldJob } = c.profile.jobs[i];
      const { location, locations, ...newJob } = actual.profile.jobs[i];
      assert.deepEqual(newJob, oldJob);
      assert.deepEqual({ location, locations }, expected.job_locations[i]);
    }
    const { location: _loc, jobs: _jobs, ...oldProfile } = c.profile;
    const { location: _newLoc, jobs: _newJobs, ...newProfile } = actual.profile;
    assert.deepEqual(newProfile, oldProfile);
  }
  console.log(
    "Verified every profile, row, and link; non-location data and IDs preserved.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
