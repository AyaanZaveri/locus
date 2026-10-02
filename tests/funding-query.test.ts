import assert from "node:assert/strict";
import { test } from "node:test";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import {
  buildFundingQuery,
  fundingQueryResult,
  fundingQuerySchema,
} from "../lib/ai/funding-query";

test("validates dates, ranges, bounded limits and numeric amounts", () => {
  for (const input of [
    { announcedAfter: "yesterday" },
    { announcedAfter: "2026-02-30" },
    { announcedAfter: "2026-10-02", announcedBefore: "2026-10-01" },
    { minimumAmount: -1 },
    { limit: 51 },
    { sortBy: "relevance" },
  ])
    assert.equal(fundingQuerySchema.safeParse(input).success, false);
  assert.deepEqual(fundingQuerySchema.parse({}), {
    sortBy: "announcedAt",
    limit: 10,
  });
});

test("user filters remain parameters, including literal investor wildcards", () => {
  const investor = "O'Reilly_%'; DROP TABLE companies;--";
  const query = new PgDialect().sqlToQuery(
    buildFundingQuery(
      fundingQuerySchema.parse({ investor, minimumAmount: 10 }),
      "2026-10-02",
    ),
  );
  assert.ok(!query.sql.includes(investor));
  assert.ok(query.params.includes(investor));
  assert.match(query.sql, /strpos/);
});

test("result metadata distinguishes a limited preview from all matches", () => {
  const output = fundingQueryResult(
    [
      {
        slug: "one",
        amount: "4000000",
        total_matches: "3",
        announced_at: "2026-10-01",
      },
    ],
    fundingQuerySchema.parse({ limit: 1 }),
    "2026-10-02",
  );
  assert.equal(output.hasMore, true);
  assert.equal(output.totalMatches, 3);
  assert.equal(output.rounds[0].amount.amount, 4000000);
  assert.equal(
    fundingQueryResult([], fundingQuerySchema.parse({}), "2026-10-02").hasMore,
    false,
  );
});

const url = process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;
test(
  "real PostgreSQL: recent ties, dates, amounts, investor and combined filters",
  { skip: !url },
  async () => {
    const db = drizzle({ client: neon(url!) });
    const round = (
      id: string,
      announcedAt: string | null,
      amount: number,
      extra = {},
    ) => ({
      id,
      announcedAt,
      stage: "Seed",
      amount: { amount, currency: "USD", display: `$${amount}` },
      leadInvestors: [{ name: "Norwest" }],
      investors: [{ name: "a16z" }],
      sourceUrl: "https://example.com/round",
      ...extra,
    });
    const fixtures = [
      [
        "a",
        "Alpha",
        [round("a1", "2026-10-01", 30), round("a0", "2026-09-01", 5)],
      ],
      ["b", "Beta", [round("b1", "2026-10-01", 20, { stage: "Series A" })]],
      ["c", "Future", [round("c1", "2026-10-03", 100)]],
      ["d", "Undated", [round("d1", null, 50), round("d2", "2026-09", 60)]],
      ["e", "Empty", []],
    ] as const;
    const source = sql`(VALUES ${sql.join(
      fixtures.map(
        ([slug, name, rounds]) =>
          sql`(${slug}::text, ${name}::text, ${JSON.stringify({ funding: { rounds } })}::jsonb)`,
      ),
      sql`, `,
    )}) AS c(slug, name, profile)`;
    const run = async (input: Record<string, unknown>) => {
      const parsed = fundingQuerySchema.parse(input);
      const result = await db.execute(
        buildFundingQuery(parsed, "2026-10-02", source),
      );
      return fundingQueryResult(result.rows, parsed, "2026-10-02");
    };
    const recent = await run({ announcedAfter: "2026-09-25" });
    assert.deepEqual(
      recent.rounds.map((r) => r.slug),
      ["a", "b"],
    );
    assert.ok(recent.rounds.every((r) => r.announcedAt === "2026-10-01"));
    const combined = await run({
      announcedAfter: "2026-10-01",
      announcedBefore: "2026-10-01",
      stage: "seed",
      investor: "NORWEST",
      minimumAmount: 25,
      companySlug: "a",
    });
    assert.deepEqual(
      combined.rounds.map((r) => r.roundId),
      ["a1"],
    );
    assert.equal((await run({ investor: "a16z" })).totalMatches, 3);
    assert.equal((await run({ investor: "_%" })).totalMatches, 0);
    assert.equal((await run({ announcedAfter: "2026-10-02" })).totalMatches, 0);
    const largest = await run({ sortBy: "amount", limit: 1 });
    assert.equal(largest.rounds[0].roundId, "d2");
    assert.equal(largest.hasMore, true);
    assert.equal(largest.totalMatches, 5);
  },
);
