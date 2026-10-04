import assert from "node:assert/strict";
import { test } from "node:test";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { PgDialect } from "drizzle-orm/pg-core";

import {
  buildCompanyDiscoveryQuery,
  companyDiscoveryResult,
  companyDiscoverySchema,
} from "../lib/ai/company-discovery";
import { companySource, jobsSource, peopleSource } from "./query-fixtures";

test("discovery validates strict nested filters and preserves company refinements", () => {
  for (const input of [
    { jobs: { limit: 1 } },
    { jobs: { sql: "SELECT *" } },
    { funding: { companySlugs: [] } },
    { funding: { announcedAfter: "2026-02-30" } },
    {
      funding: { announcedAfter: "2026-10-02", announcedBefore: "2026-10-01" },
    },
    { people: { isFounder: "yes" } },
    { people: { countryCode: "us" } },
    { activity: { after: "2026-10-02", before: "2026-10-01" } },
    { maximumEmployees: 10, minimumEmployees: 50 },
    { foundedAfter: 2026, foundedBefore: 2020 },
    { countryCode: "_%" },
    { unknownFilter: "x" },
  ])
    assert.equal(
      companyDiscoverySchema.safeParse(input).success,
      false,
      JSON.stringify(input),
    );
  const parsed = companyDiscoverySchema.parse({
    funding: {},
    jobs: {},
    people: {},
    activity: {},
  });
  assert.equal(parsed.jobs?.status, "open");
  assert.equal(parsed.limit, 10);
});

test("nested user values are parameters, not SQL fragments", () => {
  const hostile = "_%'; DROP TABLE companies;--";
  const query = new PgDialect().sqlToQuery(
    buildCompanyDiscoveryQuery(
      companyDiscoverySchema.parse({
        funding: { investor: hostile },
        jobs: { title: hostile },
        people: { role: hostile },
        activity: { query: hostile },
      }),
      "2026-10-02",
    ),
  );
  assert.ok(!query.sql.includes(hostile));
  assert.equal(
    query.params.filter((value) => value === hostile).length >= 4,
    true,
  );
  assert.match(query.sql, /LATERAL/);
});

test("empty discovery reports company counts without invented evidence", () => {
  const result = companyDiscoveryResult(
    [],
    companyDiscoverySchema.parse({ funding: {}, jobs: {} }),
    "2026-10-02",
  );
  assert.equal(result.countUnit, "companies");
  assert.equal(result.totalMatches, 0);
  assert.equal(result.hasMore, false);
  assert.deepEqual(result.companies, []);
});

const url = process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;
test(
  "real PostgreSQL: complete cross-entity intersection, same-record matching and bounded evidence",
  { skip: !url },
  async () => {
    const db = drizzle({ client: neon(url!) });
    const round = (id: string, amount = 20, announcedAt = "2026-10-01") => ({
      id,
      announcedAt,
      stage: "Seed",
      amount: { amount, currency: "USD", display: `$${amount}` },
      investors: [{ name: "Benchmark" }],
      sourceUrl: `https://example.com/${id}`,
    });
    const company = (
      id: string,
      name: string,
      rounds = [round(`${id}-round`)],
    ) => ({
      id,
      slug: id,
      name,
      industry: "Database",
      stage: "Seed",
      location: "San Francisco",
      country_code: "us",
      employee_count: "11-50 employees",
      profile: {
        industry: "Database",
        location: { label: "San Francisco", countryCode: "us" },
        funding: { rounds },
        activity: [] as Record<string, unknown>[],
      },
    });
    // Every early company is funded but lacks a qualifying job. A limited funding
    // preview would omit both valid companies, which sort beyond the first 50.
    const companies = Array.from({ length: 55 }, (_, index) =>
      company(`early-${index}`, `A early ${index}`),
    );
    const eligible = company(
      "eligible",
      "Z Eligible",
      Array.from({ length: 4 }, (_, index) => round(`eligible-${index}`)),
    );
    const other = company("other", "Z Other");
    const split = company("split", "A Split", [
      round("old-large", 100, "2026-01-01"),
      round("new-small", 1),
    ]);
    const unknown = company("unknown", "A Unknown", [
      round("undated", 100, "2026-10"),
    ]);
    const future = company("future", "A Future", [
      round("future", 100, "2026-10-03"),
    ]);
    companies.push(eligible, other, split, unknown, future);
    const activity = (id: string, extra = {}) => ({
      type: "product",
      title: "GPU launch",
      description: "New GPU database engine",
      dateTime: "2026-10-01",
      sourceUrl: `https://example.com/${id}`,
      ...extra,
    });
    eligible.profile.activity = Array.from({ length: 4 }, (_, i) =>
      activity(`event-${i}`),
    );
    other.profile.activity = [activity("other-event")];
    split.profile.activity = [
      activity("split-product", {
        description: "Design story",
        title: "Design story",
      }),
      activity("split-hiring", { type: "hiring" }),
    ];
    const job = (id: string, companyId: string, extra = {}) => ({
      id,
      company_id: companyId,
      title: "Python Engineer",
      location: "United States",
      skills: ["Python"],
      status: "open",
      workplace_type: "remote",
      posted_at: "2026-10-01",
      ...extra,
    });
    const jobs = [
      ...companies
        .slice(0, 55)
        .map((c) => job(`job-${c.id}`, c.id, { workplace_type: "onsite" })),
      ...Array.from({ length: 4 }, (_, i) => job(`eligible-${i}`, "eligible")),
      job("other-job", "other"),
      job("split-remote", "split", { title: "Designer", skills: ["Figma"] }),
      job("split-python", "split", { workplace_type: "onsite" }),
      job("unknown-job", "unknown", { status: "unknown" }),
      job("future-job", "future", { posted_at: "2026-10-03" }),
      job("closed-job", "eligible", { status: "closed" }),
      job("future-eligible-job", "eligible", { posted_at: "2026-10-03" }),
    ];
    const person = (id: string, companyId: string, extra = {}) => ({
      id,
      company_id: companyId,
      name: `Person ${id}`,
      role: "Chief Technology Officer",
      is_founder: true,
      linkedin: `https://example.com/${id}`,
      ...extra,
    });
    const people = [
      ...Array.from({ length: 4 }, (_, i) =>
        person(`eligible-${i}`, "eligible"),
      ),
      person("other", "other"),
      person("split-founder", "split", { role: "Engineer" }),
      person("split-cto", "split", { is_founder: false }),
    ];
    const sources = {
      companies: companySource(companies),
      jobs: jobsSource(jobs, companies),
      people: peopleSource(people, companies),
    };
    const run = async (filters: Record<string, unknown>) => {
      const input = companyDiscoverySchema.parse(filters);
      const rows = (
        await db.execute(
          buildCompanyDiscoveryQuery(input, "2026-10-02", sources),
        )
      ).rows;
      return companyDiscoveryResult(rows, input, "2026-10-02");
    };
    const full = {
      industry: "database",
      maximumEmployees: 50,
      funding: {
        announcedAfter: "2026-09-01",
        minimumAmount: 10,
        investor: "benchmark",
      },
      jobs: { query: "engineer", skills: ["Python"], workplaceType: "remote" },
      people: { role: "CTO", isFounder: true },
      activity: { type: "product", query: "GPU", after: "2026-09-01" },
    };
    const preview = await run({ ...full, limit: 1 });
    assert.equal(preview.totalMatches, 2);
    assert.equal(preview.countUnit, "companies");
    assert.equal(preview.hasMore, true);
    assert.equal(preview.companies[0].slug, "eligible");
    const evidence = preview.companies[0].evidence!;
    assert.equal(evidence.funding?.totalMatches, 4);
    assert.equal(evidence.funding?.rounds.length, 3);
    assert.equal(evidence.funding?.hasMore, true);
    assert.equal(evidence.jobs?.totalMatches, 4);
    assert.equal(evidence.jobs?.jobs.length, 3);
    assert.equal(evidence.people?.totalMatches, 4);
    assert.equal(evidence.people?.people.length, 3);
    assert.equal(evidence.activity?.totalMatches, 4);
    assert.equal(evidence.activity?.activity.length, 3);
    assert.equal(
      evidence.activity?.activity[0].excerpt,
      "New GPU database engine",
    );
    assert.ok(
      evidence.funding?.rounds.every((r) =>
        String(r.sourceUrl).startsWith("https://example.com/"),
      ),
    );
    const complete = await run(full);
    assert.deepEqual(
      complete.companies.map((c) => c.slug),
      ["eligible", "other"],
    );
    assert.equal(complete.hasMore, false);
    for (const key of ["funding", "jobs", "people", "activity"] as const) {
      assert.equal(
        (await run({ companySlugs: ["split"], [key]: full[key] })).totalMatches,
        0,
        `${key} filters must match the same record`,
      );
    }
    assert.equal(
      (await run({ companySlugs: ["future", "unknown"], funding: {} }))
        .totalMatches,
      0,
    );
    assert.equal(
      (await run({ companySlugs: ["future", "unknown"], jobs: {} }))
        .totalMatches,
      0,
    );
    assert.equal(
      (
        await run({
          companySlugs: ["unknown"],
          jobs: { status: "openOrUnknown" },
        })
      ).totalMatches,
      1,
    );
    assert.equal(
      (await run({ ...full, companySlugs: ["early-0"] })).totalMatches,
      0,
    );
    assert.equal((await run({ funding: { investor: "_%" } })).totalMatches, 0);
    assert.equal(
      (await run({ people: { role: "constructor" } })).totalMatches,
      0,
    );
    const legacy = await run({ companySlugs: ["eligible"] });
    assert.equal(legacy.totalMatches, 1);
    assert.equal(legacy.companies[0].stage, "Seed");
    assert.equal("evidence" in legacy.companies[0], false);
  },
);
