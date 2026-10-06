import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { buildCompanyDiscoveryQuery } from "../lib/ai/company-discovery";
import { unembeddedCompanyCandidatesQuery } from "../lib/ai/semantic-search";
import { withCompanyPresentation } from "../lib/ai/company-candidate-presentation";
import { compactToolResult } from "../lib/ai/compact-tool-output";
import { companyDiscoverySchema } from "../lib/ai/company-discovery";
import { shouldDisplayLocusResult } from "../lib/locus-result-visibility";

test("company discovery distinguishes a hidden candidate pool from inline answers", () => {
  assert.equal(
    companyDiscoverySchema.parse({ resultMode: "candidates", limit: 15 })
      .resultMode,
    "candidates",
  );
  assert.equal(
    companyDiscoverySchema.safeParse({ resultMode: "invented" }).success,
    false,
  );
});

test("unranked evidence stays separate from vector counts and never invents a score", () => {
  const result = withCompanyPresentation(
    {
      companies: [{ slug: "ranked", semanticScore: 0.6 }],
      totalCandidates: 20,
      unrankedCompanies: [
        { slug: "unranked", descriptionExcerpt: "A product description." },
      ],
    },
    "candidates",
  );
  assert.equal(result.totalCandidates, 20);
  assert.ok("candidateCount" in result.presentation);
  assert.equal(result.presentation.candidateCount, 2);
  assert.equal(shouldDisplayLocusResult(compactToolResult(result)), false);
  assert.equal("semanticScore" in result.unrankedCompanies[0], false);
  assert.equal(
    shouldDisplayLocusResult(
      withCompanyPresentation({ companies: result.companies }),
    ),
    true,
  );
});

test("complete eligible pools avoid repeated discovery without overstating vector coverage", () => {
  const pool = {
    companies: [{ slug: "ranked" }],
    unrankedCompanies: [{ slug: "unranked" }],
    retrieval: {
      eligibleRecords: 2,
      embeddedRecords: 1,
      completeCoverage: false,
    },
  };
  const complete = withCompanyPresentation(pool, "candidates");
  assert.ok("completeEligiblePool" in complete.presentation);
  assert.equal(complete.presentation.completeEligiblePool, true);
  assert.equal(complete.retrieval.completeCoverage, false);
  assert.match(
    complete.presentation.textPolicy,
    /Do not repeat company discovery/,
  );
  const partial = withCompanyPresentation(
    { ...pool, retrieval: { ...pool.retrieval, eligibleRecords: 3 } },
    "candidates",
  );
  assert.ok("completeEligiblePool" in partial.presentation);
  assert.equal(partial.presentation.completeEligiblePool, false);
  const duplicated = withCompanyPresentation(
    { ...pool, unrankedCompanies: [{ slug: "ranked" }] },
    "candidates",
  );
  assert.ok("completeEligiblePool" in duplicated.presentation);
  assert.equal(duplicated.presentation.completeEligiblePool, false);
});

test("unembedded supplement preserves original filters and enforces a small hard cap", () => {
  const input = companyDiscoverySchema.parse({
    resultMode: "candidates",
    companySlugs: ["verified-slug"],
    query: "explicit-term",
    funding: { announcedAfter: "2026-09-06", announcedBefore: "2026-10-06" },
    jobs: { status: "open" },
  });
  const query = new PgDialect().sqlToQuery(
    unembeddedCompanyCandidatesQuery(
      buildCompanyDiscoveryQuery(input, "2026-10-06", undefined, true),
    ),
  );
  for (const value of [
    "verified-slug",
    "explicit-term",
    "2026-09-06",
    "2026-10-06",
    5,
  ])
    assert.ok(query.params.includes(value), String(value));
  assert.match(query.sql, /WHERE NOT vector_covered/);
  assert.match(query.sql, /LATERAL/);
  assert.match(query.sql, /j\.status = 'open'/);
  for (const limit of [0, 6, 2.5])
    assert.throws(() =>
      unembeddedCompanyCandidatesQuery(
        buildCompanyDiscoveryQuery(input, "2026-10-06"),
        limit,
      ),
    );
});

test(
  "recently funded company discovery keeps unembedded companies available for evidence review",
  { skip: !process.env.DATABASE_URL && !process.env.DATABASE_URL_POOLED },
  async () => {
    const { locusTools } = await import("../lib/ai/tools");
    const input = companyDiscoverySchema.parse({
      resultMode: "candidates",
      companySlugs: ["hiringcafe"],
      semanticQuery:
        "Companies building startup intelligence platforms that connect information about startups, founders, investors, funding, hiring, and jobs, with search or AI-powered discovery.",
      funding: { announcedAfter: "2026-09-06", announcedBefore: "2026-10-06" },
      jobs: { status: "openOrUnknown" },
      sortBy: "relevance",
      limit: 15,
    });

    const result = await locusTools.queryCompanies.execute!(input, {
      toolCallId: "company-coverage-regression",
      messages: [],
      context: {},
    });
    assert.ok("companies" in result);
    assert.equal(shouldDisplayLocusResult(result), false);
    const companies = [
      ...result.companies,
      ...("unrankedCompanies" in result
        ? (result.unrankedCompanies ?? [])
        : []),
    ];
    assert.equal(companies.length, 1);
    const company = companies[0];
    assert.equal(company.slug, "hiringcafe");
    assert.ok(String(company.descriptionExcerpt).length > 100);
    assert.equal(
      company.evidence?.funding?.rounds[0].announcedAt,
      "2026-09-28",
    );
    assert.equal(result.presentation.displayedCounts.companies, 0);
  },
);

test(
  "missing vectors do not bypass the user's funding dates",
  { skip: !process.env.DATABASE_URL && !process.env.DATABASE_URL_POOLED },
  async () => {
    const { locusTools } = await import("../lib/ai/tools");
    const result = await locusTools.queryCompanies.execute!(
      companyDiscoverySchema.parse({
        resultMode: "candidates",
        companySlugs: ["hiringcafe"],
        semanticQuery: "startup and job discovery products",
        funding: {
          announcedAfter: "2026-10-01",
          announcedBefore: "2026-10-06",
        },
        sortBy: "relevance",
        limit: 15,
      }),
      { toolCallId: "company-dates-regression", messages: [], context: {} },
    );
    assert.ok("companies" in result);
    assert.deepEqual(result.companies, []);
    if ("unrankedCompanies" in result)
      assert.deepEqual(result.unrankedCompanies, []);
  },
);
