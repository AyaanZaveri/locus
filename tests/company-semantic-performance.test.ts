import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  semanticCoverageQuery,
  retrieveSemantic,
} from "../lib/ai/semantic-search";
import { EMBEDDING_DIMENSIONS } from "../lib/ai/embedding-config";

test("company coverage and unembedded evidence share one materialized filtered set", () => {
  const base = sql`SELECT 'single-filtered-set' AS slug, 'Company' AS name, 'Tools' AS industry, 'Build' AS tagline, 'Description' AS description`;
  const query = new PgDialect().sqlToQuery(
    semanticCoverageQuery(base, "companies", true),
  );
  assert.equal(query.sql.split("single-filtered-set").length - 1, 1);
  assert.match(query.sql, /coverage AS MATERIALIZED/);
  assert.match(query.sql, /unembedded_candidates/);
  assert.match(query.sql, /WHERE NOT vector_covered/);
  assert.match(query.sql, /LIMIT 5/);
});

test("company semantic retrieval uses two filtered-set queries, not a separate supplement query", async () => {
  const statements: string[] = [];
  const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) =>
    i === 0 ? 1 : 0,
  );
  const unranked = {
    slug: "unranked",
    description: "A relevant product without a vector.",
  };
  const result = await retrieveSemantic(
    sql`SELECT 'single-filtered-set' AS slug`,
    "companies",
    "company product discovery",
    15,
    "relevance",
    { includeUnembeddedCompanies: true },
    {
      execute: async (query) => {
        const compiled = new PgDialect().sqlToQuery(query).sql;
        statements.push(compiled);
        return {
          rows:
            statements.length === 1
              ? [
                  {
                    eligible: 2,
                    embedded: 1,
                    unembedded_candidates: [unranked],
                  },
                ]
              : [{ slug: "ranked", semantic_score: 0.8 }],
        };
      },
      queryEmbedding: async () => ({ vector, cacheHit: true }),
    },
  );
  assert.equal(statements.length, 2);
  assert.match(statements[0], /unembedded_candidates/);
  assert.match(statements[1], /semantic_score/);
  assert.deepEqual(result.unembeddedRows, [unranked]);
  assert.equal(result.rows[0].total_matches, 1);
  assert.equal(result.metadata.eligibleRecords, 2);
  assert.equal(result.metadata.embeddedRecords, 1);
  assert.equal(result.metadata.completeCoverage, false);
});

test("unembedded-only company evidence requires no query embedding or ranking call", async () => {
  let executions = 0;
  const result = await retrieveSemantic(
    sql`SELECT 'missing' AS slug`,
    "companies",
    "discovery",
    15,
    "relevance",
    { includeUnembeddedCompanies: true },
    {
      execute: async () => {
        executions++;
        return {
          rows: [
            {
              eligible: 1,
              embedded: 0,
              unembedded_candidates: [{ slug: "missing" }],
            },
          ],
        };
      },
      queryEmbedding: async () => {
        throw new Error("Embedding must not be requested");
      },
    },
  );
  assert.equal(executions, 1);
  assert.equal(result.metadata.queryEmbeddingRequested, false);
  assert.deepEqual(result.unembeddedRows, [{ slug: "missing" }]);
  assert.deepEqual(result.rows, []);
});
