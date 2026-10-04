import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "../lib/db/client";
import {
  COMPANY_EMBEDDING_RECIPE,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  JOB_EMBEDDING_RECIPE,
  QUERY_EMBEDDING_RECIPE,
  companyEmbeddingText,
  embeddingKey,
  jobEmbeddingText,
  validateEmbedding,
} from "../lib/ai/embedding-config";

type Saved = {
  modelId: string;
  dimensions: number;
  recipe: string;
  inputType: "document" | "query";
  textHash?: string;
  key?: string;
  embedding: number[];
};
const base = join(process.cwd(), ".cache", "embedding-canary");
const jobsDir = join(base, "exa-jobs");
const args = new Set(process.argv.slice(2));
assert.ok(
  [...args].every((arg) => arg === "--apply"),
  "Only --apply is supported",
);

async function readVector(
  path: string,
  contentText: string,
  inputType: Saved["inputType"],
  recipe: string,
) {
  const key = embeddingKey(contentText, inputType, recipe);
  const localKey =
    recipe === COMPANY_EMBEDDING_RECIPE
      ? createHash("sha256")
          .update(
            JSON.stringify({
              modelId: EMBEDDING_MODEL,
              dimensions: EMBEDDING_DIMENSIONS,
              recipe,
              inputType,
              value: contentText,
            }),
          )
          .digest("hex")
      : key;
  const saved = JSON.parse(
    await readFile(join(path, `${localKey}.json`), "utf8"),
  ) as Saved;
  assert.equal(saved.modelId, EMBEDDING_MODEL);
  assert.equal(saved.dimensions, EMBEDDING_DIMENSIONS);
  assert.equal(saved.recipe, recipe);
  assert.equal(saved.inputType, inputType);
  assert.equal(saved.textHash ?? saved.key, localKey);
  validateEmbedding(saved.embedding);
  return { key, vector: saved.embedding };
}

async function cache(
  key: string,
  recipe: string,
  inputType: string,
  contentText: string,
  embedding: number[],
) {
  await db.execute(sql`INSERT INTO embedding_cache (key,model_id,dimensions,recipe,input_type,embedding,content_text)
    VALUES (${key},${EMBEDDING_MODEL},${EMBEDDING_DIMENSIONS},${recipe},${inputType},${JSON.stringify(embedding)}::vector,${contentText})
    ON CONFLICT (key) DO UPDATE SET model_id=EXCLUDED.model_id, dimensions=EXCLUDED.dimensions,
    recipe=EXCLUDED.recipe, input_type=EXCLUDED.input_type, embedding=EXCLUDED.embedding, content_text=EXCLUDED.content_text`);
}

async function main() {
  const pending: Array<{
    key: string;
    recipe: string;
    inputType: string;
    text: string;
    vector: number[];
    jobId?: string;
    companyId?: string;
  }> = [];
  const { rows: jobs } =
    await db.execute(sql`SELECT j.id,j.title,j.department,j.focus,j.skills,j.description,c.name AS company_name
    FROM jobs j JOIN companies c ON c.id=j.company_id WHERE c.slug='exa' ORDER BY j.title,j.location,j.id`);
  assert.equal(jobs.length, 52, `Expected 52 Exa jobs, found ${jobs.length}`);
  let importedJobs = 0;
  for (const row of jobs as Array<{
    id: string;
    title: string;
    department: string | null;
    focus: string;
    skills: string[];
    description: string;
    company_name: string;
  }>) {
    assert.ok(row.description?.trim(), `Missing description for ${row.id}`);
    const text = jobEmbeddingText({ ...row, companyName: row.company_name });
    const { key, vector } = await readVector(
      jobsDir,
      text,
      "document",
      JOB_EMBEDDING_RECIPE,
    );
    pending.push({
      key,
      recipe: JOB_EMBEDDING_RECIPE,
      inputType: "document",
      text,
      vector,
      jobId: row.id,
    });
    importedJobs++;
  }
  const { rows: companies } = await db.execute(
    sql`SELECT id,name,industry,profile->>'tagline' AS tagline,profile->>'description' AS description FROM companies WHERE slug='exa'`,
  );
  assert.equal(companies.length, 1, "Expected one Exa company");
  const company = companies[0] as {
    id: string;
    name: string;
    industry: string;
    tagline: string | null;
    description: string;
  };
  const companyText = companyEmbeddingText(company);
  const companyVector = await readVector(
    base,
    companyText,
    "document",
    COMPANY_EMBEDDING_RECIPE,
  );
  pending.push({
    key: companyVector.key,
    recipe: COMPANY_EMBEDDING_RECIPE,
    inputType: "document",
    text: companyText,
    vector: companyVector.vector,
    companyId: company.id,
  });

  // Import all precomputed query vectors; never call an embedding provider here.
  const queries = new Map<string, string>([
    [
      "Companies providing neural web retrieval APIs for AI agents",
      COMPANY_EMBEDDING_RECIPE,
    ],
    [
      "Companies manufacturing commercial kitchen equipment",
      COMPANY_EMBEDDING_RECIPE,
    ],
    [
      "Engineering roles building distributed data infrastructure and large-scale storage systems",
      JOB_EMBEDDING_RECIPE,
    ],
    [
      "Research roles training and improving machine learning models for retrieval",
      JOB_EMBEDDING_RECIPE,
    ],
    [
      "Sales roles owning customer relationships and closing enterprise deals",
      JOB_EMBEDDING_RECIPE,
    ],
    [
      "Design roles creating visual brand identities and marketing assets",
      JOB_EMBEDDING_RECIPE,
    ],
    [
      "Registered nurse providing bedside patient care in a hospital",
      JOB_EMBEDDING_RECIPE,
    ],
  ]);
  for (const [text, recipe] of queries) {
    // Existing cache key recipe is canary recipe; semantic runtime query key gets its own recipe.
    const path = recipe === COMPANY_EMBEDDING_RECIPE ? base : jobsDir;
    const saved = await readVector(path, text, "query", recipe);
    pending.push({
      key: embeddingKey(text, "query", QUERY_EMBEDDING_RECIPE),
      recipe: QUERY_EMBEDDING_RECIPE,
      inputType: "query",
      text,
      vector: saved.vector,
    });
  }
  // Validate the ENTIRE cache before any writes. Dry-run is genuinely read-only.
  if (args.has("--apply")) {
    // Run db:migrate first. Imports never alter the schema or migration journal.
    for (const item of pending) {
      await cache(
        item.key,
        item.recipe,
        item.inputType,
        item.text,
        item.vector,
      );
      if (item.jobId)
        await db.execute(
          sql`INSERT INTO job_embeddings(job_id,cache_key) VALUES (${item.jobId},${item.key}) ON CONFLICT(job_id) DO UPDATE SET cache_key=EXCLUDED.cache_key`,
        );
      if (item.companyId)
        await db.execute(
          sql`INSERT INTO company_embeddings(company_id,cache_key) VALUES (${item.companyId},${item.key}) ON CONFLICT(company_id) DO UPDATE SET cache_key=EXCLUDED.cache_key`,
        );
    }
  }
  console.log(
    JSON.stringify({
      mode: args.has("--apply") ? "apply" : "dry-run",
      jobs: importedJobs,
      companies: 1,
      queries: queries.size,
      providerRequests: 0,
    }),
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
