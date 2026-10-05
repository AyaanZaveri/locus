import assert from "node:assert/strict";
import { mkdir, open } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "../lib/db/client";
import {
  createCompanyEmbeddingManifest,
  isStrictCompanySlug,
  type CompanyEmbeddingCompany,
  type CompanyEmbeddingJob,
} from "../lib/ai/company-embedding-manifest";

function parseArgs(args: string[]) {
  let company: string | undefined;
  let output: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--company") company = args[++i];
    else if (arg === "--output") output = args[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  assert.ok(
    company && isStrictCompanySlug(company),
    "--company must be one strict company slug",
  );
  assert.ok(output, "--output PATH is required");
  return { company, output: resolve(output) };
}

async function main() {
  const { company: slug, output } = parseArgs(process.argv.slice(2));
  const result = await db.execute(
    sql`SELECT id,slug,name,industry,profile->>'tagline' AS tagline,profile->>'description' AS description FROM companies WHERE slug=${slug}`,
  );
  const row = result.rows[0] as
    (CompanyEmbeddingCompany & { id: string }) | undefined;
  assert.ok(row, `Company not found: ${slug}`);
  const jobResult = await db.execute(
    sql`SELECT title,department,focus,skills,description,c.name AS "companyName" FROM jobs j JOIN companies c ON c.id=j.company_id WHERE c.slug=${slug} ORDER BY j.title,j.location,j.id`,
  );
  const jobs = jobResult.rows as CompanyEmbeddingJob[];
  const manifest = createCompanyEmbeddingManifest(row, jobs);
  await mkdir(dirname(output), { recursive: true });
  const file = await open(output, "wx", 0o600);
  try {
    await file.writeFile(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  } finally {
    await file.close();
  }
  console.log(
    JSON.stringify({
      manifestPath: output,
      batchId: manifest.batches[0].id,
      companySlug: slug,
      companyCount: 1,
      jobCount: jobs.length,
    }),
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Unable to prepare embedding manifest",
  );
  process.exitCode = 1;
});
