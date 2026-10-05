import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import {
  LocationCatalog,
  resolveSourcePlace,
  type CanonicalLocation,
} from "./lib/location-catalog";
import {
  locationReferencesDisplay,
  type LocationReference,
} from "../lib/location-reference";
import { parseCompanyProfile } from "../lib/company-profile";

const sql = neon(process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL!);
const option = (key: string) => {
  const i = process.argv.indexOf(key);
  return i < 0 ? undefined : process.argv[i + 1];
};
const apply = process.argv.includes("--apply");

async function snapshot() {
  const [companies, jobs, links, places, aliases, others] =
    await sql.transaction(
      [
        sql`SELECT *,md5(profile::text) AS hash FROM companies WHERE slug='cursor'`,
        sql`SELECT j.*,md5(to_jsonb(j)::text) AS hash FROM jobs j JOIN companies c ON c.id=j.company_id WHERE c.slug='cursor' ORDER BY j.id`,
        sql`SELECT jl.* FROM job_locations jl JOIN jobs j ON j.id=jl.job_id JOIN companies c ON c.id=j.company_id WHERE c.slug='cursor' ORDER BY jl.job_id,jl.position`,
        sql`SELECT id,identity_key AS "identityKey",name,display_label AS "displayLabel",kind,country_code AS "countryCode",subdivision_code AS "subdivisionCode" FROM locations`,
        sql`SELECT alias,location_id AS "locationId" FROM location_aliases`,
        sql`SELECT
      (SELECT md5(string_agg(md5(to_jsonb(c)::text),',' ORDER BY c.id)) FROM companies c WHERE slug<>'cursor') AS companies_hash,
      (SELECT md5(string_agg(md5(to_jsonb(j)::text),',' ORDER BY j.id)) FROM jobs j JOIN companies c ON c.id=j.company_id WHERE c.slug<>'cursor') AS jobs_hash,
      (SELECT md5(string_agg(md5(to_jsonb(jl)::text),',' ORDER BY jl.job_id,jl.position)) FROM job_locations jl JOIN jobs j ON j.id=jl.job_id JOIN companies c ON c.id=j.company_id WHERE c.slug<>'cursor') AS links_hash`,
      ],
      { isolationLevel: "RepeatableRead", readOnly: true },
    );
  assert.equal(companies.length, 1);
  return {
    company: companies[0],
    jobs,
    links,
    places,
    aliases,
    others: others[0],
  };
}

async function main() {
  const sourcePath = option("--sources");
  assert.ok(
    sourcePath,
    "--sources must point to verified individual Cursor posting reads",
  );
  const sources = JSON.parse(await readFile(sourcePath, "utf8")) as {
    url: string;
    headerLocation: string;
    page: { url: string; markdown?: string; error?: string };
  }[];
  const reviewed = new Map<string, string>();
  const auditPath = option("--audit");
  const audit = auditPath
    ? (JSON.parse(await readFile(auditPath, "utf8")) as {
        roles: {
          url: string;
          header: string;
          location: string;
          workplaceType: "remote" | "onsite" | "hybrid" | null;
          bodySha256: string;
          evidence: string;
          note?: string;
        }[];
      })
    : null;
  const workplaces = new Map<string, "remote" | "onsite" | "hybrid" | null>();
  if (audit) {
    const pages = sources as unknown as {
      url: string;
      markdown: string;
      error?: string;
    }[];
    assert.equal(new Set(pages.map((p) => p.url)).size, pages.length);
    assert.equal(pages.length, audit.roles.length);
    for (const role of audit.roles) {
      const page = pages.find((p) => p.url === role.url);
      assert.ok(page?.markdown && !page.error, role.url);
      const body = page.markdown.split("## Apply for this role")[0];
      assert.equal(
        createHash("sha256").update(body).digest("hex"),
        role.bodySha256,
        role.url,
      );
      assert.equal(
        body.match(/·\s*Full-time\s*·\s*([^\n]+)/)?.[1].trim(),
        role.header,
      );
      assert.ok(body.includes(role.evidence), role.url);
      reviewed.set(role.url, role.location);
      workplaces.set(role.url, role.workplaceType);
    }
  } else
    for (const source of sources) {
      assert.ok(
        !source.page.error && source.page.markdown,
        `Source failed: ${source.url}`,
      );
      assert.equal(source.page.url, source.url);
      const actual = source.page.markdown
        .match(/·\s*Full-time\s*·\s*([^\n]+)/)?.[1]
        .trim();
      assert.equal(
        actual,
        source.headerLocation,
        `Board/detail disagreement: ${source.url}`,
      );
      assert.ok(
        actual!
          .split(";")
          .map((p) => p.trim())
          .includes("Remote"),
      );
      reviewed.set(
        source.url,
        actual!
          .split(";")
          .map((p) => p.trim())
          .join(" | "),
      );
    }
  const before = await snapshot();
  if (audit) {
    assert.equal(reviewed.size, before.jobs.length);
    for (const job of before.jobs)
      assert.ok(reviewed.has(job.url), `Unreviewed job: ${job.url}`);
  }
  const catalog = new LocationCatalog(
    before.places as CanonicalLocation[],
    before.aliases as { alias: string; locationId: string }[],
  );
  const changes = before.jobs.flatMap((job) => {
    const current = before.links
      .filter((l) => l.job_id === job.id)
      .map((l) => ({
        locationId: l.location_id,
        label: l.label,
        relation: l.relation,
        qualifier: l.qualifier,
        sourceLabel: l.source_label,
      })) as LocationReference[];
    assert.ok(current.length, `Missing structured references: ${job.id}`);
    const header = reviewed.get(job.url);
    const workplaceType = workplaces.has(job.url)
      ? workplaces.get(job.url)!
      : job.workplace_type;
    const refs = header
      ? catalog.references(header, workplaceType, {
          inferRemoteEligibility: false,
        })
      : current.map((ref) => {
          const old = ref.locationId
            ? catalog.places.get(ref.locationId)
            : null;
          const candidate = resolveSourcePlace(ref.sourceLabel);
          if (old?.kind === "subdivision" && candidate?.kind === "city") {
            catalog.places.set(candidate.id, candidate);
            return {
              ...ref,
              locationId: candidate.id,
              label: candidate.displayLabel,
            };
          }
          return ref;
        });
    const location = locationReferencesDisplay(refs);
    if (
      location === job.location &&
      workplaceType === job.workplace_type &&
      isDeepStrictEqual(refs, current)
    )
      return [];
    const oldPrefix = `${before.company.name} ${job.title} ${job.location}`;
    assert.ok(
      job.search_text.startsWith(oldPrefix),
      `Cannot safely rewrite search prefix: ${job.id}`,
    );
    const profileJob = before.company.profile.jobs.find(
      (p: { url: string }) => p.url === job.url,
    );
    assert.ok(profileJob, job.url);
    const searchText = audit
      ? [
          before.company.name,
          job.title,
          location,
          profileJob.focus,
          profileJob.department,
          workplaceType,
          profileJob.employmentType,
          profileJob.experience?.level,
          profileJob.description,
          ...(profileJob.skills ?? []),
        ]
          .filter(Boolean)
          .join(" ")
      : `${before.company.name} ${job.title} ${location}` +
        job.search_text.slice(oldPrefix.length);
    return [
      {
        id: job.id,
        url: job.url,
        title: job.title,
        hash: job.hash,
        location,
        refs,
        workplaceType,
        searchText,
        oldWorkplaceType: job.workplace_type,
        oldLocation: job.location,
        prefix_length: [...oldPrefix].length,
        prefix: `${before.company.name} ${job.title} ${location}`,
        sourceUrl: header ? job.url : null,
      },
    ];
  });
  const nextProfile = structuredClone(before.company.profile);
  for (const change of changes) {
    const matches = nextProfile.jobs.filter(
      (job: { url: string; title: string }) =>
        job.url === change.url && job.title === change.title,
    );
    assert.equal(matches.length, 1, `Ambiguous profile job: ${change.url}`);
    matches[0].location = change.location;
    matches[0].locations = change.refs;
    matches[0].workplaceType = change.workplaceType;
  }
  parseCompanyProfile(nextProfile);
  const syncFile = async () => {
    const path = option("--profile-file");
    if (!path) return;
    assert.ok(audit, "File synchronization requires a complete audit");
    const file = JSON.parse(await readFile(path, "utf8"));
    assert.equal(file.slug, "cursor");
    // The repository's older ATS export can have different URLs and cardinality.
    // Use the verified live jobs snapshot, never match ambiguous duplicate titles.
    // All non-job company fields remain untouched.
    file.jobs = structuredClone(nextProfile.jobs);
    parseCompanyProfile(file);
    await writeFile(path, JSON.stringify(file, null, 2) + "\n");
    const verificationReport = option("--verification-report");
    if (verificationReport) {
      const escape = (text: string) =>
        text.replace(/\|/g, " · ").replace(/\n/g, " ");
      const rows = nextProfile.jobs.map(
        (job: {
          url: string;
          title: string;
          location: string;
          workplaceType: string | null;
        }) => {
          const role = audit!.roles.find((r) => r.url === job.url)!;
          return `| [${escape(job.title)}](${job.url}) | ${escape(job.location)} | ${job.workplaceType ?? "Not specified"} | ${escape(role.evidence)} | ${escape(role.note ?? "")} |`;
        },
      );
      await writeFile(
        verificationReport,
        `# Cursor: verified locations for every role\n\nVerified ${nextProfile.jobs.length} individual Ketch source reads against live PostgreSQL job rows, embedded profile and structured references. Explicit body requirements take precedence over contradictory headers. Not specified means the source does not establish an onsite/hybrid/remote schedule; it does not mean remote.\n\n| Role / source | Canonical locations | Workplace | Evidence | Notes |\n| --- | --- | --- | --- | --- |\n${rows.join("\n")}\n`,
      );
    }
  };
  const summary = {
    company: "cursor",
    jobsAudited: before.jobs.length,
    individualSources: reviewed.size,
    jobsToChange: changes.length,
    alternatives: changes
      .filter((c) => c.sourceUrl)
      .map((c) => ({
        title: c.title,
        before: c.oldLocation,
        after: c.location,
        oldWorkplaceType: c.oldWorkplaceType,
        workplaceType: c.workplaceType,
        sourceUrl: c.sourceUrl,
      })),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (option("--report"))
    await writeFile(option("--report")!, JSON.stringify(summary, null, 2));
  if (!apply) return;
  if (!changes.length) {
    await syncFile();
    return;
  }
  const backup = option("--backup");
  assert.ok(
    backup && backup.startsWith("/"),
    "Apply requires a new absolute backup path",
  );
  await writeFile(backup, JSON.stringify(before), { flag: "wx", mode: 0o600 });
  const newPlaces = [...catalog.places.values()].filter(
    (p) => !before.places.some((old) => old.id === p.id),
  );
  const payload = JSON.stringify({ changes, newPlaces });
  const [result] = await sql`WITH
    input AS (SELECT ${payload}::jsonb AS data),
    ji AS (SELECT x.* FROM input,jsonb_to_recordset(data->'changes') AS x(id uuid,hash text,location text,refs jsonb,"workplaceType" text,"searchText" text)),
    locked_c AS MATERIALIZED (SELECT id FROM companies WHERE id=${before.company.id}::uuid AND md5(profile::text)=${before.company.hash} FOR UPDATE),
    locked_j AS MATERIALIZED (SELECT j.id FROM jobs j JOIN ji ON ji.id=j.id WHERE j.company_id=${before.company.id}::uuid AND md5(to_jsonb(j)::text)=ji.hash FOR UPDATE OF j),
    guard AS MATERIALIZED (SELECT 1/CASE WHEN (SELECT count(*) FROM locked_c)=1 AND (SELECT count(*) FROM locked_j)=${changes.length} THEN 1 ELSE 0 END AS ok),
    places_added AS (INSERT INTO locations(id,identity_key,name,display_label,kind,country_code,subdivision_code)
      SELECT p.id,p."identityKey",p.name,p."displayLabel",p.kind,p."countryCode",p."subdivisionCode" FROM input,guard,jsonb_to_recordset(data->'newPlaces') AS p(id uuid,"identityKey" text,name text,"displayLabel" text,kind text,"countryCode" text,"subdivisionCode" text)
      WHERE guard.ok=1 ON CONFLICT(id) DO NOTHING RETURNING id),
    updated_c AS (UPDATE companies SET profile=${JSON.stringify(nextProfile)}::jsonb,updated_at=now() FROM guard WHERE id=${before.company.id}::uuid AND guard.ok=1 RETURNING id),
    updated_j AS (UPDATE jobs j SET location=ji.location,workplace_type=ji."workplaceType",search_text=ji."searchText",updated_at=now() FROM ji,guard WHERE j.id=ji.id AND guard.ok=1 RETURNING j.id),
    removed_links AS (DELETE FROM job_locations jl USING ji,guard WHERE jl.job_id=ji.id AND jl.position>=jsonb_array_length(ji.refs) AND guard.ok=1 RETURNING job_id),
    updated_links AS (INSERT INTO job_locations(job_id,position,location_id,label,relation,qualifier,source_label)
      SELECT ji.id,(ordinality-1)::int,(ref->>'locationId')::uuid,ref->>'label',ref->>'relation',ref->>'qualifier',ref->>'sourceLabel'
      FROM ji,guard,jsonb_array_elements(ji.refs) WITH ORDINALITY AS entries(ref,ordinality) WHERE guard.ok=1 AND (SELECT count(*) FROM places_added)>=0
      ON CONFLICT(job_id,position) DO UPDATE SET location_id=excluded.location_id,label=excluded.label,relation=excluded.relation,qualifier=excluded.qualifier,source_label=excluded.source_label RETURNING job_id)
    SELECT (SELECT count(*) FROM updated_c)::int AS companies,(SELECT count(*) FROM updated_j)::int AS jobs,(SELECT count(*) FROM updated_links)::int AS links`;
  assert.equal(result.companies, 1);
  assert.equal(result.jobs, changes.length);
  const after = await snapshot();
  assert.deepEqual(
    after.others,
    before.others,
    "Non-Cursor records changed during this repair",
  );
  assert.equal(after.jobs.length, before.jobs.length);
  assert.deepEqual(after.company.profile, nextProfile);
  for (const old of before.jobs) {
    const actual = after.jobs.find((j) => j.id === old.id)!;
    const change = changes.find((c) => c.id === old.id);
    if (!change) {
      assert.deepEqual(actual, old);
      continue;
    }
    for (const key of Object.keys(old).filter(
      (k) =>
        ![
          "hash",
          "location",
          "workplace_type",
          "search_text",
          "updated_at",
        ].includes(k),
    ))
      assert.deepEqual(actual[key], old[key], `${old.id}.${key}`);
    assert.equal(actual.location, change.location);
    assert.equal(actual.workplace_type, change.workplaceType);
    assert.equal(actual.search_text, change.searchText);
    const links = after.links.filter((l) => l.job_id === old.id);
    assert.equal(links.length, change.refs.length);
    for (let position = 0; position < links.length; position++) {
      const link = links.find((l) => l.position === position)!;
      const ref: LocationReference = change.refs[position];
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
  await syncFile();
  console.log(
    "Verified Cursor profile, every changed row/link, and unchanged jobs; IDs and all non-location data preserved.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
