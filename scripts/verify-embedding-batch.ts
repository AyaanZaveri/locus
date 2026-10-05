import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "../lib/db/client";
import { sql } from "drizzle-orm";
import {
  buildJobsQuery,
  jobsQuerySchema,
  jobsQueryResult,
} from "../lib/ai/jobs-query";
import {
  buildCompanyDiscoveryQuery,
  companyDiscoverySchema,
} from "../lib/ai/company-discovery";
import {
  semanticCoverageQuery,
  retrieveSemantic,
} from "../lib/ai/semantic-search";
import {
  JOB_EMBEDDING_RECIPE,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  embeddingKey,
  jobEmbeddingText,
} from "../lib/ai/embedding-config";

async function main() {
  // A missing cached query must fail verification, never create a paid vector.
  // This only clears the key inside this standalone verifier process.
  delete process.env.AI_GATEWAY_API_KEY;
  const batchId = process.argv[2] ?? "batch-01";
  const extraArgs = process.argv.slice(3);
  assert.ok(
    extraArgs.length === 0 ||
      (extraArgs.length === 2 && extraArgs[0] === "--manifest" && extraArgs[1]),
    "Use batch ID followed optionally by --manifest path",
  );
  const manifestPath = extraArgs[1] ?? "reports/embedding-batches.json";
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const batch = manifest.batches.find((b: { id: string }) => b.id === batchId);
  assert.ok(batch, "Unknown batch");
  const asOf = new Date().toISOString().slice(0, 10);
  const jobsInput = jobsQuerySchema.parse({
    companySlugs: batch.companySlugs,
    status: "openOrUnknown",
    limit: 3,
  });
  const jobsBase = buildJobsQuery(jobsInput, asOf, undefined, [], true);
  const companiesBase = buildCompanyDiscoveryQuery(
    companyDiscoverySchema.parse({ companySlugs: batch.companySlugs }),
    asOf,
    undefined,
    true,
  );
  const jobsCoverage = (
    await db.execute(semanticCoverageQuery(jobsBase, "jobs"))
  ).rows[0];
  const companyCoverage = (
    await db.execute(semanticCoverageQuery(companiesBase, "companies"))
  ).rows[0];
  // Search excludes closed/future jobs, while a document backfill includes
  // all saved job texts. Audit both denominators without changing their facts.
  const allJobs = (
    await db.execute(sql`SELECT j.title,j.department,j.focus,j.skills,j.description,c.name AS "companyName"
    FROM jobs j JOIN companies c ON c.id=j.company_id
    WHERE c.slug IN (${sql.join(
      batch.companySlugs.map((slug: string) => sql`${slug}`),
      sql`, `,
    )})`)
  ).rows as Array<Parameters<typeof jobEmbeddingText>[0]>;
  assert.equal(
    allJobs.length,
    batch.jobCount,
    "Saved job inventory differs from manifest",
  );
  const documents = allJobs.map((job) => {
    assert.ok(
      job.description?.trim(),
      "Cannot verify a job without its full description",
    );
    const text = jobEmbeddingText(job);
    return { key: embeddingKey(text, "document", JOB_EMBEDDING_RECIPE), text };
  });
  const cached = documents.length
    ? (
        await db.execute(sql`SELECT key,content_text FROM embedding_cache
    WHERE key IN (${sql.join(
      [...new Set(documents.map((d) => d.key))].map((key) => sql`${key}`),
      sql`, `,
    )})
    AND model_id=${EMBEDDING_MODEL} AND dimensions=${EMBEDDING_DIMENSIONS} AND input_type='document' AND recipe=${JOB_EMBEDDING_RECIPE}`)
      ).rows
    : [];
  const current = new Map(
    cached.map((row) => [String(row.key), String(row.content_text)]),
  );
  const allJobDocumentCoverage = {
    eligible: documents.length,
    embedded: documents.filter((d) => current.get(d.key) === d.text).length,
  };
  assert.equal(
    allJobDocumentCoverage.embedded,
    batch.jobCount,
    "All-status current job text coverage is incomplete",
  );
  assert.equal(Number(jobsCoverage.embedded), Number(jobsCoverage.eligible));
  assert.equal(Number(companyCoverage.eligible), batch.companyCount);
  assert.equal(Number(companyCoverage.embedded), batch.companyCount);
  const globalJobs = (
    await db.execute(
      semanticCoverageQuery(
        buildJobsQuery(
          jobsQuerySchema.parse({ status: "openOrUnknown" }),
          asOf,
          undefined,
          [],
          true,
        ),
        "jobs",
      ),
    )
  ).rows[0];
  const globalCompanies = (
    await db.execute(
      semanticCoverageQuery(
        buildCompanyDiscoveryQuery(
          companyDiscoverySchema.parse({}),
          asOf,
          undefined,
          true,
        ),
        "companies",
      ),
    )
  ).rows[0];
  if (batchId === "batch-03") {
    assert.equal(
      Number(globalJobs.embedded),
      Number(globalJobs.eligible),
      "Global job coverage incomplete after final rollout",
    );
    assert.equal(
      Number(globalCompanies.embedded),
      Number(globalCompanies.eligible),
      "Global About coverage incomplete after final rollout",
    );
  }
  const queryRequestsBefore = (
    await db.execute(sql`SELECT count(*) AS n FROM embedding_requests`)
  ).rows[0].n;
  const cases = extraArgs.length
    ? batch.companySlugs.map((slug: string) => ({
        slug,
        query:
          "Engineering roles building distributed data infrastructure and large-scale storage systems",
      }))
    : batchId === "batch-02"
      ? [
          {
            slug: "anthropic",
            query:
              "Research roles training and improving machine learning models for retrieval",
          },
          {
            slug: "elevenlabs",
            query:
              "Research roles training and improving machine learning models for retrieval",
          },
          {
            slug: "vercel",
            query:
              "Engineering roles building distributed data infrastructure and large-scale storage systems",
          },
        ]
      : batchId === "batch-03"
        ? [
            {
              slug: "openai",
              query:
                "Research roles training and improving machine learning models for retrieval",
            },
            {
              slug: "mistral-ai",
              query:
                "Research roles training and improving machine learning models for retrieval",
            },
            {
              slug: "replit",
              query:
                "Engineering roles building distributed data infrastructure and large-scale storage systems",
            },
          ]
        : [
            {
              slug: "baseten",
              query:
                "Engineering roles building distributed data infrastructure and large-scale storage systems",
            },
            {
              slug: "cohere",
              query:
                "Research roles training and improving machine learning models for retrieval",
            },
            {
              slug: "cursor",
              query:
                "Engineering roles building distributed data infrastructure and large-scale storage systems",
            },
          ];
  const samples = [];
  for (const sample of cases) {
    const input = jobsQuerySchema.parse({
      companySlugs: [sample.slug],
      status: "openOrUnknown",
      limit: 3,
    });
    const r = await retrieveSemantic(
      buildJobsQuery(input, asOf, undefined, [], true),
      "jobs",
      sample.query,
      3,
      "relevance",
    );
    if (Number(r.metadata.eligibleRecords) === 0) {
      assert.equal(r.rows.length, 0);
      samples.push({
        slug: sample.slug,
        query: sample.query,
        retrieval: r.metadata,
        topMatches: [],
      });
      continue;
    }
    assert.ok(!r.unavailable);
    assert.equal(r.metadata.completeCoverage, true);
    assert.equal(r.metadata.queryCacheHit, true);
    assert.ok(r.rows.length > 0);
    const out = jobsQueryResult(r.rows, input, asOf);
    assert.ok(
      out.jobs.every(
        (j) =>
          j.url &&
          typeof j.descriptionExcerpt === "string" &&
          j.descriptionExcerpt.length > 0,
      ),
    );
    if (sample.slug === "cohere" || sample.slug === "elevenlabs")
      assert.ok(out.jobs.every((j) => j.status === "unknown"));
    samples.push({
      slug: sample.slug,
      query: sample.query,
      retrieval: r.metadata,
      topMatches: out.jobs.map((j) => ({
        title: j.title,
        score: j.semanticScore,
        status: j.status,
        url: j.url,
        descriptionExcerpt: j.descriptionExcerpt,
      })),
    });
  }
  const companySample = await retrieveSemantic(
    companiesBase,
    "companies",
    "Companies providing neural web retrieval APIs for AI agents",
    5,
    "relevance",
  );
  assert.equal(companySample.metadata.queryCacheHit, true);
  assert.equal(companySample.metadata.completeCoverage, true);
  assert.ok(companySample.rows.every((c) => c.source_url && c.description));
  const impossible = await retrieveSemantic(
    buildJobsQuery(
      jobsQuerySchema.parse({
        ...jobsInput,
        minimumSalary: 1e9,
        location: "Mars",
      }),
      asOf,
      undefined,
      [],
      true,
    ),
    "jobs",
    "NEVER EMBED: impossible exact filters",
    3,
    "relevance",
  );
  assert.equal(impossible.rows.length, 0);
  assert.ok(impossible.unavailable);
  assert.equal(
    (await db.execute(sql`SELECT count(*) AS n FROM embedding_requests`))
      .rows[0].n,
    queryRequestsBefore,
    "Verification must not generate paid query vectors",
  );
  const result = {
    batchId,
    verifiedAt: new Date().toISOString(),
    jobsCoverage,
    allJobDocumentCoverage,
    companyCoverage,
    globalJobsCoverage: globalJobs,
    globalCompanyCoverage: globalCompanies,
    samples,
    companySample: companySample.rows.map((c) => ({
      slug: c.slug,
      name: c.name,
      score: c.semantic_score,
      sourceUrl: c.source_url,
      description: c.description,
    })),
    paidEmbeddingRequests: 0,
    note: "Coverage is exact current-text coverage. Samples use cached query vectors; quality review is still required. Unembedded companies remain outside semantic ranking.",
  };
  await writeFile(
    join(".cache", "embedding-rollouts", batchId, "verification.json"),
    JSON.stringify(result, null, 2),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify(
      {
        ...result,
        samples: samples.map((s) => ({
          ...s,
          topMatches: s.topMatches.map(({ descriptionExcerpt, ...j }) => j),
        })),
        companySample: result.companySample.map(({ description, ...c }) => c),
      },
      null,
      2,
    ),
  );
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Verification failed");
  process.exitCode = 1;
});
