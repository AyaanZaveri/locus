import assert from "node:assert/strict";
import { test } from "node:test";
import { sql, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import {
  EMBEDDING_DIMENSIONS,
  validateEmbedding,
  embeddingKey,
  QUERY_EMBEDDING_RECIPE,
  COMPANY_EMBEDDING_RECIPE,
  companyEmbeddingText,
} from "../lib/ai/embedding-config";
import {
  buildJobsQuery,
  jobsQueryResult,
  jobsQuerySchema,
} from "../lib/ai/jobs-query";
import {
  companyDiscoverySchema,
  buildCompanyDiscoveryQuery,
} from "../lib/ai/company-discovery";

const url = process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;
process.env.DATABASE_URL ??= "postgresql://offline:offline@localhost/offline";
const {
  semanticCoverageQuery,
  semanticRankingQuery,
  semanticSource,
  queryEmbedding,
  queryEmbeddingSettings,
  retrieveSemantic,
  semanticResult,
} = await import("../lib/ai/semantic-search");
const dialect = new PgDialect();
const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) =>
  i === 0 ? 1 : 0,
);
const cachedQuery =
  "Engineering roles building distributed data infrastructure and large-scale storage systems";

test("company industry edits change the embedding key even when the About text is unchanged", () => {
  const company = {name:"HiringCafe",industry:"Web Search",tagline:"Not just another job board",description:"AI-powered job discovery and matching."};
  const before = companyEmbeddingText(company);
  const after = companyEmbeddingText({...company,industry:"Job Search"});
  assert.notEqual(before, after);
  assert.notEqual(embeddingKey(before,"document",COMPANY_EMBEDDING_RECIPE), embeddingKey(after,"document",COMPANY_EMBEDDING_RECIPE));
  assert.match(after, /Industry: Job Search/);
  assert.equal(before.split("About: ")[1], after.split("About: ")[1]);
});

test("semantic schemas are bounded, optional and strictly validated", () => {
  for (const value of [
    { limit: 0 },
    { limit: 51 },
    { status: "unknown" },
    { unexpected: true },
    { semanticQuery: "" },
    { semanticQuery: "x".repeat(501) },
  ])
    assert.equal(jobsQuerySchema.safeParse(value).success, false);
  assert.ok(jobsQuerySchema.safeParse({ semanticQuery: cachedQuery }).success);
  assert.equal(
    companyDiscoverySchema.safeParse({ semanticQuery: "x".repeat(501) })
      .success,
    false,
  );
  assert.equal(
    companyDiscoverySchema.safeParse({
      semanticQuery: cachedQuery,
      arbitrarySQL: "DROP",
    }).success,
    false,
  );
  assert.equal(
    companyDiscoverySchema.safeParse({ jobs: { semanticQuery: cachedQuery } })
      .success,
    false,
  );
});

test("invalid vectors, truncation, retries and fallback models are prohibited", () => {
  for (const invalid of [
    [],
    [1],
    Array(EMBEDDING_DIMENSIONS).fill(0),
    [NaN],
    [Infinity],
    vector.map((v, i) => (i === 1 ? "bad" : v)),
  ])
    assert.throws(() => validateEmbedding(invalid));
  validateEmbedding(vector);
  assert.equal(queryEmbeddingSettings.maxRetries, 0);
  assert.deepEqual(queryEmbeddingSettings.providerOptions, {
    voyage: {
      inputType: "query",
      outputDimension: 1024,
      outputDtype: "float",
      truncation: false,
    },
    gateway: { only: ["voyage"] },
  });
});

test("semantic SQL parameterizes vectors and preserves filters before ranking/limiting", () => {
  const input = jobsQuerySchema.parse({
    companySlugs: ["exa"],
    title: "O'Reilly_%",
    minimumSalary: 150000,
    status: "openOrUnknown",
    semanticQuery: cachedQuery,
    limit: 1,
  });
  const base = buildJobsQuery(input, "2026-10-04", undefined, [], true);
  const source = dialect.sqlToQuery(semanticSource(base, "jobs", vector));
  assert.ok(!source.sql.includes("O'Reilly_%"));
  assert.ok(source.params.includes("O'Reilly_%"));
  assert.ok(!source.sql.includes(JSON.stringify(vector)));
  assert.ok(source.params.includes(JSON.stringify(vector)));
  assert.match(source.sql, /ec.content_text =/);
  assert.doesNotMatch(source.sql, /job_embeddings/);
  assert.ok(dialect.sqlToQuery(base).sql.trim().endsWith("id"));
  assert.match(
    dialect.sqlToQuery(semanticRankingQuery(base, "jobs", vector, 1, "salary"))
      .sql,
    /salary_minimum::numeric/,
  );
  assert.throws(() =>
    semanticRankingQuery(base, "jobs", vector, 0, "relevance"),
  );
  assert.throws(() => semanticSource(base, "jobs", [1]));
  const output = semanticResult(
    jobsQueryResult(
      [
        {
          title: "Engineer",
          description: "Actual description",
          semantic_score: 0.9,
          embedding: vector,
          total_matches: 52,
        },
      ],
      input,
      "2026-10-04",
    ),
  );
  assert.equal(output.totalCandidates, 52);
  assert.equal("totalMatches" in output, false);
  assert.equal("hasMore" in output, false);
  assert.equal(output.jobs[0].descriptionExcerpt, "Actual description");
  assert.equal(output.jobs[0].semanticScore, 0.9);
  assert.equal("embedding" in output.jobs[0], false);
});

test("query cache hit avoids provider and reservation calls", async () => {
  let calls = 0;
  const result = await queryEmbedding("mock cache hit", {
    execute: async () => {
      calls++;
      return { rows: [{ embedding: JSON.stringify(vector) }] };
    },
    generate: async () => {
      throw new Error("Must not generate");
    },
  });
  assert.equal(result.cacheHit, true);
  assert.equal(calls, 1);
});

test("new queries reserve first, persist receipts and deduplicate concurrent requests", async () => {
  const statements: string[] = [];
  let generated = 0;
  const dependencies = {
    execute: async (query: SQL) => {
      const s = dialect.sqlToQuery(query).sql;
      statements.push(s);
      return {
        rows: s.includes("INSERT INTO embedding_requests")
          ? [{ key: "reserved" }]
          : [],
      };
    },
    generate: async () => {
      generated++;
      return { embedding: vector, usage: { tokens: 4 } };
    },
  };
  const results = await Promise.all([
    queryEmbedding("mock new query", dependencies),
    queryEmbedding("mock new query", dependencies),
  ]);
  assert.equal(generated, 1);
  assert.equal(results[0].cacheHit, false);
  assert.equal(results[1].cacheHit, true);
  assert.match(statements[1], /generate_series\(1,200\)/);
  assert.match(statements[1], /ON CONFLICT DO NOTHING/);
  assert.match(statements[1], /slots.slot/);
  assert.match(statements[2], /INSERT INTO embedding_cache/);
  assert.match(statements[3], /state='complete'/);
});

test("budget-exhausted/reserved keys do not generate; ambiguous failures remain blocked", async () => {
  let generated = 0;
  await assert.rejects(
    queryEmbedding("mock reserved", {
      execute: async () => ({ rows: [] }),
      generate: async () => {
        generated++;
        return { embedding: vector };
      },
    }),
    /reserved/,
  );
  assert.equal(generated, 0);
  for (const [name, fail] of [
    ["timeout", true],
    ["invalid", false],
  ] as const) {
    const statements: string[] = [];
    await assert.rejects(
      queryEmbedding(`mock failure ${name}`, {
        execute: async (query: SQL) => {
          const s = dialect.sqlToQuery(query).sql;
          statements.push(s);
          return {
            rows: s.includes("INSERT INTO embedding_requests")
              ? [{ key: "reserved" }]
              : [],
          };
        },
        generate: async () => {
          if (fail) throw new Error("Ambiguous timeout");
          return { embedding: [1] };
        },
      }),
    );
    assert.ok(statements.some((s) => s.includes("state='failed'")));
    assert.ok(
      !statements.some((s) => s.includes("INSERT INTO embedding_cache")),
    );
    assert.ok(!statements.some((s) => s.includes("DELETE")));
  }
});

test(
  "cached live Exa ranking respects filters, incomplete coverage, stale content and replacement IDs",
  { skip: !url },
  async () => {
    const db = drizzle({ client: neon(url!) });
    const cached = await db.execute(
      sql`SELECT embedding FROM embedding_cache WHERE key=${embeddingKey(cachedQuery, "query", QUERY_EMBEDDING_RECIPE)}`,
    );
    assert.equal(
      cached.rows.length,
      1,
      "Import cached pilot vectors first; never generate in regression tests",
    );
    const q =
      typeof cached.rows[0].embedding === "string"
        ? JSON.parse(cached.rows[0].embedding)
        : cached.rows[0].embedding;
    validateEmbedding(q);
    const input = jobsQuerySchema.parse({
      companySlugs: ["exa"],
      status: "openOrUnknown",
      limit: 3,
    });
    const base = buildJobsQuery(input, "2026-10-04", undefined, [], true);
    const coverage = (await db.execute(semanticCoverageQuery(base, "jobs")))
      .rows[0];
    assert.equal(Number(coverage.eligible), 52);
    assert.equal(Number(coverage.embedded), 52);
    assert.equal(Number(coverage.company_matches), 1);
    const rows = (
      await db.execute(semanticRankingQuery(base, "jobs", q, 3, "relevance"))
    ).rows;
    assert.equal(rows.length, 3);
    assert.equal(rows[0].title, "Software Engineer, Distributed Data Systems");
    assert.ok(rows.every((r) => r.status === "unknown"));
    assert.ok(rows.every((r) => !("embedding" in r)));
    for (const filters of [
      { status: "open" },
      { minimumSalary: 1e9 },
      { location: "Mars" },
      { skills: ["NONEXISTENT_SKILL_123"] },
      { query: "NONEXISTENT_KEYWORD_123" },
    ]) {
      const strict = buildJobsQuery(
        jobsQuerySchema.parse({ ...input, ...filters }),
        "2026-10-04",
        undefined,
        [],
        true,
      );
      assert.equal(
        (
          await db.execute(
            semanticRankingQuery(strict, "jobs", q, 3, "relevance"),
          )
        ).rows.length,
        0,
      );
    }
    const coverageStartedAt = Date.now();
    const global = (
      await db.execute(
        semanticCoverageQuery(
          buildJobsQuery(
            jobsQuerySchema.parse({ status: "openOrUnknown" }),
            "2026-10-04",
            undefined,
            [],
            true,
          ),
          "jobs",
        ),
      )
    ).rows[0];
    assert.ok(
      Number(global.embedded) >= 52,
      "Exa vectors must remain covered as rollout coverage expands",
    );
    assert.ok(
      Date.now() - coverageStartedAt < 10000,
      "Global coverage regressed: avoid per-job extraction of huge company profiles",
    );
    assert.ok(Number(global.eligible) > 52);
    const replacement = sql`(SELECT (jsonb_populate_record(NULL::jobs, to_jsonb(original) || jsonb_build_object('id',md5(original.id::text)::uuid))).* FROM jobs original) j JOIN companies c ON c.id=j.company_id`;
    const replaced = (
      await db.execute(
        semanticRankingQuery(
          buildJobsQuery(input, "2026-10-04", replacement, [], true),
          "jobs",
          q,
          3,
          "relevance",
        ),
      )
    ).rows;
    assert.equal(replaced[0].title, rows[0].title);
    assert.notEqual(replaced[0].id, rows[0].id);
    const stale = sql`(SELECT (jsonb_populate_record(NULL::jobs, to_jsonb(original) || jsonb_build_object('description',original.description || ' Changed text'))).* FROM jobs original) j JOIN companies c ON c.id=j.company_id`;
    assert.equal(
      Number(
        (
          await db.execute(
            semanticCoverageQuery(
              buildJobsQuery(input, "2026-10-04", stale, [], true),
              "jobs",
            ),
          )
        ).rows[0].embedded,
      ),
      0,
    );
    const partialSource = sql`(SELECT (jsonb_populate_record(NULL::jobs, to_jsonb(original) || jsonb_build_object('description',
      CASE WHEN original.id = (SELECT id FROM jobs WHERE company_id=(SELECT id FROM companies WHERE slug='exa') ORDER BY id LIMIT 1)
      THEN original.description || ' Changed partial fixture' ELSE original.description END))).*
      FROM jobs original WHERE original.company_id=(SELECT id FROM companies WHERE slug='exa')) j JOIN companies c ON c.id=j.company_id`;
    const partial = await retrieveSemantic(
      buildJobsQuery(input, "2026-10-04", partialSource, [], true),
      "jobs",
      cachedQuery,
      3,
      "relevance",
    );
    assert.equal(partial.metadata.eligibleRecords, 52);
    assert.equal(partial.metadata.embeddedRecords, 51);
    assert.equal(partial.metadata.completeCoverage, false);
    assert.equal(partial.metadata.queryCacheHit, true);
    const company = buildCompanyDiscoveryQuery(
      companyDiscoverySchema.parse({ companySlugs: ["exa"] }),
      "2026-10-04",
      undefined,
      true,
    );
    assert.equal(
      Number(
        (await db.execute(semanticCoverageQuery(company, "companies"))).rows[0]
          .embedded,
      ),
      1,
    );
    assert.equal(
      (
        await db.execute(
          semanticRankingQuery(company, "companies", q, 3, "name"),
        )
      ).rows[0].slug,
      "exa",
    );
    const noCoverage = buildJobsQuery(
      jobsQuerySchema.parse({ ...input, status: "open" }),
      "2026-10-04",
      undefined,
      [],
      true,
    );
    const before = (
      await db.execute(sql`SELECT count(*) AS count FROM embedding_requests`)
    ).rows[0].count;
    const none = await retrieveSemantic(
      noCoverage,
      "jobs",
      "NEVER SEND THIS TO PROVIDER",
      3,
      "relevance",
    );
    assert.equal(none.rows.length, 0);
    assert.ok(none.unavailable);
    assert.equal(
      (await db.execute(sql`SELECT count(*) AS count FROM embedding_requests`))
        .rows[0].count,
      before,
    );
  },
);
