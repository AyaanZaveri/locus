import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { parseCompanyProfile } from "../lib/company-profile";
import {
  locationReferencesDisplay,
  type LocationReference,
} from "../lib/location-reference";
import {
  LocationCatalog,
  type CanonicalLocation,
} from "./lib/location-catalog";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

type Workplace = "remote" | "hybrid" | "onsite" | "flexible" | null;
type RoleAudit = {
  url: string;
  title?: string;
  sourceUrl: string;
  location: string;
  workplaceType: Workplace;
  evidence: string[];
  note?: string;
  sourceSha256: string;
  unavailable?: boolean;
  qualifier?: string;
  additionalEvidence?: {
    sourceUrl: string;
    sourceSha256: string;
    evidence: string[];
  }[];
};
const option = (name: string) => {
  const i = process.argv.indexOf(name);
  if (i < 0) return undefined;
  const value = process.argv[i + 1];
  assert.ok(value && !value.startsWith("--"), `Missing value for ${name}`);
  return value;
};
const sql = neon(process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL!);
const apply = process.argv.includes("--apply");

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
async function snapshot(slug: string) {
  const [companies, jobs, links, places, aliases, outside, linkHashes] =
    await sql.transaction(
      [
        sql`SELECT c.*,md5(c.profile::text) AS profile_hash FROM companies c WHERE c.slug=${slug}`,
        sql`SELECT j.*,md5(to_jsonb(j)::text) AS row_hash FROM jobs j JOIN companies c ON c.id=j.company_id WHERE c.slug=${slug} ORDER BY j.id`,
        sql`SELECT jl.* FROM job_locations jl JOIN jobs j ON j.id=jl.job_id JOIN companies c ON c.id=j.company_id WHERE c.slug=${slug} ORDER BY jl.job_id,jl.position`,
        sql`SELECT id,identity_key AS "identityKey",name,display_label AS "displayLabel",kind,country_code AS "countryCode",subdivision_code AS "subdivisionCode" FROM locations`,
        sql`SELECT alias,location_id AS "locationId" FROM location_aliases`,
        sql`SELECT
      (SELECT md5(string_agg(md5(to_jsonb(c)::text),',' ORDER BY c.id)) FROM companies c WHERE c.slug<>${slug}) companies,
      (SELECT md5(string_agg(md5(to_jsonb(j)::text),',' ORDER BY j.id)) FROM jobs j JOIN companies c ON c.id=j.company_id WHERE c.slug<>${slug}) jobs,
      (SELECT md5(string_agg(md5(to_jsonb(l)::text),',' ORDER BY l.job_id,l.position)) FROM job_locations l JOIN jobs j ON j.id=l.job_id JOIN companies c ON c.id=j.company_id WHERE c.slug<>${slug}) links,
      (SELECT md5(string_agg(md5(to_jsonb(p)::text),',' ORDER BY p.id)) FROM locations p) places,
      (SELECT md5(string_agg(md5(to_jsonb(a)::text),',' ORDER BY a.alias)) FROM location_aliases a) aliases`,
        sql`SELECT md5(string_agg(md5(to_jsonb(l)::text),',' ORDER BY l.job_id,l.position)) AS hash FROM job_locations l JOIN jobs j ON j.id=l.job_id WHERE j.company_id=(SELECT id FROM companies WHERE slug=${slug})`,
      ],
      { isolationLevel: "RepeatableRead", readOnly: true },
    );
  assert.equal(companies.length, 1, `Expected exactly one company for ${slug}`);
  return {
    company: companies[0],
    jobs,
    links,
    places,
    aliases,
    outside: outside[0],
    linkHash: linkHashes[0].hash,
  };
}

async function main() {
  const auditPath = option("--audit");
  const sourcePath = option("--sources");
  assert.ok(
    auditPath && sourcePath,
    "Usage: --audit /abs/audit.json --sources /abs/pages.json [--report path] [--apply --backup /abs/new.json] [--ledger path]",
  );
  const audit = JSON.parse(await readFile(auditPath!, "utf8")) as {
    companySlug: string;
    verifiedAt: string;
    roles: RoleAudit[];
  };
  assert.ok(
    audit.companySlug && Array.isArray(audit.roles) && audit.roles.length,
    "Invalid audit format",
  );
  const sources = JSON.parse(await readFile(sourcePath!, "utf8")) as {
    url: string;
    markdown?: string;
    error?: string;
  }[];
  assert.ok(Array.isArray(sources));
  assert.equal(
    new Set(sources.map((p) => p.url)).size,
    sources.length,
    "Duplicate source page URLs",
  );
  const pageMap = new Map(sources.map((p) => [p.url, p]));
  // Stored postings can share one application URL (e.g. Beltic's single
  // Typeform for two roles). Then roles must carry titles and match jobs by
  // URL and title instead of URL alone.
  const keyOf = (entry: { url: string; title?: string }) =>
    `${entry.url}||${entry.title ?? ""}`;
  const duplicateRoleUrls =
    new Set(audit.roles.map((r) => r.url)).size !== audit.roles.length;
  if (duplicateRoleUrls) {
    for (const role of audit.roles)
      assert.ok(
        role.title,
        `Duplicate-URL audit role needs a title: ${role.url}`,
      );
    assert.equal(
      new Set(audit.roles.map(keyOf)).size,
      audit.roles.length,
      "Duplicate audited job URL+title pairs",
    );
  } else {
    assert.equal(
      new Set(audit.roles.map((r) => r.url)).size,
      audit.roles.length,
      "Duplicate audited job URLs",
    );
  }
  const before = await snapshot(audit.companySlug);
  const company = before.company as any;
  const jobs = before.jobs as any[];
  const duplicateStoredUrls =
    duplicateRoleUrls || new Set(jobs.map((j) => j.url)).size !== jobs.length;
  if (!duplicateStoredUrls) {
    assert.equal(
      new Set(jobs.map((j) => j.url)).size,
      jobs.length,
      "Ambiguous duplicate stored job URLs",
    );
  } else {
    assert.equal(
      new Set(jobs.map(keyOf)).size,
      jobs.length,
      "Ambiguous duplicate stored job URL+title pairs",
    );
  }
  assert.equal(
    audit.roles.length,
    jobs.length,
    "Audit must cover every company job",
  );
  const rolesByUrl = new Map(audit.roles.map((r) => [r.url, r]));
  const rolesByKey = new Map(audit.roles.map((r) => [keyOf(r), r]));
  const roleFor = (job: any) =>
    duplicateStoredUrls ? rolesByKey.get(keyOf(job)) : rolesByUrl.get(job.url);
  const unavailable = audit.roles.filter((role) => role.unavailable);
  assert.ok(
    !unavailable.length || process.argv.includes("--allow-unavailable"),
    "Unavailable postings require --allow-unavailable; these jobs will remain unchanged and the audit will be reported incomplete.",
  );
  for (const job of jobs)
    assert.ok(roleFor(job), `Unreviewed stored job ${job.url} ${job.title}`);
  for (const role of audit.roles) {
    assert.ok(
      role.url &&
        role.sourceUrl &&
        role.location &&
        Array.isArray(role.evidence) &&
        role.evidence.length > 0,
      `Incomplete review ${role.url}`,
    );
    assert.ok(
      ["remote", "hybrid", "onsite", "flexible", null].includes(
        role.workplaceType,
      ),
      `Invalid workplace type ${role.url}`,
    );
    assert.ok(
      /^[a-f0-9]{64}$/i.test(role.sourceSha256),
      `Invalid full-page SHA-256 ${role.url}`,
    );
    const page = pageMap.get(role.sourceUrl);
    if (role.unavailable && (page as any)?.kind === "http-status-capture") {
      assert.equal(
        (page as any).httpStatus,
        410,
        `Status capture is not Gone: ${role.sourceUrl}`,
      );
      assert.equal(role.sourceUrl, (page as any).url);
      continue;
    }
    assert.ok(
      page && !page.error && typeof page.markdown === "string",
      `Missing/failed source page ${role.sourceUrl}`,
    );
    assert.equal(
      hash(page.markdown!),
      role.sourceSha256.toLowerCase(),
      `Source content hash mismatch: ${role.sourceUrl}`,
    );
    if (!role.unavailable) {
      assert.ok(
        page.markdown!.length < 30000 &&
          !/\[truncated\]|\[output truncated\]/i.test(page.markdown!),
        `Possibly truncated posting: ${role.sourceUrl}`,
      );
      assert.ok(
        !/^##? (Page|Job) not found\b/im.test(page.markdown!),
        `Unavailable source is not a reviewed posting: ${role.sourceUrl}`,
      );
    }
    for (const quote of role.evidence)
      assert.ok(
        quote.length > 0 && page.markdown!.includes(quote),
        `Evidence not found verbatim on ${role.sourceUrl}: ${quote}`,
      );
    for (const extra of role.additionalEvidence ?? []) {
      const page = pageMap.get(extra.sourceUrl);
      assert.ok(page?.markdown && !page.error, extra.sourceUrl);
      assert.equal(hash(page.markdown), extra.sourceSha256, extra.sourceUrl);
      for (const quote of extra.evidence)
        assert.ok(
          page.markdown.includes(quote),
          `Missing corroborating evidence: ${extra.sourceUrl}`,
        );
    }
  }
  const catalog = new LocationCatalog(
    before.places as CanonicalLocation[],
    before.aliases as { alias: string; locationId: string }[],
  );
  const plans = jobs.map((job) => {
    const role = roleFor(job)!;
    let refs = catalog.references(role.location, role.workplaceType, {
      inferRemoteEligibility: false,
    });
    if (role.qualifier)
      refs = refs.map((ref) => ({ ...ref, qualifier: role.qualifier! }));
    assert.ok(refs.length, `No normalized references for ${job.url}`);
    let location = locationReferencesDisplay(refs);
    const profileMatches = company.profile.jobs.filter((p: any) =>
      duplicateStoredUrls
        ? p.url === job.url && p.title === job.title
        : p.url === job.url,
    );
    assert.equal(
      profileMatches.length,
      1,
      `Missing/ambiguous embedded profile job ${job.url}`,
    );
    const profileJob = profileMatches[0];
    const current = (before.links as any[])
      .filter((link) => link.job_id === job.id)
      .map((link) => ({
        locationId: link.location_id,
        label: link.label,
        relation: link.relation,
        qualifier: link.qualifier,
        sourceLabel: link.source_label,
      })) as LocationReference[];
    assert.ok(
      current.length,
      `Missing structured location references: ${job.url}`,
    );
    if (role.unavailable) {
      refs = current;
      location = job.location;
      return {
        job,
        role: {
          ...role,
          location: job.location,
          workplaceType: job.workplace_type,
        },
        refs,
        location,
        searchText: job.search_text,
        current,
        profileJob,
        changed: false,
      };
    }
    const searchText = [
      company.name,
      job.title,
      location,
      profileJob.focus,
      profileJob.department,
      role.workplaceType,
      profileJob.employmentType,
      profileJob.experience?.level,
      profileJob.description,
      ...(profileJob.skills ?? []),
    ]
      .filter(Boolean)
      .join(" ");
    const changed =
      location !== job.location ||
      role.workplaceType !== job.workplace_type ||
      !sameRefs(refs, current) ||
      searchText !== job.search_text ||
      profileJob.location !== location ||
      !sameRefs(profileJob.locations ?? [], refs) ||
      profileJob.workplaceType !== role.workplaceType;
    return {
      job,
      role,
      refs,
      location,
      searchText,
      current,
      profileJob,
      changed,
    };
  });
  function sameRefs(a: any[], b: any[]) {
    const project = (refs: any[]) =>
      refs.map((r) => [
        r.locationId ?? null,
        r.label,
        r.relation,
        r.qualifier ?? null,
        r.sourceLabel,
      ]);
    return JSON.stringify(project(a)) === JSON.stringify(project(b));
  }
  const nextProfile = structuredClone(company.profile);
  for (const p of plans) {
    if (p.role.unavailable) continue;
    const match = nextProfile.jobs.filter((j: any) =>
      duplicateStoredUrls
        ? j.url === p.job.url && j.title === p.job.title
        : j.url === p.job.url,
    );
    assert.equal(match.length, 1, `Ambiguous profile entry ${p.job.url}`);
    match[0].location = p.location;
    match[0].locations = p.refs;
    match[0].workplaceType = p.role.workplaceType;
  }
  parseCompanyProfile(nextProfile);
  const changed = plans.filter((p) => p.changed);
  const summary = {
    companySlug: audit.companySlug,
    verifiedAt: audit.verifiedAt,
    jobsInventoried: jobs.length,
    jobsAudited: jobs.length - unavailable.length,
    status: unavailable.length ? "incomplete" : "reviewed",
    unavailable: unavailable.map((role) => role.url),
    jobsToChange: changed.length,
    roles: plans.map((p) => ({
      url: p.job.url,
      sourceUrl: p.role.sourceUrl,
      locationReviewed: p.role.location,
      normalizedLocation: p.location,
      references: p.refs,
      before: p.job.location,
      after: p.location,
      workplaceBefore: p.job.workplace_type,
      workplaceAfter: p.role.workplaceType,
      referenceCountBefore: p.current.length,
      referenceCountAfter: p.refs.length,
      conflict:
        p.job.location !== p.location ||
        p.job.workplace_type !== p.role.workplaceType ||
        !sameRefs(p.current, p.refs),
      changed: p.changed,
      verified: !p.role.unavailable,
      evidence: p.role.evidence,
      note: p.role.note ?? null,
    })),
  };
  console.log(JSON.stringify(summary, null, 2));
  const reportPath = option("--report");
  if (reportPath)
    await writeFile(reportPath, JSON.stringify(summary, null, 2) + "\n", {
      flag: "w",
      mode: 0o600,
    });
  const ledgerPath = option("--ledger");
  if (ledgerPath) {
    const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
    const rows = summary.roles.map(
      (r) =>
        `| [${esc(r.url)}](${r.url}) | [source](${r.sourceUrl}) | ${esc(r.locationReviewed)} | ${esc(r.normalizedLocation)} | ${r.workplaceAfter ?? "Not specified"} | ${esc(r.evidence.join("; "))} | ${esc(r.note ?? "")} |`,
    );
    await writeFile(
      ledgerPath,
      `# Reviewed job locations: ${audit.companySlug}\n\nVerified ${audit.verifiedAt}. Each source was checked for exact page hash and verbatim evidence.\n\n| Job | Source | Reviewed location | Normalized location | Workplace | Evidence | Note |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows.join("\n")}\n`,
      { flag: "w", mode: 0o600 },
    );
  }
  const recordReview = async () => {
    const destination = option("--record-review");
    if (!destination) return;
    const saved = {
      companySlug: audit.companySlug,
      verifiedAt: audit.verifiedAt,
      unavailable: unavailable.map((role) => role.url),
      roles: plans
        .filter((plan) => !plan.role.unavailable)
        .map((plan) => ({ ...plan.role, locations: plan.refs })),
    };
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, JSON.stringify(saved, null, 2) + "\n");
  };
  if (!apply || !changed.length) {
    if (apply) await recordReview();
    if (apply) console.log("Already normalized; no writes or backup required.");
    return;
  }
  const backup = option("--backup");
  assert.ok(
    backup?.startsWith("/"),
    "Changed apply requires --backup /absolute/new-file.json",
  );
  await writeFile(
    backup!,
    JSON.stringify(
      { capturedAt: new Date().toISOString(), ...before },
      null,
      2,
    ),
    { flag: "wx", mode: 0o600 },
  );
  const newPlaces = [...catalog.places.values()].filter(
    (p) => !(before.places as any[]).some((old) => old.id === p.id),
  );
  const inputs = changed.map((p) => ({
    id: p.job.id,
    rowHash: p.job.row_hash,
    refs: p.refs,
    location: p.location,
    workplaceType: p.role.workplaceType,
    searchText: p.searchText,
  }));
  const payload = JSON.stringify({ inputs, newPlaces });
  const [result] = await sql`WITH input AS (SELECT ${payload}::jsonb data),
    ji AS (SELECT x.* FROM input,jsonb_to_recordset(data->'inputs') AS x(id uuid,"rowHash" text,refs jsonb,location text,"workplaceType" text,"searchText" text)),
    locked_c AS MATERIALIZED (SELECT c.id FROM companies c WHERE c.id=${company.id}::uuid AND md5(c.profile::text)=${company.profile_hash} FOR UPDATE),
    locked_j AS MATERIALIZED (SELECT j.id FROM jobs j JOIN ji ON ji.id=j.id WHERE j.company_id=${company.id}::uuid AND md5(to_jsonb(j)::text)=ji."rowHash" FOR UPDATE OF j),
    ready AS MATERIALIZED (SELECT (SELECT count(*) FROM locked_c)=1 AND (SELECT count(*) FROM locked_j)=${changed.length} AND (SELECT md5(string_agg(md5(to_jsonb(l)::text),',' ORDER BY l.job_id,l.position)) FROM job_locations l JOIN jobs j ON j.id=l.job_id WHERE j.company_id=${company.id}::uuid) IS NOT DISTINCT FROM ${before.linkHash}::text AS ok),
    added AS (INSERT INTO locations(id,identity_key,name,display_label,kind,country_code,subdivision_code)
      SELECT p.id,p."identityKey",p.name,p."displayLabel",p.kind,p."countryCode",p."subdivisionCode" FROM input,ready,jsonb_to_recordset(data->'newPlaces') AS p(id uuid,"identityKey" text,name text,"displayLabel" text,kind text,"countryCode" text,"subdivisionCode" text)
      WHERE ready.ok ON CONFLICT(id) DO NOTHING RETURNING id),
    uc AS (UPDATE companies SET profile=${JSON.stringify(nextProfile)}::jsonb,updated_at=now() FROM ready WHERE id=${company.id}::uuid AND ready.ok RETURNING id),
    uj AS (UPDATE jobs j SET location=ji.location,workplace_type=ji."workplaceType",search_text=ji."searchText",updated_at=now() FROM ji,ready WHERE j.id=ji.id AND ready.ok RETURNING j.id),
    removed AS (DELETE FROM job_locations l USING ji,ready WHERE l.job_id=ji.id AND l.position>=jsonb_array_length(ji.refs) AND ready.ok RETURNING l.job_id),
    upserted AS (INSERT INTO job_locations(job_id,position,location_id,label,relation,qualifier,source_label)
      SELECT ji.id,(ord-1)::int,(r->>'locationId')::uuid,r->>'label',r->>'relation',r->>'qualifier',r->>'sourceLabel'
      FROM ji,ready,jsonb_array_elements(ji.refs) WITH ORDINALITY e(r,ord) WHERE ready.ok AND (SELECT count(*) FROM added)>=0
      ON CONFLICT(job_id,position) DO UPDATE SET location_id=excluded.location_id,label=excluded.label,relation=excluded.relation,qualifier=excluded.qualifier,source_label=excluded.source_label RETURNING job_id)
    SELECT (SELECT ok FROM ready) ok,(SELECT count(*)::int FROM uc) companies,(SELECT count(*)::int FROM uj) jobs`;
  assert.ok(
    result.ok,
    "Concurrent company/job edit detected; no changes applied",
  );
  assert.equal(result.companies, 1);
  assert.equal(result.jobs, changed.length);
  const after = await snapshot(audit.companySlug);
  const withoutPlaces = ({ places, ...rest }: Record<string, unknown>) => rest;
  assert.deepEqual(
    withoutPlaces(after.outside),
    withoutPlaces(before.outside),
    "Outside-company or global alias content changed",
  );
  for (const old of before.places)
    assert.deepEqual(
      after.places.find((place) => place.id === old.id),
      old,
      "Existing shared place changed",
    );
  assert.equal(after.jobs.length, jobs.length);
  const actualCompany = after.company as any;
  assert.deepEqual(actualCompany.profile, nextProfile);
  for (const key of Object.keys(company).filter(
    (key) => !["profile_hash", "profile", "updated_at"].includes(key),
  ))
    assert.deepEqual(
      actualCompany[key],
      company[key],
      `Non-location company field changed: ${key}`,
    );
  for (const old of jobs) {
    const actual = (after.jobs as any[]).find((j) => j.id === old.id)!;
    const plan = plans.find((p) => p.job.id === old.id)!;
    if (!plan.changed) {
      assert.deepEqual(actual, old, `Untouched job changed: ${old.url}`);
      assert.deepEqual(
        after.links.filter((link) => link.job_id === old.id),
        before.links.filter((link) => link.job_id === old.id),
      );
      continue;
    }
    for (const key of Object.keys(old).filter(
      (k) =>
        ![
          "row_hash",
          "location",
          "workplace_type",
          "search_text",
          "updated_at",
        ].includes(k),
    ))
      assert.deepEqual(actual[key], old[key], `${old.id}.${key}`);
    assert.equal(actual.location, plan.location);
    assert.equal(actual.workplace_type, plan.role.workplaceType);
    assert.equal(actual.search_text, plan.searchText);
    const links = (after.links as any[])
      .filter((l) => l.job_id === old.id)
      .sort((a, b) => a.position - b.position);
    assert.equal(
      links.length,
      plan.refs.length,
      `Reference count mismatch ${old.url}`,
    );
    links.forEach((l, i) =>
      assert.deepEqual(
        [l.location_id, l.label, l.relation, l.qualifier, l.source_label],
        [
          plan.refs[i].locationId,
          plan.refs[i].label,
          plan.refs[i].relation,
          plan.refs[i].qualifier,
          plan.refs[i].sourceLabel,
        ],
        `Reference mismatch ${old.url}#${i}`,
      ),
    );
    const profile = actualCompany.profile.jobs.filter((j: any) =>
      duplicateStoredUrls
        ? j.url === old.url && j.title === old.title
        : j.url === old.url,
    );
    assert.equal(profile.length, 1);
    assert.equal(profile[0].location, plan.location);
    assert.equal(profile[0].workplaceType, plan.role.workplaceType);
    assert.ok(sameRefs(profile[0].locations, plan.refs));
  }
  console.log(
    `Applied and verified ${changed.length} reviewed job location repairs; IDs and non-location job fields preserved.`,
  );
  await recordReview();
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
