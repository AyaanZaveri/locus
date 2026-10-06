import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  buildJobsQuery,
  jobsQueryResult,
  jobsQuerySchema,
} from "../lib/ai/jobs-query";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { jobsSource, fixtureCompanies } from "./query-fixtures";

test("schema bounds and defaults", () => {
  assert.deepEqual(jobsQuerySchema.parse({}), {
    queryScope: "role",
    status: "open",
    sortBy: "relevance",
    limit: 10,
  });
  for (const v of [
    { limit: 0 },
    { limit: 51 },
    { skills: [] },
    { companySlugs: Array(51).fill("x") },
    { status: "maybe" },
  ])
    assert.equal(jobsQuerySchema.safeParse(v).success, false);
});

test("model-facing job filters explain fit intent versus hard constraints", () => {
  const schema = z.toJSONSchema(jobsQuerySchema, { io: "input" });
  for (const [key, field] of Object.entries(schema.properties ?? {})) {
    assert.ok(
      typeof field === "object" && field.description,
      `Missing description: ${key}`,
    );
  }
  assert.match(
    jobsQuerySchema.shape.semanticQuery.description!,
    /best role for me/,
  );
  assert.match(jobsQuerySchema.shape.skills.description!, /HARD AND/);
  assert.match(
    jobsQuerySchema.shape.companySlugs.description!,
    /Verified company slugs/,
  );
  assert.ok(!(schema.required ?? []).includes("semanticQuery"));
  assert.equal(
    jobsQuerySchema.safeParse({ semanticQuery: "x".repeat(501) }).success,
    false,
  );
  assert.equal(
    jobsQuerySchema.safeParse({ semanticQuery: null }).success,
    false,
  );
});

test("filters are parameterized and substring matching is literal", () => {
  const input = jobsQuerySchema.parse({
    title: "O'Reilly_%",
    skills: ["C++"],
    minimumSalary: 100000,
    location: "NY",
  });
  const built = new PgDialect().sqlToQuery(buildJobsQuery(input, "2026-10-02"));
  assert.ok(!built.sql.includes("O'Reilly_%"));
  assert.ok(built.params.includes("O'Reilly_%"));
  assert.match(built.sql, /strpos/);
});

test("result preserves pagination metadata and excludes description", () => {
  const result = jobsQueryResult(
    [
      {
        title: "Engineer",
        description: "secret",
        salary_minimum: "120000",
        total_matches: "3",
      },
    ],
    jobsQuerySchema.parse({ limit: 1 }),
    "2026-10-02",
  );
  assert.equal(result.totalMatches, 3);
  assert.equal(result.hasMore, true);
  assert.equal(result.jobs[0].salary.minimum, 120000);
  assert.equal("description" in result.jobs[0], false);
});

const url = process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;
test(
  "real PostgreSQL job filters compose before limiting; unknowns and salary currencies remain honest",
  { skip: !url },
  async () => {
    const db = drizzle({ client: neon(url!) });
    const base = {
      company_id: "a",
      title: "Backend Engineer",
      focus: "Engineering",
      location: "United States",
      description: "Build PostgreSQL services",
      status: "open",
      workplace_type: "remote",
      employment_type: "full-time",
      skills: ["TypeScript", "Postgres"],
      salary_minimum: 160000,
      salary_maximum: 200000,
      salary_currency: "USD",
      salary_period: "year",
      visa_sponsorship: "available",
      posted_at: "2026-10-01",
      experience_level: "staff",
      accepts_new_grads: false,
    };
    const fixtures = [
      { ...base, id: "1" },
      {
        ...base,
        id: "2",
        company_id: "b",
        salary_minimum: null,
        visa_sponsorship: null,
        posted_at: null,
      },
      { ...base, id: "3", salary_currency: "EUR", salary_minimum: 300000 },
      { ...base, id: "4", salary_period: "month", salary_minimum: 200000 },
      { ...base, id: "5", status: "closed" },
      { ...base, id: "6", status: "unknown" },
      { ...base, id: "7", posted_at: "2026-10-03" },
      { ...base, id: "8", skills: ["Python"], salary_minimum: 100000 },
    ];
    const run = async (input: Record<string, unknown>) => {
      const parsed = jobsQuerySchema.parse(input);
      return jobsQueryResult(
        (
          await db.execute(
            buildJobsQuery(
              parsed,
              "2026-10-02",
              jobsSource(fixtures, fixtureCompanies),
            ),
          )
        ).rows,
        parsed,
        "2026-10-02",
      );
    };
    const combined = await run({
      title: "backend",
      skills: ["typescript", "postgres"],
      companySlugs: ["alpha"],
      workplaceType: "remote",
      minimumSalary: 150000,
      visaSponsorship: "available",
      experienceLevel: "staff",
      employmentType: "full-time",
      department: "Engineering",
    });
    assert.equal(combined.totalMatches, 1);
    assert.equal(combined.totalCompanies, 1);
    assert.deepEqual(combined.companySummaries, [
      { companySlug: "alpha", companyName: "Alpha", jobCount: 1 },
    ]);
    assert.equal(combined.jobs[0].salary.minimum, 160000);
    assert.equal((await run({})).totalMatches, 5);
    assert.equal((await run({ status: "openOrUnknown" })).totalMatches, 6);
    assert.equal((await run({ status: "closed" })).totalMatches, 1);
    assert.equal((await run({ title: "_%" })).totalMatches, 0);
    const preview = await run({ sortBy: "salary", limit: 1 });
    assert.equal(preview.jobs[0].salary.currency, "USD");
    assert.equal(preview.jobs[0].salary.period, "year");
    assert.equal(preview.hasMore, true);
    assert.equal((await run({ sortBy: "postedAt" })).totalMatches, 4);
    assert.equal(
      (
        await run({
          query: "PostgreSQL",
          queryScope: "allContent",
          industry: "database",
        })
      ).totalMatches,
      5,
    );
    assert.equal(
      (await run({ query: "PostgreSQL" })).totalMatches,
      0,
      "role scope must not match words that appear only in descriptions",
    );
    assert.equal((await run({ acceptsNewGrads: true })).totalMatches, 0);
  },
);
