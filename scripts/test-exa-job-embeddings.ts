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
import { setTimeout as wait } from "node:timers/promises";
import { cosineSimilarity, createGateway, embedMany } from "ai";
import { sql } from "drizzle-orm";
import { db } from "../lib/db/client";

const modelId = "voyage/voyage-4-large";
const dimensions = 1024;
const recipe = "job-description-canary-v1";
const directory = join(process.cwd(), ".cache", "embedding-canary", "exa-jobs");
const args = new Set(process.argv.slice(2));
assert.ok(
  [...args].every((arg) => ["--run", "--mock", "--dry-run"].includes(arg)),
  "Unknown option",
);
assert.ok(
  !(args.has("--run") && args.has("--mock")),
  "Live and mock modes are exclusive",
);
const mock = args.has("--mock");
const live = args.has("--run");
const searches = [
  "Engineering roles building distributed data infrastructure and large-scale storage systems",
  "Research roles training and improving machine learning models for retrieval",
  "Sales roles owning customer relationships and closing enterprise deals",
  "Design roles creating visual brand identities and marketing assets",
  "Registered nurse providing bedside patient care in a hospital",
];
type Job = {
  id: string;
  title: string;
  status: string;
  location: string;
  url: string | null;
  focus: string;
  department: string | null;
  skills: string[];
  description: string;
};

const gateway = createGateway({
  apiKey: mock ? "mock-only" : process.env.AI_GATEWAY_API_KEY,
  ...(mock
    ? {
        fetch: (async (_url, init) => {
          assert.equal(new Headers(init?.headers).get("ai-model-id"), modelId);
          const body = JSON.parse(String(init?.body));
          assert.ok(body.values.length <= 16);
          assert.equal(body.providerOptions.voyage.outputDimension, dimensions);
          assert.equal(body.providerOptions.voyage.truncation, false);
          assert.equal(body.providerOptions.voyage.outputDtype, "float");
          assert.ok(
            ["document", "query"].includes(
              body.providerOptions.voyage.inputType,
            ),
          );
          assert.deepEqual(body.providerOptions.gateway.only, ["voyage"]);
          return Response.json({
            embeddings: body.values.map(() =>
              Array.from({ length: dimensions }, (_, i) => (i === 0 ? 1 : 0)),
            ),
            usage: { tokens: body.values.length },
            providerMetadata: { gateway: { cost: "0", mock: true } },
          });
        }) as typeof fetch,
      }
    : {}),
});

function fingerprint(text: string, inputType: string) {
  return createHash("sha256")
    .update(JSON.stringify({ modelId, dimensions, recipe, inputType, text }))
    .digest("hex");
}
function validate(vector: number[]) {
  assert.equal(vector.length, dimensions);
  assert.ok(vector.every(Number.isFinite));
  assert.ok(vector.some((v) => v !== 0));
}

async function main() {
  const jobs = (
    await db.execute(sql`SELECT j.id,j.title,j.status,j.location,j.url,j.focus,j.department,j.skills,j.description
    FROM jobs j JOIN companies c ON c.id=j.company_id WHERE c.slug=${"exa"} ORDER BY j.title,j.location,j.id`)
  ).rows as Job[];
  assert.ok(
    jobs.length > 0 && jobs.length <= 80,
    "Unexpected Exa job count; inspect before spending",
  );
  assert.ok(
    jobs.every(
      (j) => typeof j.description === "string" && j.description.trim(),
    ),
    "Missing job description",
  );
  // IDs, status and location remain result metadata, not semantic evidence.
  // They are deliberately excluded from cache identities to survive imports.
  const texts = jobs.map(
    (j) =>
      `Company: Exa\nTitle: ${j.title}\nTeam: ${j.department ?? j.focus}\nSkills: ${j.skills.join(", ")}\nDescription:\n${j.description}`,
  );
  const values = [...texts, ...searches];
  assert.ok(
    values.every((t) => Buffer.byteLength(t) <= 20000),
    "Unexpectedly long input; no silent truncation",
  );
  const totalBytes = values.reduce((n, t) => n + Buffer.byteLength(t), 0);
  // Conservative planning envelope, not an exact tokenizer count or billing
  // guarantee. Includes generous room for provider-added task prompts.
  const planningEnvelopeUsd =
    ((totalBytes + values.length * 1024) * 0.12) / 1e6;
  assert.ok(
    planningEnvelopeUsd <= 0.05,
    "Pilot exceeds the five-cent planning envelope",
  );
  console.log(
    JSON.stringify(
      {
        mode: mock ? "mock" : live ? "live" : "dry-run",
        company: "exa",
        jobs: jobs.length,
        uniqueDocuments: new Set(texts.map((t) => fingerprint(t, "document")))
          .size,
        statusCounts: jobs.reduce<Record<string, number>>((a, j) => {
          a[j.status] = (a[j.status] ?? 0) + 1;
          return a;
        }, {}),
        totalUtf8Bytes: totalBytes,
        planningEnvelopeUsd,
        modelId,
        dimensions,
        automaticRetries: 0,
        note: "Planning envelope is not a measured token count. No confirmed-open assumption. No pgvector migration.",
      },
      null,
      2,
    ),
  );
  if (!mock && !live) return;
  if (live)
    assert.ok(process.env.AI_GATEWAY_API_KEY, "AI_GATEWAY_API_KEY required");
  let lock;
  if (live) {
    await mkdir(directory, { recursive: true });
    lock = await open(join(directory, "run.lock"), "wx", 0o600);
  }
  const vectors = new Map<string, number[]>();
  const paidCalls: unknown[] = [];
  let newRequests = 0;
  let lastRequestStartedAt = 0;
  try {
    if (live)
      assert.ok(
        !(await readdir(directory)).some((name) => name.endsWith(".inflight")),
        "Unresolved prior request. Inspect its billing before continuing.",
      );
    for (const inputType of ["document", "query"] as const) {
      const inputs = [...new Set(inputType === "document" ? texts : searches)];
      const missing: string[] = [];
      for (const text of inputs) {
        const key = fingerprint(text, inputType);
        if (live) {
          try {
            const saved = JSON.parse(
              await readFile(join(directory, `${key}.json`), "utf8"),
            );
            assert.equal(saved.key, key);
            assert.equal(saved.modelId, modelId);
            assert.equal(saved.dimensions, dimensions);
            assert.equal(saved.recipe, recipe);
            assert.equal(saved.inputType, inputType);
            validate(saved.embedding);
            vectors.set(key, saved.embedding);
            continue;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          }
        }
        missing.push(text);
      }
      // Bound BOTH number of texts and total input size, independently of the
      // Gateway adapter's advertised batch capacity (2048, larger than Voyage's).
      while (missing.length) {
        const batch: string[] = [];
        let bytes = 0;
        while (
          missing.length &&
          batch.length < 16 &&
          bytes + Buffer.byteLength(missing[0]) <= 50000
        ) {
          const text = missing.shift()!;
          batch.push(text);
          bytes += Buffer.byteLength(text);
        }
        assert.ok(batch.length > 0);
        const batchId = createHash("sha256")
          .update(batch.map((t) => fingerprint(t, inputType)).join(","))
          .digest("hex");
        const marker = join(directory, `${batchId}.inflight`);
        if (live) {
          // A failed/timed-out batch keeps this marker. Do not spend again on
          // an ambiguous outcome without inspecting its Gateway billing first.
          const file = await open(marker, "wx", 0o600);
          await file.writeFile(
            JSON.stringify({
              inputType,
              hashes: batch.map((t) => fingerprint(t, inputType)),
              startedAt: new Date().toISOString(),
            }),
          );
          await file.close();
        }
        // Free Gateway tier reported 5 requests/minute for this model.
        // Pace this process; other clients can still consume the shared quota.
        if (live)
          await wait(Math.max(0, 13000 - (Date.now() - lastRequestStartedAt)));
        lastRequestStartedAt = Date.now();
        newRequests++;
        const result = await embedMany({
          model: gateway.embeddingModel(modelId),
          values: batch,
          providerOptions: {
            voyage: {
              inputType,
              outputDimension: dimensions,
              outputDtype: "float",
              truncation: false,
            },
            gateway: { only: ["voyage"] },
          },
          maxRetries: 0,
          maxParallelCalls: 1,
          abortSignal: AbortSignal.timeout(90000),
        });
        assert.equal(
          result.embeddings.length,
          batch.length,
          "Missing response embeddings",
        );
        result.embeddings.forEach(validate);
        for (let i = 0; i < batch.length; i++) {
          const key = fingerprint(batch[i], inputType);
          const embedding = result.embeddings[i];
          if (live) {
            const path = join(directory, `${key}.json`);
            await writeFile(
              `${path}.pending`,
              JSON.stringify({
                key,
                modelId,
                dimensions,
                recipe,
                inputType,
                embedding,
              }),
              { mode: 0o600 },
            );
            await rename(`${path}.pending`, path);
          }
          vectors.set(key, embedding);
        }
        const receipt = {
          inputType,
          texts: batch.length,
          usage: result.usage,
          providerMetadata: result.providerMetadata,
        };
        paidCalls.push(receipt);
        if (live) {
          await writeFile(
            join(directory, `${batchId}.receipt.json`),
            JSON.stringify(receipt),
            { mode: 0o600 },
          );
          await unlink(marker);
        }
        assert.ok(
          !result.warnings?.length,
          "Unexpected provider warning; stop before further spending",
        );
        console.log(JSON.stringify({ batchCompleted: true, ...receipt }));
      }
    }
    const comparisons = searches.map((query) => {
      const q = vectors.get(fingerprint(query, "query"))!;
      const ranked = jobs
        .map((job, i) => ({
          id: job.id,
          title: job.title,
          status: job.status,
          location: job.location,
          url: job.url,
          score: cosineSimilarity(
            q,
            vectors.get(fingerprint(texts[i], "document"))!,
          ),
        }))
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
      return { query, topMatches: ranked.slice(0, 5) };
    });
    if (!mock) {
      const expectedTopTitles = [
        "Software Engineer, Distributed Data Systems",
        "Research, ML",
        "Account Executive",
        "Brand Designer",
      ];
      expectedTopTitles.forEach((title, i) =>
        assert.equal(
          comparisons[i].topMatches[0].title,
          title,
          `Unexpected top match for query ${i}`,
        ),
      );
      assert.ok(
        comparisons[4].topMatches[0].score <
          Math.min(
            ...comparisons.slice(0, 4).map((c) => c.topMatches[0].score),
          ),
        "Unrelated query scores above a relevant query",
      );
    }
    let totalCachedReportedCostUsd = 0;
    if (live) {
      for (const file of (await readdir(directory)).filter((name) =>
        name.endsWith(".receipt.json"),
      )) {
        const receipt = JSON.parse(
          await readFile(join(directory, file), "utf8"),
        );
        totalCachedReportedCostUsd += Number(
          receipt.providerMetadata?.gateway?.cost ?? 0,
        );
      }
    }
    const summary = {
      totalCachedReportedCostUsd,
      jobs: jobs.length,
      uniqueDocuments: new Set(texts.map((t) => fingerprint(t, "document")))
        .size,
      newRequests,
      newReportedCostUsd: paidCalls.reduce<number>(
        (sum, receipt) =>
          sum +
          Number(
            (receipt as { providerMetadata?: { gateway?: { cost?: string } } })
              .providerMetadata?.gateway?.cost ?? 0,
          ),
        0,
      ),
      comparisons,
      note: "Scores are not probabilities; unsupported searches still have nearest neighbors. All job statuses are preserved. Local vectors only.",
    };
    if (live)
      await writeFile(
        join(directory, "latest-results.json"),
        JSON.stringify(summary, null, 2),
        { mode: 0o600 },
      );
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    if (lock) {
      await lock.close();
      await unlink(join(directory, "run.lock"));
    }
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Pilot failed");
  console.error(
    "No automatic retries. Inspect billing and inflight markers before retrying a failed live batch.",
  );
  process.exitCode = 1;
});
