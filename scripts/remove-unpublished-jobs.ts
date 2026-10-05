import assert from "node:assert/strict";
import { chmod, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

type Removal = { url: string; sourceUrl: string; reason: string };
type Manifest = {
  checkedAt: string;
  companies: { companySlug: string; boardUrl: string; removed: Removal[] }[];
};
type Page = {
  url: string;
  markdown?: string;
  error?: unknown;
  truncated?: boolean;
  kind?: string;
  httpStatus?: number;
};
const arg = (key: string, required = false) => {
  const i = process.argv.indexOf(key);
  const value = i < 0 ? undefined : process.argv[i + 1];
  assert.ok(!required || (value && !value.startsWith("--")), `Missing ${key}`);
  return value;
};
const apply = process.argv.includes("--apply");
const postingId = (url: string) =>
  url
    .match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    )?.[0]
    .toLowerCase() ?? url.match(/\/jobs\/(\d+)(?:\?|$)/)?.[1];

async function main() {
  const manifestPath = arg("--manifest", true)!;
  const sourcePath = arg("--sources", true)!;
  const boardPath = arg("--boards", true)!;
  const reportPath = arg("--report");
  const backupPath = arg("--backup");
  assert.ok(
    manifestPath.startsWith("/") &&
      sourcePath.startsWith("/") &&
      boardPath.startsWith("/"),
    "Input paths must be absolute",
  );
  const manifest = JSON.parse(
    await (await import("node:fs/promises")).readFile(manifestPath, "utf8"),
  ) as Manifest;
  const sources = JSON.parse(
    await (await import("node:fs/promises")).readFile(sourcePath, "utf8"),
  ) as Page[];
  const boards = JSON.parse(
    await (await import("node:fs/promises")).readFile(boardPath, "utf8"),
  ) as Page[];
  assert.ok(
    Array.isArray(manifest.companies) &&
      Array.isArray(sources) &&
      Array.isArray(boards),
    "Invalid input format",
  );
  const databaseUrl =
    process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;
  assert.ok(databaseUrl, "DATABASE_URL_POOLED or DATABASE_URL is required");
  const sql = neon(databaseUrl);
  const sourceByUrl = new Map(sources.map((p) => [p.url, p]));
  const boardByUrl = new Map(boards.map((p) => [p.url, p]));
  assert.equal(sourceByUrl.size, sources.length, "Duplicate source URLs");
  assert.equal(boardByUrl.size, boards.length, "Duplicate board URLs");
  assert.equal(
    new Set(manifest.companies.map((c) => c.companySlug)).size,
    manifest.companies.length,
    "Duplicate companies",
  );
  const plans: any[] = [];
  const scopedSlugs = JSON.stringify(
    manifest.companies.map((company) => company.companySlug),
  );

  for (const entry of manifest.companies) {
    assert.ok(
      entry.companySlug && entry.boardUrl && Array.isArray(entry.removed),
      "Invalid company entry",
    );
    const board = boardByUrl.get(entry.boardUrl);
    assert.ok(
      board &&
        !board.error &&
        !board.truncated &&
        typeof board.markdown === "string" &&
        (board.kind === "first-party-board-api" ||
          board.markdown.length < 30000),
      `Invalid/truncated board: ${entry.boardUrl}`,
    );
    let uuids = [
      ...board.markdown.matchAll(
        /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
      ),
    ].map((m) => m[0].toLowerCase());
    if (board.kind === "first-party-board-api") {
      const parsed = new URL(board.url);
      assert.equal(parsed.hostname, "boards-api.greenhouse.io");
      assert.match(parsed.pathname, /^\/v1\/boards\/[^/]+\/jobs$/);
      assert.equal(board.httpStatus, 200);
      const listing = JSON.parse(board.markdown);
      assert.ok(
        Array.isArray(listing.jobs) && listing.jobs.length > 0,
        "Invalid Greenhouse listing",
      );
      uuids = listing.jobs.map((job: { id: number; absolute_url: string }) => {
        assert.equal(postingId(job.absolute_url), String(job.id));
        return String(job.id);
      });
    }
    assert.ok(uuids.length, `Board has no job UUID links: ${entry.boardUrl}`);
    const [companyRows, jobs, links, otherHashes, aliases] =
      await sql.transaction(
        [
          sql`SELECT c.*, md5(c.profile::text) AS profile_hash FROM companies c WHERE c.slug=${entry.companySlug}`,
          sql`SELECT j.*, md5(to_jsonb(j)::text) AS row_hash FROM jobs j JOIN companies c ON c.id=j.company_id WHERE c.slug=${entry.companySlug} ORDER BY j.id`,
          sql`SELECT l.* FROM job_locations l JOIN jobs j ON j.id=l.job_id JOIN companies c ON c.id=j.company_id WHERE c.slug=${entry.companySlug} ORDER BY l.job_id,l.position`,
          sql`SELECT (SELECT md5(string_agg(md5(to_jsonb(c)::text),',' ORDER BY c.id)) FROM companies c WHERE c.slug NOT IN (SELECT jsonb_array_elements_text(${scopedSlugs}::jsonb))) companies,
        (SELECT md5(string_agg(md5(to_jsonb(j)::text),',' ORDER BY j.id)) FROM jobs j JOIN companies c ON c.id=j.company_id WHERE c.slug NOT IN (SELECT jsonb_array_elements_text(${scopedSlugs}::jsonb))) jobs,
        (SELECT md5(string_agg(md5(to_jsonb(l)::text),',' ORDER BY l.job_id,l.position)) FROM job_locations l JOIN jobs j ON j.id=l.job_id JOIN companies c ON c.id=j.company_id WHERE c.slug NOT IN (SELECT jsonb_array_elements_text(${scopedSlugs}::jsonb))) links,
        (SELECT md5(string_agg(md5(to_jsonb(a)::text),',' ORDER BY a.alias)) FROM location_aliases a) aliases,
        (SELECT md5(string_agg(md5(to_jsonb(p)::text),',' ORDER BY p.id)) FROM locations p) catalog,
        (SELECT md5(string_agg(md5(to_jsonb(l)::text),',' ORDER BY l.job_id,l.position)) FROM job_locations l JOIN jobs j ON j.id=l.job_id JOIN companies c ON c.id=j.company_id WHERE c.slug=${entry.companySlug}) company_links`,
          sql`SELECT alias,location_id FROM location_aliases ORDER BY alias`,
        ],
        { isolationLevel: "RepeatableRead", readOnly: true },
      );
    assert.equal(
      companyRows.length,
      1,
      `Expected one company profile: ${entry.companySlug}`,
    );
    const company = companyRows[0] as any;
    const targets: any[] = [];
    for (const removal of entry.removed) {
      assert.ok(
        removal.url && removal.sourceUrl && removal.reason,
        "Removal requires exact URL, source URL, reason",
      );
      const matches = jobs.filter((j: any) => j.url === removal.url);
      assert.ok(matches.length <= 1, `Stored URL is ambiguous: ${removal.url}`);
      const job = matches[0] as any;
      const source = sourceByUrl.get(removal.sourceUrl);
      assert.ok(
        source &&
          source.url === removal.sourceUrl &&
          !source.error &&
          !source.truncated &&
          typeof source.markdown === "string",
        `Invalid source: ${removal.sourceUrl}`,
      );
      if (source.kind === "first-party-job-api") {
        assert.equal(new URL(source.url).hostname, "boards-api.greenhouse.io");
        assert.match(
          new URL(source.url).pathname,
          /^\/v1\/boards\/[^/]+\/jobs\/\d+$/,
        );
        assert.equal(source.httpStatus, 404);
        const result = JSON.parse(source.markdown);
        assert.equal(result.status, 404);
        assert.equal(result.error, "Job not found");
      } else if (source.kind === "http-status-capture") {
        assert.equal(source.httpStatus, 410);
      } else {
        assert.ok(
          /^##? (?:Page|Job) not found\b/im.test(source.markdown),
          `Source must explicitly say not found: ${removal.sourceUrl}`,
        );
        assert.ok(
          !/\b(?:error|truncated)\b/i.test(source.markdown),
          `Error/truncated source rejected: ${removal.sourceUrl}`,
        );
      }
      const id = postingId(removal.url);
      assert.ok(id, `Stored URL has no posting identity: ${removal.url}`);
      assert.equal(
        postingId(removal.sourceUrl),
        id,
        "Source must refer to same posting identity",
      );
      assert.ok(
        !uuids.includes(id),
        `Posting UUID still appears in fresh board: ${removal.url}`,
      );
      const embedded =
        company.profile.jobs?.filter((p: any) => p.url === removal.url) ?? [];
      assert.equal(
        embedded.length,
        job ? 1 : 0,
        `Profile/row removal identity mismatch: ${removal.url}`,
      );
      if (!job) continue;
      targets.push({ job, removal });
    }
    const targetIds = new Set(targets.map((x) => x.job.id));
    const profile = structuredClone(company.profile);
    if (Array.isArray(profile.jobs))
      profile.jobs = profile.jobs.filter(
        (p: any) => !targets.some((x) => x.removal.url === p.url),
      );
    const { company_links, ...outside } = otherHashes[0];
    plans.push({
      entry,
      company,
      jobs,
      links,
      other: outside,
      aliases,
      targets,
      targetIds,
      profile,
      linkHash: company_links,
    });
  }

  const report = {
    checkedAt: manifest.checkedAt,
    mode: apply ? "apply" : "dry-run",
    companies: plans.map((p) => ({
      companySlug: p.entry.companySlug,
      removed: p.targets.map((x: any) => ({
        id: x.job.id,
        title: x.job.title,
        url: x.removal.url,
        sourceUrl: x.removal.sourceUrl,
        boardUrl: p.entry.boardUrl,
        reason: x.removal.reason,
      })),
      remainingJobs: p.jobs.length - p.targets.length,
      totalJobs: p.jobs.length,
    })),
  };
  console.log(JSON.stringify(report, null, 2));
  if (reportPath)
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", {
      flag: "w",
      mode: 0o600,
    });
  const recordClosures = async () => {
    const directory = arg("--review-directory");
    if (!directory) return;
    for (const plan of plans) {
      assert.match(plan.entry.companySlug, /^[a-z0-9-]+$/);
      const path = join(directory, `${plan.entry.companySlug}.json`);
      let audit: any;
      try {
        audit = JSON.parse(await readFile(path, "utf8"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      assert.equal(audit.companySlug, plan.entry.companySlug);
      const closed = new Set(
        plan.entry.removed.map((role: Removal) => role.url),
      );
      audit.unavailable = (audit.unavailable ?? []).filter(
        (url: string) => !closed.has(url),
      );
      audit.removedPostings = [
        ...new Map(
          [
            ...(audit.removedPostings ?? []),
            ...plan.entry.removed.map((role: Removal) => ({
              ...role,
              checkedAt: manifest.checkedAt,
              boardUrl: plan.entry.boardUrl,
            })),
          ].map((role: Removal) => [role.url, role]),
        ).values(),
      ];
      await writeFile(path, JSON.stringify(audit, null, 2) + "\n");
    }
  };
  if (!apply) return;
  if (plans.every((p) => p.targets.length === 0)) {
    await recordClosures();
    return;
  }
  assert.ok(
    backupPath?.startsWith("/"),
    "Apply requires --backup /absolute/new-file.json",
  );
  const backup = {
    capturedAt: new Date().toISOString(),
    manifest,
    sources,
    boards,
    companies: plans.map((p) => ({
      slug: p.entry.companySlug,
      company: p.company,
      jobs: p.jobs,
      links: p.links,
      externalHashes: p.other,
      catalogAliases: p.aliases,
    })),
  };
  await writeFile(backupPath!, JSON.stringify(backup, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  await chmod(backupPath!, 0o600);
  const payload = JSON.stringify(
    plans.map((p) => ({
      slug: p.entry.companySlug,
      companyId: p.company.id,
      profileHash: p.company.profile_hash,
      profile: p.profile,
      linkHash: p.linkHash,
      removed: p.targets.map((x: any) => ({
        id: x.job.id,
        rowHash: x.job.row_hash,
      })),
    })),
  );
  const [result] =
    await sql`WITH input AS (SELECT ${payload}::jsonb data), ci AS (
      SELECT x.* FROM input,jsonb_to_recordset(data) x(slug text,"companyId" uuid,"profileHash" text,profile jsonb,"linkHash" text,removed jsonb)),
    ji AS (SELECT ci."companyId",x.id,x."rowHash" FROM ci,jsonb_to_recordset(ci.removed) x(id uuid,"rowHash" text)),
    locked_c AS MATERIALIZED (SELECT c.id,ci.profile,ci."linkHash",ci."companyId" FROM companies c JOIN ci ON c.id=ci."companyId" WHERE md5(c.profile::text)=ci."profileHash" FOR UPDATE OF c),
    locked_j AS MATERIALIZED (SELECT j.id,j.company_id FROM jobs j JOIN ji ON ji.id=j.id AND ji."companyId"=j.company_id WHERE md5(to_jsonb(j)::text)=ji."rowHash" FOR UPDATE OF j),
    ready AS MATERIALIZED (SELECT (SELECT count(*) FROM locked_c)=(SELECT count(*) FROM ci) AND (SELECT count(*) FROM locked_j)=(SELECT count(*) FROM ji)
      AND NOT EXISTS(SELECT 1 FROM ci WHERE (SELECT md5(string_agg(md5(to_jsonb(l)::text),',' ORDER BY l.job_id,l.position)) FROM job_locations l JOIN jobs j ON j.id=l.job_id WHERE j.company_id=ci."companyId") IS DISTINCT FROM ci."linkHash") ok),
    removed AS (DELETE FROM jobs j USING locked_j,ready WHERE j.id=locked_j.id AND ready.ok RETURNING j.id),
    updated AS (UPDATE companies c SET profile=locked_c.profile,updated_at=now() FROM locked_c,ready WHERE c.id=locked_c.id AND ready.ok RETURNING c.id)
    SELECT (SELECT ok FROM ready) ok,(SELECT count(*)::int FROM removed) removed,(SELECT count(*)::int FROM updated) updated`;
  assert.ok(result?.ok, "Optimistic guard failed; transaction made no changes");
  assert.equal(
    result.removed,
    plans.reduce((n, p) => n + p.targets.length, 0),
    "Unexpected deletion count",
  );
  assert.equal(result.updated, plans.length);
  for (const p of plans) {
    const [companyRows, jobs, links, outside] = await sql.transaction(
      [
        sql`SELECT *,md5(profile::text) profile_hash FROM companies WHERE slug=${p.entry.companySlug}`,
        sql`SELECT * FROM jobs WHERE company_id=${p.company.id} ORDER BY id`,
        sql`SELECT l.* FROM job_locations l JOIN jobs j ON j.id=l.job_id WHERE j.company_id=${p.company.id} ORDER BY l.job_id,l.position`,
        sql`SELECT (SELECT md5(string_agg(md5(to_jsonb(c)::text),',' ORDER BY c.id)) FROM companies c WHERE slug NOT IN (SELECT jsonb_array_elements_text(${scopedSlugs}::jsonb))) companies,
        (SELECT md5(string_agg(md5(to_jsonb(j)::text),',' ORDER BY j.id)) FROM jobs j JOIN companies c ON c.id=j.company_id WHERE c.slug NOT IN (SELECT jsonb_array_elements_text(${scopedSlugs}::jsonb))) jobs,
        (SELECT md5(string_agg(md5(to_jsonb(l)::text),',' ORDER BY l.job_id,l.position)) FROM job_locations l JOIN jobs j ON j.id=l.job_id JOIN companies c ON c.id=j.company_id WHERE c.slug NOT IN (SELECT jsonb_array_elements_text(${scopedSlugs}::jsonb))) links,
        (SELECT md5(string_agg(md5(to_jsonb(a)::text),',' ORDER BY a.alias)) FROM location_aliases a) aliases,
        (SELECT md5(string_agg(md5(to_jsonb(p)::text),',' ORDER BY p.id)) FROM locations p) catalog`,
      ],
      { isolationLevel: "RepeatableRead", readOnly: true },
    );
    assert.deepEqual(outside[0], p.other, "Off-scope database hashes changed");
    assert.equal(companyRows.length, 1);
    const after = companyRows[0] as any;
    for (const key of Object.keys(p.company).filter(
      (k) => !["profile", "profile_hash", "updated_at"].includes(k),
    ))
      assert.deepEqual(
        after[key],
        p.company[key],
        `Company field changed: ${key}`,
      );
    assert.deepEqual(
      after.profile,
      p.profile,
      "Embedded profile survivor data changed",
    );
    assert.equal(
      jobs.length,
      p.jobs.length - p.targets.length,
      "Unexpected survivor count",
    );
    for (const old of p.jobs) {
      if (p.targetIds.has(old.id))
        assert.ok(
          !jobs.some((j: any) => j.id === old.id),
          `Deleted job remains: ${old.id}`,
        );
      else
        assert.deepEqual(
          jobs.find((j: any) => j.id === old.id),
          Object.fromEntries(
            Object.entries(old).filter(([k]) => k !== "row_hash"),
          ),
          `Survivor changed: ${old.id}`,
        );
    }
    assert.deepEqual(
      links,
      p.links.filter((l: any) => !p.targetIds.has(l.job_id)),
      "Surviving job references changed",
    );
  }
  console.log(
    "Apply verified; jobs and cascading job_locations references removed.",
  );
  await recordClosures();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
