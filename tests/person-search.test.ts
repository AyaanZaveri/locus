import assert from "node:assert/strict";
import { test } from "node:test";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { buildPersonSearchQuery } from "../lib/person-search";
import { companyAliasSchema } from "../lib/company-aliases";
import { buildCompanySearchQuery } from "../lib/company-search";

test("person queries parameterize literal patterns; aliases require an evidence URL", () => {
  const query = "A_%'; DROP TABLE people;--";
  const built = new PgDialect().sqlToQuery(buildPersonSearchQuery(query, 3));
  assert.ok(!built.sql.includes(query));
  assert.ok(built.params.includes(query));
  assert.ok(built.params.includes("%A\\_\\%'; DROP TABLE people;--%"));
  assert.equal(
    companyAliasSchema.safeParse({
      companySlug: "vercel",
      name: "ZEIT",
      kind: "former-name",
    }).success,
    false,
  );
  assert.equal(
    companyAliasSchema.safeParse({
      companySlug: "vercel",
      name: "ZEIT",
      kind: "product",
      sourceUrl: "https://example.com",
    }).success,
    false,
  );
});

test(
  "PostgreSQL person names: typos, exact priority, duplicate identities, literal roles, bounds",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const db = drizzle(neon(process.env.DATABASE_URL!));
    const c = sql`(SELECT *, '{}'::jsonb AS profile FROM (VALUES
    ('c1', 'one', 'One', 'us'), ('c2', 'two', 'Two', 'gb')
  ) v(id, slug, name, country_code))`;
    const p = sql`(SELECT *, NULL::text AS image, NULL::text AS linkedin,
    'https://example.com/source'::text AS source_url FROM (VALUES
    ('p1', 'c1', 'Aidan Gomez', 'Founder', 'Aidan Gomez Founder One'),
    ('p2', 'c2', 'Aidan Gomez', 'Engineer', 'Aidan Gomez Engineer Two'),
    ('p3', 'c1', 'Aidan Gomez Smith', 'CTO', 'Aidan Gomez Smith CTO One'),
    ('p4', 'c2', 'Alice Smith', 'CFO', 'Alice Smith CFO Two')
  ) v(id, company_id, name, role, search_text))`;
    const run = async (q: string, limit = 8) =>
      (await db.execute(buildPersonSearchQuery(q, limit, p, c))).rows;
    const typo = await run("Aidan Gmoez");
    assert.equal(typo[0].name, "Aidan Gomez");
    assert.equal(typo[0].matchType, "fuzzy-name");
    assert.equal(typo[1].name, "Aidan Gomez");
    assert.notEqual(typo[0].companySlug, typo[1].companySlug);
    assert.equal(typo[0].sourceUrl, "https://example.com/source");
    const exact = await run("Aidan Gomez");
    assert.equal(exact[0].matchType, "exact-name");
    assert.equal(exact[1].matchType, "exact-name");
    assert.equal(exact[2].matchType, "name-prefix");
    assert.equal((await run("CFO"))[0].role, "CFO");
    assert.equal((await run("CFO"))[0].matchType, "content");
    for (const q of ["%", "_", "zzzzzzzz", "Aidan Gmoez hired on Mars"])
      assert.deepEqual(await run(q), [], q);
    assert.equal((await run("Aidan Gmoez", 1)).length, 1);
  },
);

test(
  "PostgreSQL aliases: canonical priority, shared aliases, duplicates, provenance and literal-only matching",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const db = drizzle(neon(process.env.DATABASE_URL!));
    const source = sql`(SELECT *, '{}'::jsonb AS profile, NULL::uuid AS headquarters_location_id FROM (VALUES
    ('vercel', 'Vercel', 'Tools', 'NYC', 'us'),
    ('zeit', 'ZEIT', 'Software', 'London', 'gb'),
    ('other', 'Other', 'Software', 'Paris', 'fr')
  ) v(slug, name, industry, location, country_code))`;
    const alias = {
      companySlug: "vercel",
      name: "ZEIT",
      kind: "former-name" as const,
      sourceUrl: "https://vercel.com/blog/zeit-is-now-vercel",
    };
    const aliases = [alias, alias, { ...alias, companySlug: "other" }];
    const run = async (q: string, limit = 6) =>
      (await db.execute(buildCompanySearchQuery(q, limit, source, aliases)))
        .rows;
    const rows = await run("zeit");
    assert.equal(rows[0].slug, "zeit");
    assert.equal(rows[0].matchType, "exact");
    assert.equal(rows.length, 3);
    const former = rows.find((row) => row.slug === "vercel")!;
    assert.equal(former.matchType, "alias-exact");
    assert.deepEqual(former.matchedAlias, {
      name: alias.name,
      kind: alias.kind,
      sourceUrl: alias.sourceUrl,
    });
    assert.equal(
      (await run("zei")).find((row) => row.slug === "vercel")!.matchType,
      "alias-prefix",
    );
    assert.equal((await run("zeit", 1))[0].slug, "zeit");
    assert.deepEqual(await run("zet"), []); // no generated or fuzzy alias expansion
  },
);
