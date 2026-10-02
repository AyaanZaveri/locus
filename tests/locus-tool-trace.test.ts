import assert from "node:assert/strict";
import { test } from "node:test";

import { describeLocusTool } from "../lib/locus-tool-trace";

test("every tool invocation has a useful live and completed status", () => {
  const cases = [
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
