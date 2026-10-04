import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import { createGateway, embedMany } from "ai";
import { sql } from "drizzle-orm";
import { db } from "../lib/db/client";
import {
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  JOB_EMBEDDING_RECIPE,
  COMPANY_EMBEDDING_RECIPE,
  companyEmbeddingText,
  jobEmbeddingText,
  embeddingKey,
  validateEmbedding,
} from "../lib/ai/embedding-config";
import {
  planEmbeddingRequests,
  PRICE_PER_MILLION,
  TOKEN_MARGIN_PER_INPUT,
  type EmbeddingDocument,
} from "../lib/ai/embedding-batch-plan";

type Document = EmbeddingDocument & {
  companySlug: string;
  companyId: string;
  jobId?: string;
  kind: "company" | "job";
};
type Saved = {
  key: string;
  recipe: string;
  text: string;
  modelId: string;
  dimensions: number;
  inputType: "document";
  embedding: number[];
};
type Receipt = {
  id: string;
  startedAt: string;
  completedAt: string;
  mock: boolean;
  vectors: Saved[];
  usage: unknown;
  providerMetadata: unknown;
  reportedCostUsd: number;
  warnings?: unknown[];
};
type Manifest = {
  batches: Array<{
    id: string;
    companySlugs: string[];
    companyCount: number;
    jobCount: number;
  }>;
};

const argv = process.argv.slice(2);
let batchId = "batch-01",
  budgetUsd = 0.25,
  maxNewRequests = 100;
let run = false,
  mock = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--batch") batchId = argv[++i];
  else if (argv[i] === "--budget-usd") budgetUsd = Number(argv[++i]);
  else if (argv[i] === "--max-new-requests") maxNewRequests = Number(argv[++i]);
  else if (argv[i] === "--run") run = true;
  else if (argv[i] === "--mock") mock = true;
  else if (argv[i] !== "--dry-run")
    throw new Error(`Unknown argument ${argv[i]}`);
}
assert.ok(!run || !mock, "Mock and paid run are exclusive");
assert.ok(
  Number.isFinite(budgetUsd) && budgetUsd > 0 && budgetUsd <= 5,
  "Invalid budget",
);
assert.ok(
  Number.isInteger(maxNewRequests) &&
    maxNewRequests > 0 &&
    maxNewRequests <= 100,
  "Invalid request limit",
);
const root = join(process.cwd(), ".cache", "embedding-rollouts");
const directory = join(root, mock ? `mock-${batchId}` : batchId);

async function atomicJson(path: string, value: unknown) {
  await writeFile(`${path}.pending`, JSON.stringify(value), { mode: 0o600 });
  await rename(`${path}.pending`, path);
}
function savedVector(value: Saved) {
  assert.equal(value.modelId, EMBEDDING_MODEL);
  assert.equal(value.dimensions, EMBEDDING_DIMENSIONS);
  assert.equal(value.inputType, "document");
  assert.equal(value.key, embeddingKey(value.text, "document", value.recipe));
  validateEmbedding(value.embedding);
  return value;
}
function cost(metadata: unknown) {
  const raw = (metadata as { gateway?: { cost?: unknown } } | undefined)
    ?.gateway?.cost;
  assert.ok(
    raw !== undefined && raw !== null,
    "Missing billing receipt; stop before further paid requests",
  );
  const result = Number(raw);
  assert.ok(Number.isFinite(result) && result >= 0, "Invalid billing cost");
  return result;
}

async function collect(slugs: string[]) {
  const parameters = sql.join(
    slugs.map((s) => sql`${s}`),
    sql`, `,
  );
  const companies = (
    await db.execute(sql`SELECT id,slug,name,industry,profile->>'tagline' AS tagline,profile->>'description' AS description
    FROM companies WHERE slug IN (${parameters}) ORDER BY slug`)
  ).rows as Array<{
    id: string;
    slug: string;
    name: string;
    industry: string;
    tagline: string | null;
    description: string;
  }>;
  assert.equal(companies.length, slugs.length, "Missing companies");
  const jobs = (
    await db.execute(sql`SELECT j.id,j.title,j.department,j.focus,j.skills,j.description,j.status,c.id AS company_id,c.slug AS company_slug,c.name AS company_name
    FROM jobs j JOIN companies c ON c.id=j.company_id WHERE c.slug IN (${parameters}) ORDER BY c.slug,j.title,j.location,j.id`)
  ).rows as Array<{
    id: string;
    title: string;
    department: string | null;
    focus: string;
    skills: string[];
    description: string;
    status: string;
    company_id: string;
    company_slug: string;
    company_name: string;
  }>;
  const documents: Document[] = [];
  for (const c of companies) {
    assert.ok(c.description?.trim(), `Missing About text: ${c.slug}`);
    const text = companyEmbeddingText(c);
    documents.push({
      key: embeddingKey(text, "document", COMPANY_EMBEDDING_RECIPE),
      recipe: COMPANY_EMBEDDING_RECIPE,
      text,
      tokens: 0,
      companySlug: c.slug,
      companyId: c.id,
      kind: "company",
    });
  }
  for (const j of jobs) {
    assert.ok(
      j.description?.trim(),
      `Missing job description: ${j.company_slug} ${j.title}`,
    );
    const text = jobEmbeddingText({ ...j, companyName: j.company_name });
    documents.push({
      key: embeddingKey(text, "document", JOB_EMBEDDING_RECIPE),
      recipe: JOB_EMBEDDING_RECIPE,
      text,
      tokens: 0,
      companySlug: j.company_slug,
      companyId: j.company_id,
      jobId: j.id,
      kind: "job",
    });
  }
  return { documents, companies, jobs };
}

async function importVectors(
  documents: Document[],
  vectors: Map<string, Saved>,
) {
  if (mock) return;
  const unique = [
    ...new Map(
      documents
        .filter((d) => vectors.has(d.key))
        .map((d) => [d.key, vectors.get(d.key)!]),
    ).values(),
  ];
  for (let offset = 0; offset < unique.length; offset += 40) {
    const values = unique
      .slice(offset, offset + 40)
      .map(
        (v) =>
          sql`(${v.key},${EMBEDDING_MODEL},${EMBEDDING_DIMENSIONS},${v.recipe},'document',${v.text},${JSON.stringify(v.embedding)}::vector)`,
      );
    await db.execute(sql`INSERT INTO embedding_cache (key,model_id,dimensions,recipe,input_type,content_text,embedding)
      VALUES ${sql.join(values, sql`, `)} ON CONFLICT (key) DO NOTHING`);
  }
  for (const kind of ["company", "job"] as const) {
    const references = documents.filter(
      (d) => d.kind === kind && vectors.has(d.key),
    );
    for (let offset = 0; offset < references.length; offset += 200) {
      const values = references
        .slice(offset, offset + 200)
        .map((d) => sql`(${kind === "job" ? d.jobId! : d.companyId},${d.key})`);
      if (kind === "job")
        await db.execute(
          sql`INSERT INTO job_embeddings(job_id,cache_key) VALUES ${sql.join(values, sql`, `)} ON CONFLICT(job_id) DO UPDATE SET cache_key=EXCLUDED.cache_key`,
        );
      else
        await db.execute(
          sql`INSERT INTO company_embeddings(company_id,cache_key) VALUES ${sql.join(values, sql`, `)} ON CONFLICT(company_id) DO UPDATE SET cache_key=EXCLUDED.cache_key`,
        );
    }
  }
}

async function main() {
  const manifest: Manifest = JSON.parse(
    await readFile("reports/embedding-batches.json", "utf8"),
  );
  const rollout = manifest.batches.find((b) => b.id === batchId);
  assert.ok(rollout, "Unknown batch");
  assert.ok(!rollout.companySlugs.includes("exa"), "Do not regenerate Exa");
  assert.equal(new Set(rollout.companySlugs).size, rollout.companyCount);
  const { documents, companies, jobs } = await collect(rollout.companySlugs);
  assert.equal(
    jobs.length,
    rollout.jobCount,
    "Job inventory changed since planning; inspect manifest before spending",
  );
  const unique = [...new Map(documents.map((d) => [d.key, d])).values()];
  const vectors = new Map<string, Saved>();
  const existing = (
    await db.execute(sql`SELECT key,model_id,dimensions,recipe,input_type,content_text,embedding FROM embedding_cache
    WHERE key IN (${sql.join(
      unique.map((d) => sql`${d.key}`),
      sql`, `,
    )})`)
  ).rows;
  for (const row of existing) {
    const value = savedVector({
      key: String(row.key),
      recipe: String(row.recipe),
      text: String(row.content_text),
      modelId: String(row.model_id),
      dimensions: Number(row.dimensions),
      inputType: row.input_type as "document",
      embedding:
        typeof row.embedding === "string"
          ? JSON.parse(row.embedding)
          : row.embedding,
    });
    vectors.set(value.key, value);
  }
  await mkdir(directory, { recursive: true });
  let lock;
  if (run || mock)
    lock = await open(
      join(root, mock ? "mock-run.lock" : "run.lock"),
      "wx",
      0o600,
    );
  try {
    let spentUsd = 0,
      lastStartedAt = 0;
    for (const file of (await readdir(directory)).filter((name) =>
      name.endsWith(".receipt.json"),
    )) {
      const receipt: Receipt = JSON.parse(
        await readFile(join(directory, file), "utf8"),
      );
      assert.equal(receipt.mock, mock, "Never import mocked vectors");
      assert.ok(
        !receipt.warnings?.length,
        "Provider warnings require manual inspection",
      );
      assert.ok(
        Number.isFinite(receipt.reportedCostUsd) &&
          receipt.reportedCostUsd >= 0,
      );
      spentUsd += receipt.reportedCostUsd;
      lastStartedAt = Math.max(lastStartedAt, Date.parse(receipt.startedAt));
      for (const value of receipt.vectors) {
        savedVector(value);
        vectors.set(value.key, value);
      }
      if (run || mock)
        await unlink(join(directory, `${receipt.id}.inflight`)).catch((e) => {
          if (e.code !== "ENOENT") throw e;
        });
    }
    if (run || mock)
      assert.ok(
        !(await readdir(directory)).some((name) => name.endsWith(".inflight")),
        "Unresolved request: inspect billing before resuming. No automatic retry.",
      );
    const missing = unique.filter((d) => !vectors.has(d.key));
    let tokenizerProvenance: unknown;
    if (missing.length) {
      const result = spawnSync(
        "uv",
        [
          "run",
          "--with",
          "tokenizers",
          "--with",
          "huggingface-hub",
          "python3",
          "scripts/count-voyage-tokens.py",
        ],
        {
          input: JSON.stringify({ texts: missing.map((d) => d.text) }),
          encoding: "utf8",
          maxBuffer: 12 * 1024 * 1024,
          timeout: 180000,
        },
      );
      assert.equal(
        result.status,
        0,
        `Local tokenizer failed: ${result.stderr?.slice(-1500)}`,
      );
      const accounting = JSON.parse(result.stdout);
      tokenizerProvenance = {
        model: accounting.model,
        revision: accounting.revision,
        documentPromptTokens: accounting.documentPromptTokens,
      };
      assert.equal(accounting.model, "voyageai/voyage-4-large");
      assert.equal(accounting.counts.length, missing.length);
      assert.ok(
        accounting.documentPromptTokens <= TOKEN_MARGIN_PER_INPUT,
        "Provider prompt exceeds planning margin",
      );
      missing.forEach((d, i) => {
        assert.ok(
          Number.isInteger(accounting.counts[i]) && accounting.counts[i] > 0,
        );
        d.tokens = accounting.counts[i];
      });
    }
    const batches = planEmbeddingRequests(missing);
    const tokens = missing.reduce((sum, d) => sum + d.tokens, 0);
    const estimatedRemainingUsd =
      (missing.reduce((sum, d) => sum + d.tokens + TOKEN_MARGIN_PER_INPUT, 0) *
        PRICE_PER_MILLION) /
      1e6;
    const plan = {
      batchId,
      mode: mock ? "mock" : run ? "live" : "dry-run",
      companies: companies.length,
      jobs: jobs.length,
      statusCounts: jobs.reduce<Record<string, number>>((a, j) => {
        a[j.status] = (a[j.status] ?? 0) + 1;
        return a;
      }, {}),
      totalDocuments: documents.length,
      uniqueDocuments: unique.length,
      reusedUniqueVectors: unique.filter((d) => vectors.has(d.key)).length,
      missingUniqueVectors: missing.length,
      localInputTokens: tokens,
      estimatedRemainingUsd,
      spentUsd,
      budgetUsd,
      apiBatches: batches.length,
      largestInputTokens: Math.max(0, ...missing.map((d) => d.tokens)),
      modelId: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      tokenizer: tokenizerProvenance,
      policy:
        "Full texts, document input type, token-bounded batches, 15-second request spacing, no truncation/retries/provider fallback. Billing may differ from local tokenizer counts.",
    };
    await atomicJson(join(directory, "latest-plan.json"), plan);
    console.log(JSON.stringify(plan, null, 2));
    if (!run && !mock) return;
    assert.ok(
      spentUsd + estimatedRemainingUsd <= budgetUsd,
      "Estimated rollout exceeds budget; no new requests sent",
    );
    if (run)
      assert.ok(process.env.AI_GATEWAY_API_KEY, "AI_GATEWAY_API_KEY required");
    await importVectors(documents, vectors);
    const gateway = createGateway({
      apiKey: mock ? "mock-only" : process.env.AI_GATEWAY_API_KEY,
      ...(mock
        ? {
            fetch: (async (_url, init) => {
              assert.equal(
                new Headers(init?.headers).get("ai-model-id"),
                EMBEDDING_MODEL,
              );
              const body = JSON.parse(String(init?.body));
              assert.ok(body.values.length <= 128);
              assert.deepEqual(body.providerOptions, {
                voyage: {
                  inputType: "document",
                  outputDimension: 1024,
                  outputDtype: "float",
                  truncation: false,
                },
                gateway: { only: ["voyage"] },
              });
              return Response.json({
                embeddings: body.values.map(() =>
                  Array.from({ length: 1024 }, (_, i) => (i === 0 ? 1 : 0)),
                ),
                usage: { tokens: body.values.length },
                providerMetadata: { gateway: { cost: "0", mock: true } },
              });
            }) as typeof fetch,
          }
        : {}),
    });
    let newRequests = 0;
    for (const batch of batches) {
      if (newRequests >= maxNewRequests) break;
      const estimate =
        (batch.reduce((sum, d) => sum + d.tokens + TOKEN_MARGIN_PER_INPUT, 0) *
          PRICE_PER_MILLION) /
        1e6;
      assert.ok(
        spentUsd + estimate <= budgetUsd,
        "Next request exceeds remaining budget",
      );
      if (!mock) await wait(Math.max(0, 15000 - (Date.now() - lastStartedAt)));
      const id = createHash("sha256")
        .update(batch.map((d) => d.key).join(","))
        .digest("hex");
      const startedAt = new Date().toISOString();
      lastStartedAt = Date.now();
      const marker = await open(join(directory, `${id}.inflight`), "wx", 0o600);
      await marker.writeFile(
        JSON.stringify({
          id,
          startedAt,
          keys: batch.map((d) => d.key),
          estimatedUsd: estimate,
        }),
      );
      await marker.close();
      newRequests++;
      console.log(
        JSON.stringify({
          event: "request-started",
          request: newRequests,
          documents: batch.length,
          inputTokens: batch.reduce((s, d) => s + d.tokens, 0),
          estimatedUsd: estimate,
        }),
      );
      const result = await embedMany({
        model: gateway.embeddingModel(EMBEDDING_MODEL),
        values: batch.map((d) => d.text),
        maxRetries: 0,
        maxParallelCalls: 1,
        abortSignal: AbortSignal.timeout(90000),
        providerOptions: {
          voyage: {
            inputType: "document",
            outputDimension: EMBEDDING_DIMENSIONS,
            outputDtype: "float",
            truncation: false,
          },
          gateway: { only: ["voyage"] },
        },
      });
      assert.equal(
        result.embeddings.length,
        batch.length,
        "Missing/reordered response vectors",
      );
      result.embeddings.forEach(validateEmbedding);
      const saved = batch.map((d, i) => ({
        key: d.key,
        recipe: d.recipe,
        text: d.text,
        modelId: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
        inputType: "document" as const,
        embedding: result.embeddings[i],
      }));
      // The durable response is saved BEFORE DB writes or another provider call.
      await atomicJson(join(directory, `${id}.response.json`), {
        id,
        startedAt,
        mock,
        vectors: saved,
        usage: result.usage,
        providerMetadata: result.providerMetadata,
        warnings: result.warnings,
      });
      const receipt: Receipt = {
        id,
        startedAt,
        completedAt: new Date().toISOString(),
        mock,
        vectors: saved,
        usage: result.usage,
        providerMetadata: result.providerMetadata,
        reportedCostUsd: cost(result.providerMetadata),
        warnings: result.warnings,
      };
      await atomicJson(join(directory, `${id}.receipt.json`), receipt);
      assert.ok(
        !result.warnings?.length,
        "Provider warning; receipt saved, stop for manual review",
      );
      spentUsd += receipt.reportedCostUsd;
      assert.ok(
        spentUsd <= budgetUsd,
        "Reported cost exceeds budget; stopping immediately",
      );
      for (const v of saved) vectors.set(v.key, v);
      await unlink(join(directory, `${id}.inflight`));
      await importVectors(
        documents.filter((d) => saved.some((v) => v.key === d.key)),
        vectors,
      );
      console.log(
        JSON.stringify({
          event: "request-completed",
          documents: batch.length,
          usage: result.usage,
          reportedCostUsd: receipt.reportedCostUsd,
          totalReportedCostUsd: spentUsd,
          completedUniqueVectors: unique.filter((d) => vectors.has(d.key))
            .length,
          totalUniqueVectors: unique.length,
        }),
      );
    }
    const current = await collect(rollout.companySlugs);
    assert.deepEqual(
      current.documents.map((d) => d.key).sort(),
      documents.map((d) => d.key).sort(),
      "Source content changed during rollout; inspect before declaring complete",
    );
    const summary = {
      ...plan,
      completedUniqueVectors: unique.filter((d) => vectors.has(d.key)).length,
      remainingUniqueVectors: unique.filter((d) => !vectors.has(d.key)).length,
      newRequests,
      totalReportedCostUsd: spentUsd,
      importedCompanyRecords: mock
        ? 0
        : documents.filter((d) => d.kind === "company" && vectors.has(d.key))
            .length,
      importedJobRecords: mock
        ? 0
        : documents.filter((d) => d.kind === "job" && vectors.has(d.key))
            .length,
      complete: unique.every((d) => vectors.has(d.key)),
      completedAt: new Date().toISOString(),
      note: mock
        ? "MOCK ONLY: no provider calls or DB writes"
        : "Vectors saved and imported; verify live coverage before marking manifest complete.",
    };
    await atomicJson(join(directory, "latest-results.json"), summary);
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    if (lock) {
      await lock.close();
      await unlink(join(root, mock ? "mock-run.lock" : "run.lock"));
    }
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Embedding rollout failed",
  );
  console.error(
    "Stopped. Completed vectors are saved. Inspect Gateway billing and unresolved inflight markers before rerunning. No automatic provider retry.",
  );
  process.exitCode = 1;
});
