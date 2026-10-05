import assert from "node:assert/strict";
import { test } from "node:test";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { buildJobSearchQuery } from "../lib/job-search";

test("job search parameterizes input and escapes LIKE metacharacters", () => {
  const query = "100%_backend";
  const built = new PgDialect().sqlToQuery(buildJobSearchQuery(query, 7));
  assert.ok(!built.sql.includes(query));
  assert.ok(built.params.includes(query));
  assert.ok(
    built.params.some((param) => String(param).includes("100\\%\\_backend")),
  );
  assert.ok(!built.sql.includes("similarity(j.search_text"));
  assert.ok(!built.sql.includes("similarity(j.description"));
});

test(
  "PostgreSQL: title-first ranking, typo recovery, status, company and stable limit",
  {
    skip: !process.env.DATABASE_URL,
  },
  async () => {
    const db = drizzle(neon(process.env.DATABASE_URL!));
    const companies = sql`(SELECT id, slug, name, country_code, profile FROM (VALUES
    ('c1', 'acme', 'Acme', 'us', '{"logo":"acme.png","description":"backend enginer"}'::jsonb),
    ('c2', 'other', 'Other', 'gb', '{"logo":"other.png"}'::jsonb)
  ) v(id, slug, name, country_code, profile))`;
    const jobs = sql`(SELECT * FROM (VALUES
    ('j1', 'c1', 'Backend Engineer', 'Platform', 'New York', 'https://a', 'open', 'backend engineer role'),
    ('j2', 'c2', 'Software Engineer Backend', 'Engineering', 'London', 'https://b', 'unknown', 'general role'),
    ('j3', 'c2', 'Marketing Manager', 'Backend enginer migration', 'Paris', 'https://c', 'open', 'backend enginer mention'),
    ('j4', 'c1', 'Backend Engineer Closed', 'Platform', 'New York', 'https://d', 'closed', 'backend engineer')
  ) v(id, company_id, title, focus, location, url, status, search_text)
  CROSS JOIN LATERAL (SELECT ''::text AS description) d)`;
    const run = async (q: string, limit = 10) =>
      (await db.execute(buildJobSearchQuery(q, limit, jobs, companies))).rows;
    const typo = await run("backend enginer");
    assert.equal(typo[0].title, "Backend Engineer");
    assert.ok(typo.every((row) => row.title !== "Backend Engineer Closed"));
    assert.ok(
      typo.findIndex((row) => row.title === "Software Engineer Backend") <
        typo.findIndex((row) => row.title === "Marketing Manager"),
    );
    assert.equal((await run("Acme"))[0].companyName, "Acme");
    assert.deepEqual(
      (await run("backend enginer", 2)).map((row) => row.title),
      (await run("backend enginer", 2)).map((row) => row.title),
    );
  },
);
