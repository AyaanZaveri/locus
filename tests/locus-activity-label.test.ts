import assert from "node:assert/strict";
import { test } from "node:test";

import { getLocusActivityLabel } from "../lib/locus-activity-label";
import { describeLocusTool } from "../lib/locus-tool-trace";

const user = (text: string) => ({
  role: "user",
  parts: [{ type: "text", text }],
});
const assistant = (...parts: unknown[]) => ({ role: "assistant", parts });

test("the first label reflects whether the current page is needed", () => {
  assert.equal(
    getLocusActivityLabel(
      [user("What does this company do?")],
      "/company/mintlify",
    ),
    "Checking this page",
  );
  assert.equal(
    getLocusActivityLabel(
      [user("Which companies mention SOC 2?")],
      "/company/mintlify",
    ),
    "Pondering",
  );
});

test("the label follows streamed page context, tools, results, and answer text", () => {
  const question = user("What does this company do?");
  const context = { type: "data-pageContext", data: { name: "Mintlify" } };
  const tool = {
    type: "tool-getCompanyProfile",
    state: "input-available",
    input: { slug: "mintlify", section: "overview" },
  };

  assert.equal(
    getLocusActivityLabel([question, assistant(context)]),
    "Reading the company profile",
  );
  assert.equal(
    getLocusActivityLabel([question, assistant(context, tool)]),
    "Exploring the company",
  );
  assert.equal(
    getLocusActivityLabel([
      question,
      assistant(context, {
        ...tool,
        state: "output-available",
        output: { name: "Mintlify" },
      }),
    ]),
    "Checking the results",
  );
  assert.equal(
    getLocusActivityLabel([
      question,
      assistant(
        context,
        { ...tool, state: "output-available" },
        { type: "text", text: "Mintlify builds docs." },
      ),
    ]),
    "Putting it into words",
  );
});

test("tool labels identify the work without reporting unobserved reasoning", () => {
  const question = user("Find companies with SOC 2 claims");
  assert.equal(
    getLocusActivityLabel([
      question,
      assistant({ type: "tool-searchKnowledge", state: "input-streaming" }),
    ]),
    "Searching the evidence",
  );
  assert.equal(
    getLocusActivityLabel([
      question,
      assistant({
        type: "tool-searchLocus",
        state: "input-available",
        input: { query: "Context" },
      }),
    ]),
    "Searching the directory",
  );
  assert.equal(
    getLocusActivityLabel([
      question,
      assistant({
        type: "tool-getCompanyProfile",
        state: "input-available",
        input: { section: "funding" },
      }),
    ]),
    "Checking the funding",
  );
  assert.equal(
    getLocusActivityLabel([
      question,
      assistant({
        type: "tool-listCompanyJobs",
        state: "input-available",
        input: { slug: "mintlify" },
      }),
    ]),
    "Exploring role options",
  );
});

test("the pill stays task-level rather than duplicating running tool traces", () => {
  for (const type of [
    "queryCompanies",
    "queryJobs",
    "queryPeople",
    "queryFunding",
    "queryActivity",
    "getCompany",
    "getCompanyProfile",
    "searchLocus",
    "searchKnowledge",
    "findCompanyPeople",
    "listCompanyPeople",
    "listCompanyJobs",
    "recommendOutreachTargets",
    "presentLocusResults",
    "navigateLocus",
  ]) {
    for (const state of ["input-streaming", "input-available"]) {
      const part = {
        type: `tool-${type}`,
        state,
        input: {
          semanticQuery: "company discovery",
          slug: "hiringcafe",
          companySlug: "hiringcafe",
        },
      };
      const label = getLocusActivityLabel([
        user("Find companies and roles"),
        assistant(part),
      ]);
      assert.notEqual(
        label,
        describeLocusTool(part)?.label,
        `${type}/${state}`,
      );
      assert.doesNotMatch(label, /Semantic search|Database search|ranked/);
    }
  }
  assert.equal(
    getLocusActivityLabel([
      user("Find companies"),
      assistant({
        type: "tool-queryCompanies",
        state: "input-available",
        input: { semanticQuery: "startup discovery" },
      }),
    ]),
    "Finding relevant companies",
  );
});

test("a new question never inherits the previous turn's activity", () => {
  const previous = assistant({
    type: "tool-searchKnowledge",
    state: "input-available",
  });
  assert.equal(
    getLocusActivityLabel(
      [user("Search for SOC 2"), previous, user("What does this company do?")],
      "/company/mintlify",
    ),
    "Checking this page",
  );
});

test("alternate copy is stable for a turn and still reflects its stage", () => {
  const question = user("Find companies with SOC 2 claims");
  assert.equal(getLocusActivityLabel([question], undefined, 0), "Pondering");
  assert.equal(getLocusActivityLabel([question], undefined, 1), "Perusing");
  assert.equal(
    getLocusActivityLabel([question], undefined, 2),
    "Mulling it over",
  );

  const result = {
    type: "tool-searchKnowledge",
    state: "output-available",
    output: [],
  };
  assert.equal(
    getLocusActivityLabel([question, assistant(result)], undefined, 1),
    "Reading what turned up",
  );
  assert.equal(
    getLocusActivityLabel(
      [question, assistant(result, { type: "text", text: "No matches." })],
      undefined,
      1,
    ),
    "Writing it up",
  );
  assert.equal(
    getLocusActivityLabel(
      [question, assistant({ ...result, state: "input-available" })],
      undefined,
      1,
    ),
    "Searching the evidence",
  );
});
