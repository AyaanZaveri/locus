import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { cosineSimilarity, createGateway, embed, embedMany } from "ai";
import { sql } from "drizzle-orm";
import { db } from "../lib/db/client";

// Deliberately restricted canary, not a backfill or publicly callable endpoint.
const modelId = "voyage/voyage-4-large";
const dimensions = 1024;
const recipe = "company-about-canary-v1";
const queries = [
  "Companies providing neural web retrieval APIs for AI agents",
  "Companies manufacturing commercial kitchen equipment",
];
const args = new Set(process.argv.slice(2));
assert.ok(
  [...args].every((arg) => ["--run", "--mock", "--dry-run"].includes(arg)),
  "Unknown option",
);
assert.ok(
  !(args.has("--run") && args.has("--mock")),
  "Mock and live modes cannot be combined",
);
const mock = args.has("--mock");
const live = args.has("--run");
const cacheDirectory = join(process.cwd(), ".cache", "embedding-canary");
let requestCount = 0;

const gateway = createGateway({
  apiKey: mock ? "test-only" : process.env.AI_GATEWAY_API_KEY,
  ...(mock
    ? {
        fetch: (async (_url, init) => {
          assert.equal(new Headers(init?.headers).get("ai-model-id"), modelId);
          const body = JSON.parse(String(init?.body));
          assert.ok(body.values.length <= 2);
          assert.equal(body.providerOptions.voyage.outputDimension, dimensions);
          assert.equal(body.providerOptions.voyage.truncation, false);
          assert.equal(body.providerOptions.voyage.outputDtype, "float");
          assert.deepEqual(body.providerOptions.gateway.only, ["voyage"]);
          assert.ok(
            ["query", "document"].includes(
              body.providerOptions.voyage.inputType,
            ),
          );
          requestCount++;
          return Response.json({
            embeddings: body.values.map((text: string) =>
              Array.from({ length: dimensions }, (_, i) =>
                i === (text.includes("kitchen") ? 1 : 0) ? 1 : 0,
              ),
            ),
            usage: { tokens: body.values.length },
            providerMetadata: { gateway: { cost: "0", mock: true } },
          });
        }) as typeof fetch,
      }
    : {}),
});

function key(value: string, inputType: "document" | "query") {
  return createHash("sha256")
    .update(JSON.stringify({ modelId, dimensions, recipe, inputType, value }))
    .digest("hex");
}

function validate(vector: number[]) {
  assert.equal(
    vector.length,
    dimensions,
    "Incorrect returned vector dimension",
  );
  assert.ok(vector.every(Number.isFinite), "Non-finite vector values");
  assert.ok(
    vector.some((value) => value !== 0),
    "Zero vector",
  );
}

type Saved = {
  modelId: string;
  dimensions: number;
  recipe: string;
  inputType: string;
  textHash: string;
  embedding: number[];
  usage?: unknown;
  providerMetadata?: unknown;
};

async function cached(
  value: string,
  inputType: "document" | "query",
): Promise<Saved | null> {
  if (mock) return null;
  try {
    const saved: Saved = JSON.parse(
      await readFile(
        join(cacheDirectory, `${key(value, inputType)}.json`),
        "utf8",
      ),
    );
    assert.equal(saved.modelId, modelId);
    assert.equal(saved.dimensions, dimensions);
    assert.equal(saved.recipe, recipe);
    assert.equal(saved.inputType, inputType);
    assert.equal(saved.textHash, key(value, inputType));
    validate(saved.embedding);
    return saved;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error; // Never silently re-embed a corrupt cache.
  }
}

async function save(
  value: string,
  inputType: "document" | "query",
  embedding: number[],
  result: { usage?: unknown; providerMetadata?: unknown },
) {
  validate(embedding);
  const saved: Saved = {
    modelId,
    dimensions,
    recipe,
    inputType,
    textHash: key(value, inputType),
    embedding,
    usage: result.usage,
    providerMetadata: result.providerMetadata,
  };
  if (!mock) {
    const path = join(cacheDirectory, `${saved.textHash}.json`);
    await writeFile(`${path}.pending`, JSON.stringify(saved), { mode: 0o600 });
    await rename(`${path}.pending`, path);
  }
  return saved;
}

function options(inputType: "document" | "query") {
  return {
    voyage: {
      inputType,
      outputDimension: dimensions,
      outputDtype: "float",
      truncation: false,
    },
    gateway: { only: ["voyage"] },
  };
}

async function main() {
  const { rows } =
    await db.execute(sql`SELECT name, industry, profile->>'tagline' AS tagline,
    profile->>'description' AS description FROM companies WHERE slug = ${"exa"}`);
  assert.equal(rows.length, 1, "Expected exactly one Exa profile");
  const company = rows[0];
  assert.equal(typeof company.description, "string");
  const document = `Company: ${company.name}\nIndustry: ${company.industry}\nTagline: ${company.tagline}\nAbout: ${company.description}`;
  assert.ok(
    Buffer.byteLength(document) <= 2500,
    "Canary text is unexpectedly long",
  );
  assert.ok(queries.every((q) => Buffer.byteLength(q) <= 500));
  console.log(
    JSON.stringify(
      {
        mode: mock ? "mock" : live ? "live" : "dry-run",
        company: "exa",
        modelId,
        dimensions,
        document,
        queries,
        totalUtf8Bytes: Buffer.byteLength(document + queries.join("")),
        maxLiveRequests: 2,
        note: "Exactly one company; two query checks. Dry-run makes no embedding requests. Cache is local, not yet in pgvector.",
      },
      null,
      2,
    ),
  );
  if (!live && !mock) return;
  if (live)
    assert.ok(process.env.AI_GATEWAY_API_KEY, "AI_GATEWAY_API_KEY is required");
  let lock;
  if (live) {
    await mkdir(cacheDirectory, { recursive: true });
    lock = await open(join(cacheDirectory, "exa.lock"), "wx", 0o600);
  }
  try {
    const usage: unknown[] = [];
    let companyVector = await cached(document, "document");
    if (!companyVector) {
      requestCount++;
      const result = await embed({
        model: gateway.embeddingModel(modelId),
        value: document,
        providerOptions: options("document"),
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(60000),
      });
      companyVector = await save(
        document,
        "document",
        result.embedding,
        result,
      );
      assert.ok(
        !result.warnings?.length,
        "Unexpected provider warning; inspect before further requests",
      );
      usage.push({
        kind: "document",
        usage: result.usage,
        providerMetadata: result.providerMetadata,
      });
    }
    const queryVectors = await Promise.all(
      queries.map((q) => cached(q, "query")),
    );
    const missing = queries.filter((_, i) => !queryVectors[i]);
    if (missing.length) {
      requestCount++;
      const result = await embedMany({
        model: gateway.embeddingModel(modelId),
        values: missing,
        providerOptions: options("query"),
        maxRetries: 0,
        maxParallelCalls: 1,
        abortSignal: AbortSignal.timeout(60000),
      });
      assert.equal(result.embeddings.length, missing.length, "Missing vectors");
      result.embeddings.forEach(validate);
      for (let i = 0; i < missing.length; i++) {
        const index = queries.indexOf(missing[i]);
        queryVectors[index] = await save(
          missing[i],
          "query",
          result.embeddings[i],
          result,
        );
      }
      assert.ok(!result.warnings?.length, "Unexpected provider warning");
      usage.push({
        kind: "queries",
        usage: result.usage,
        providerMetadata: result.providerMetadata,
      });
    }
    const comparisons = queries.map((query, i) => ({
      query,
      cosineSimilarity: cosineSimilarity(
        companyVector.embedding,
        queryVectors[i]!.embedding,
      ),
    }));
    console.log(
      JSON.stringify(
        {
          comparisons,
          newUsage: usage,
          newRequests: mock ? requestCount / 2 : requestCount,
          cacheDirectory: live ? cacheDirectory : null,
          note: "Similarities are ranking scores, not probabilities. One-company canary does not establish retrieval quality.",
        },
        null,
        2,
      ),
    );
    assert.ok(
      comparisons[0].cosineSimilarity > comparisons[1].cosineSimilarity,
      "Relevant query did not outperform unrelated query",
    );
  } finally {
    if (lock) {
      await lock.close();
      await unlink(join(cacheDirectory, "exa.lock"));
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Canary failed");
  console.error(
    "No automatic retry. If a live request failed or timed out, inspect Gateway billing before rerunning.",
  );
  process.exitCode = 1;
});
