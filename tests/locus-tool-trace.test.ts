import assert from "node:assert/strict";
import { test } from "node:test";

import { describeLocusTool } from "../lib/locus-tool-trace";

test("semantic traces use a distinct icon and candidate language, with cache/coverage details", () => {
  for (const [tool, key, entity] of [
    ["queryJobs", "jobs", "role"],
    ["queryCompanies", "companies", "company"],
  ] as const) {
    const input = { semanticQuery: "distributed infrastructure" };
    const running = describeLocusTool({
      type: `tool-${tool}`,
      state: "input-available",
      input,
    });
    assert.equal(running?.icon, "semantic");
    assert.match(running!.label, /^Semantic search/);
    const complete = describeLocusTool({
      type: `tool-${tool}`,
      state: "output-available",
      input,
      output: {
        [key]: [{}],
        totalCandidates: 52,
        retrieval: {
          mode: "semantic",
          query: input.semanticQuery,
          eligibleRecords: 3980,
          embeddedRecords: 52,
          completeCoverage: false,
          queryCacheHit: true,
        },
      },
    });
    assert.equal(complete?.icon, "semantic");
    assert.equal(complete?.label, `Semantic search · 1 ${entity} ranked`);
    assert.match(complete!.detail!, /52\/3980 eligible records embedded/);
    assert.match(complete!.detail!, /incomplete coverage/);
    assert.match(complete!.detail!, /reused from cache/);
    assert.doesNotMatch(complete!.label, /matching|52/);
  }
});

test("completed traces use actual retrieval mode, not the model's semantic intent", () => {
  const part = {
    type: "tool-queryJobs",
    state: "output-available",
    input: { semanticQuery: "distributed infrastructure" },
  };
  const fallback = describeLocusTool({
    ...part,
    output: {
      jobs: [{}],
      retrieval: {
        mode: "lexical-fallback",
        queryUsed: "distributed infrastructure",
        reason: "No current vectors within the exact filters",
      },
    },
  });
  assert.equal(fallback?.icon, "search");
  assert.equal(fallback?.label, "Keyword fallback · 1 role found");
  assert.match(fallback!.detail!, /No current vectors/);
  const legacy = describeLocusTool({ ...part, output: { jobs: [{}] } });
  assert.notEqual(legacy?.icon, "semantic");
  assert.match(legacy!.label, /^Database search/);
  const actual = describeLocusTool({
    ...part,
    input: {},
    output: { jobs: [], retrieval: { mode: "semantic" } },
  });
  assert.equal(actual?.icon, "semantic");
  assert.equal(actual?.label, "Semantic search · no ranked roles");
  const streaming = describeLocusTool({
    ...part,
    state: "input-streaming",
    input: { semanticQuery: "partial" },
    output: undefined,
  });
  assert.notEqual(streaming?.icon, "semantic");
  const error = describeLocusTool({
    ...part,
    state: "output-error",
    errorText: "provider failed",
  });
  assert.equal(error?.phase, "error");
  assert.doesNotMatch(error!.label, /ranked|found/);
});

test("every tool invocation has a useful live and completed status", () => {
  const cases = [
    [
      "queryJobs",
      { workplaceType: "remote" },
      { jobs: [{ title: "Engineer" }] },
      "Database search · Found 1 matching role",
    ],
    [
      "queryCompanies",
      { industry: "Database" },
      { companies: [{ slug: "x" }] },
      "Database search · Found 1 matching company",
    ],
    [
      "queryPeople",
      { role: "CTO" },
      { people: [{ name: "Alice" }] },
      "Found 1 matching person",
    ],
    [
      "queryActivity",
      { type: "product" },
      { activity: [{ title: "Launch" }] },
      "Found 1 activity event",
    ],
    [
      "queryFunding",
      { sortBy: "announcedAt" },
      { rounds: [{ slug: "x" }, { slug: "y" }] },
      "Found 2 funding rounds",
    ],
    [
      "searchLocus",
      { query: "Toronto", types: ["companies"] },
      { companies: [{ slug: "x" }], people: [], jobs: [] },
      "Found 1 company",
    ],
    [
      "searchKnowledge",
      { query: "SOC 2" },
      [{ slug: "x" }, { slug: "y" }],
      "Found 2 matching passages",
    ],
    [
      "getCompany",
      { slug: "anthropic" },
      { name: "Anthropic" },
      "Found Anthropic profile",
    ],
    [
      "getCompanyProfile",
      { slug: "anthropic", section: "funding" },
      { name: "Anthropic" },
      "Found Anthropic funding",
    ],
    [
      "findCompanyPeople",
      { slug: "anthropic", query: "CTO" },
      [{ name: "Rahul Patil" }],
      "Found 1 person",
    ],
    [
      "listCompanyPeople",
      { slug: "anthropic" },
      [{ name: "Rahul Patil" }],
      "Found 1 person",
    ],
    [
      "listCompanyJobs",
      { slug: "anthropic", criteria: "full-stack" },
      [{ title: "Engineer" }, { title: "Senior Engineer" }],
      "Found 2 matching roles",
    ],
    [
      "recommendOutreachTargets",
      { location: "Toronto" },
      [{ slug: "x" }],
      "Found 1 outreach target",
    ],
    [
      "presentLocusResults",
      {},
      { companies: [], people: [], jobs: [{ title: "Engineer" }] },
      "Selected 1 role",
    ],
    [
      "navigateLocus",
      {
        companySlug: "anthropic",
        destination: "person",
        personName: "Rahul Patil",
      },
      { href: "/company/anthropic?person=Rahul" },
      "Opening Rahul Patil",
    ],
  ] as const;

  for (const [tool, input, output, expected] of cases) {
    const type = `tool-${tool}`;
    const loading = describeLocusTool({
      type,
      state: "input-available",
      input,
    });
    assert.equal(loading?.phase, "running", tool);
    assert.ok(loading?.label, tool);
    assert.ok(loading?.icon, tool);

    const finished = describeLocusTool({
      type,
      state: "output-available",
      input,
      output,
    });
    assert.equal(finished?.phase, "complete", tool);
    assert.equal(finished?.label, expected, tool);
  }
});

test("streaming inputs, empty results and failures never invent findings", () => {
  assert.deepEqual(
    describeLocusTool({
      type: "tool-searchKnowledge",
      state: "input-streaming",
    }),
    {
      icon: "evidence",
      phase: "running",
      label: "Searching company profiles",
      detail: undefined,
    },
  );
  assert.equal(
    describeLocusTool({
      type: "tool-listCompanyJobs",
      state: "output-available",
      input: { slug: "anthropic" },
      output: [],
    })?.label,
    "No matching roles found",
  );
  assert.equal(
    describeLocusTool({
      type: "tool-getCompanyProfile",
      state: "output-available",
      output: { error: "internal detail" },
    })?.phase,
    "error",
  );
  assert.equal(
    describeLocusTool({
      type: "tool-searchLocus",
      state: "output-error",
      errorText: "internal detail",
    })?.label,
    "Couldn’t finish search locus",
  );
});
