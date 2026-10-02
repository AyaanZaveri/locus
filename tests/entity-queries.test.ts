import assert from "node:assert/strict";
import { test } from "node:test";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  buildCompaniesQuery,
  buildPeopleQuery,
  buildActivityQuery,
  companiesQuerySchema,
  peopleQuerySchema,
  activityQuerySchema,
  companiesQueryResult,
  peopleQueryResult,
  activityQueryResult,
} from "../lib/ai/entity-queries";
import {
  companySource,
  peopleSource,
  fixtureCompanies,
} from "./query-fixtures";

test("structured query schemas validate bounds, dates, limits and types", () => {
  for (const input of [
    { minimumEmployees: 50, maximumEmployees: 10 },
    { foundedAfter: 2025, foundedBefore: 2020 },
    { minimumTotalFunding: -1 },
    { limit: 51 },
    { companySlugs: [] },
  ])
    assert.equal(companiesQuerySchema.safeParse(input).success, false);
  assert.equal(
    activityQuerySchema.safeParse({ after: "2026-02-30" }).success,
    false,
  );
  assert.equal(
    activityQuerySchema.safeParse({ after: "2026-10-02", before: "2026-10-01" })
      .success,
    false,
  );
  assert.equal(
    peopleQuerySchema.safeParse({ isFounder: "yes" }).success,
    false,
  );
});

test("all builders parameterize user filters and literal wildcard characters", () => {
  const hostile = "_%'; DROP TABLE people;--";
  const statements = [
    buildCompaniesQuery(companiesQuerySchema.parse({ location: hostile })),
    buildPeopleQuery(peopleQuerySchema.parse({ role: hostile })),
    buildActivityQuery(
      activityQuerySchema.parse({ query: hostile }),
      "2026-10-02",
    ),
  ];
  for (const statement of statements) {
    const result = new PgDialect().sqlToQuery(statement);
    assert.ok(!result.sql.includes(hostile));
    assert.ok(result.params.includes(hostile));
  }
});

test("query results expose counts and honest unknown fields without full profiles", () => {
  const result = companiesQueryResult(
    [
      {
        slug: "x",
        total_matches: "3",
        employee_count: "unknown",
        employee_min: null,
        employee_max: null,
        total_funding: null,
      },
    ],
    companiesQuerySchema.parse({ limit: 1 }),
  );
  assert.equal(result.hasMore, true);
  assert.equal(result.companies[0].employees.minimum, null);
  assert.equal(result.companies[0].totalFunding.amount, null);
  assert.equal("profile" in result.companies[0], false);
  assert.equal(
    peopleQueryResult([], peopleQuerySchema.parse({})).totalMatches,
    0,
  );
});

const url = process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;
test(
  "real PostgreSQL company filters: bounded employee ranges, totals, years and limits",
  { skip: !url },
  async () => {
    const db = drizzle({ client: neon(url!) });
    const run = async (input: Record<string, unknown>) => {
      const parsed = companiesQuerySchema.parse(input);
      return companiesQueryResult(
        (
          await db.execute(
            buildCompaniesQuery(parsed, companySource(fixtureCompanies)),
          )
        ).rows,
        parsed,
      );
    };
    assert.deepEqual(
      (await run({ maximumEmployees: 50 })).companies.map((r) => r.slug),
      ["alpha", "epsilon"],
    );
    assert.deepEqual(
      (await run({ minimumEmployees: 200 })).companies.map((r) => r.slug),
      ["beta", "gamma"],
    );
    assert.equal(
      (await run({ minimumEmployees: 20, maximumEmployees: 50 })).totalMatches,
      0,
    );
    assert.deepEqual(
      (
        await run({
          industry: "database",
          location: "San Francisco",
          minimumTotalFunding: 10_000_000,
          foundedAfter: 2024,
        })
      ).companies.map((r) => r.slug),
      ["alpha"],
    );
    const ranked = await run({
      minimumTotalFunding: 1,
      sortBy: "totalFunding",
      limit: 1,
    });
    assert.equal(ranked.companies[0].slug, "beta");
    assert.equal(ranked.totalMatches, 2);
    assert.equal(ranked.hasMore, true);
    assert.equal((await run({ location: "_%" })).totalMatches, 0);
    assert.deepEqual(
      (await run({ query: "Postgres" })).companies.map((r) => r.slug),
      ["alpha"],
    );
    assert.deepEqual(
      (await run({ companySlugs: ["gamma"], countryCode: "ca" })).companies.map(
        (r) => r.slug,
      ),
      ["gamma"],
    );
  },
);

test(
  "real PostgreSQL people filters: CTO aliases, founder flag and company context",
  { skip: !url },
  async () => {
    const db = drizzle({ client: neon(url!) });
    const fixtures = [
      {
        id: "1",
        company_id: "a",
        name: "Alice",
        role: "Co-Founder & CTO",
        is_founder: false,
        linkedin: "https://example.com/alice",
      },
      {
        id: "2",
        company_id: "b",
        name: "Bob",
        role: "Chief Technology Officer",
        is_founder: false,
      },
      {
        id: "3",
        company_id: "a",
        name: "Director",
        role: "Director of Brand",
        is_founder: false,
      },
      {
        id: "4",
        company_id: "d",
        name: "Unknown",
        role: "Engineer",
        is_founder: null,
      },
    ];
    const run = async (input: Record<string, unknown>) => {
      const parsed = peopleQuerySchema.parse(input);
      return peopleQueryResult(
        (
          await db.execute(
            buildPeopleQuery(
              parsed,
              peopleSource(
                fixtures,
                fixtureCompanies.map((company) => ({
                  ...company,
                  profile: {
                    ...company.profile,
                    people: fixtures
                      .filter((person) => person.company_id === company.id)
                      .map((person) => ({
                        name: person.name,
                        role: person.role,
                        isFounder: person.is_founder,
                      })),
                  },
                })),
              ),
            ),
          )
        ).rows,
        parsed,
      );
    };
    assert.deepEqual(
      (await run({ role: "CTO", industry: "Database" })).people.map(
        (p) => p.name,
      ),
      ["Alice", "Bob"],
    );
    const founder = await run({
      role: "CTO",
      isFounder: true,
      companySlugs: ["alpha"],
      location: "San Francisco",
    });

    assert.equal(founder.people[0].name, "Alice");
    assert.equal(founder.people[0].url, "https://example.com/alice");
    const preview = await run({ role: "CTO", limit: 1 });
    assert.equal(preview.totalMatches, 2);
    assert.equal(preview.hasMore, true);
    assert.equal((await run({ role: "_%" })).totalMatches, 0);
    assert.equal((await run({ isFounder: false })).totalMatches, 2);
  },
);

test(
  "real PostgreSQL activity filters: inclusive dates, future/unknown exclusion and relevance",
  { skip: !url },
  async () => {
    const db = drizzle({ client: neon(url!) });
    const run = async (input: Record<string, unknown>) => {
      const parsed = activityQuerySchema.parse(input);
      return activityQueryResult(
        (
          await db.execute(
            buildActivityQuery(
              parsed,
              "2026-10-02",
              companySource(fixtureCompanies),
            ),
          )
        ).rows,
        parsed,
        "2026-10-02",
      );
    };
    const newest = await run({
      type: "product",
      after: "2026-09-29",
      before: "2026-10-01",
      limit: 1,
    });
    assert.equal(newest.activity[0].slug, "alpha");
    assert.equal(newest.activity[0].sourceUrl, "https://example.com/a");
    assert.equal(newest.totalMatches, 2);
    assert.equal(newest.hasMore, true);
    assert.equal((await run({})).totalMatches, 3);
    assert.deepEqual(
      (await run({ query: "Postgres", sortBy: "relevance" })).activity.map(
        (a) => a.slug,
      ),
      ["alpha"],
    );
    assert.equal(
      (await run({ companySlugs: ["beta"], type: "hiring" })).totalMatches,
      1,
    );
    assert.equal((await run({ after: "2026-10-02" })).totalMatches, 0);
  },
);
