import assert from "node:assert/strict";
import { test } from "node:test";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  allowsFuzzyCompanyName,
  buildCompanySearchQuery,
  wordStartPattern,
} from "../lib/company-search";

test("short inputs, sentences and pattern characters cannot trigger fuzzy expansion", () => {
  for (const input of [
    "exa",
    "AI",
    "%",
    "_",
    "foo.*",
    "which companies are hiring engineers",
    "a".repeat(41),
  ])
    assert.equal(allowsFuzzyCompanyName(input), false, input);
  for (const input of ["Anthorpic", "evelenlabs", "Mistral AI"])
    assert.equal(allowsFuzzyCompanyName(input), true, input);
  assert.equal(wordStartPattern("a.*(b)"), "(^|[^[:alnum:]])a\\.\\*\\(b\\)");
  const malicious = "x'; DROP TABLE companies;--";
  const built = new PgDialect().sqlToQuery(
    buildCompanySearchQuery(malicious, 3),
  );
  assert.ok(!built.sql.includes(malicious));
  assert.ok(built.params.includes(malicious));
});

test(
  "PostgreSQL: typo recovery, exact-first ranking, literal fallback and deterministic bounds",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const db = drizzle(neon(process.env.DATABASE_URL!));
    const source = sql`(SELECT *, '{}'::jsonb AS profile FROM (VALUES
    ('elevenlabs', 'ElevenLabs', 'Voice AI', 'London', 'gb'),
    ('anthropic', 'Anthropic', 'AI', 'San Francisco', 'us'),
    ('anthropic-tools', 'Anthropic Tools', 'Software', 'London', 'gb'),
    ('exa', 'Exa', 'Search', 'San Francisco', 'us'),
    ('texas', 'Texas Labs', 'Energy', 'Texas', 'us'),
    ('anthorpic-literal', 'Other', 'Anthorpic Analytics', 'Paris', 'fr'),
    ('elevenlabs-ai', 'ElevenLabs AI', 'Voice AI', 'London', 'gb')
  ) AS v(slug, name, industry, location, country_code))`;
    const run = async (query: string, limit = 6) =>
      (await db.execute(buildCompanySearchQuery(query, limit, source))).rows;
    const typo = await run("evelenlabs");
    assert.equal(typo[0].slug, "elevenlabs");
    assert.equal(typo[0].matchType, "fuzzy-name");
    assert.ok(Number(typo[0].matchScore) >= 0.4);
    assert.equal(typo.length, 2); // Do not silently treat the best suggestion as unique.
    assert.deepEqual(
      (await run("ElevenLabs")).map((row) => row.slug),
      ["elevenlabs", "elevenlabs-ai"],
    );
    assert.equal((await run("ELEVENLABS"))[0].matchType, "exact");
    assert.equal((await run("Anthrop"))[0].matchType, "name-prefix");
    assert.equal((await run("anthropic-tools"))[0].slug, "anthropic-tools");
    assert.deepEqual(
      (await run("Anthorpic")).map((row) => row.slug),
      ["anthorpic-literal"],
    );
    assert.deepEqual(
      (await run("exa")).map((row) => row.slug),
      ["exa"],
    );
    for (const q of [
      "%",
      "_",
      ".*",
      "nonsensezzzzz",
      "evelenlabs hiring Canada",
    ])
      assert.deepEqual(await run(q), [], q);
    assert.equal((await run("evelenlabs", 1)).length, 1);
    assert.deepEqual(
      (await run("ex")).map((row) => row.slug),
      ["exa"],
    );
    const nameOnly = sql`(SELECT * FROM ${source} fixture WHERE slug = 'anthropic')`;
    const recovered = (
      await db.execute(buildCompanySearchQuery("Anthorpic", 3, nameOnly))
    ).rows;
    assert.equal(recovered[0].name, "Anthropic");
    assert.equal(recovered[0].matchType, "fuzzy-name");
  },
);
