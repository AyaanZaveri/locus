import assert from "node:assert/strict";
import { test } from "node:test";
import {
  presentationOptionsSchema,
  selectPresentation,
  withResultPresentation,
} from "../lib/ai/result-presentation";
import { presentationPrompt } from "../lib/ai/presentation-prompt";

test("presentation sorts verified names, deduplicates and limits without mutating evidence order", () => {
  const groups = {
    companies: [
      { slug: "z", name: "Zebra" },
      { slug: "a", name: "Alpha" },
      { slug: "b", name: "Beta" },
      { slug: "a", name: "Alpha" },
    ],
    people: [],
    jobs: [],
  };
  const selected = selectPresentation(groups, { sort: "nameAsc", limit: 2 });
  assert.deepEqual(
    selected.companies.map((r) => r.slug),
    ["a", "b"],
  );
  assert.equal(groups.companies[0].slug, "z");
  assert.deepEqual(
    selectPresentation(groups, { sort: "nameDesc", limit: 3 }).companies.map(
      (r) => r.slug,
    ),
    ["z", "b", "a"],
  );
  assert.deepEqual(
    selectPresentation(groups, { sort: "input", limit: 2 }).companies.map(
      (r) => r.slug,
    ),
    ["z", "a"],
  );
});

test("presentation limits apply across groups and allow five or more companies", () => {
  const groups = {
    companies: [{ slug: "a", name: "Alpha" }],
    people: [{ name: "Jane", companySlug: "a" }],
    jobs: [{ title: "Engineer", companySlug: "a", location: "Remote" }],
  };
  const selected = selectPresentation(groups, { sort: "input", limit: 2 });
  assert.equal(selected.jobs.length, 0);
  assert.equal(selected.people.length, 1);
  assert.deepEqual(presentationOptionsSchema.parse({ limit: 5 }), {
    sort: "input",
    limit: 5,
  });
  assert.equal(
    presentationOptionsSchema.safeParse({ limit: 0 }).success,
    false,
  );
});

test("rendering metadata matches grouped cards and unique funding/event company cards", () => {
  const rounds = [
    { slug: "a", name: "Alpha" },
    { slug: "a", name: "Alpha" },
    { slug: "b", name: "Beta" },
  ];
  for (const kind of ["rounds", "activity"] as const) {
    const result = withResultPresentation(
      { [kind]: rounds, totalMatches: 8 },
      kind,
    );
    assert.deepEqual(result.presentation.displayedCounts, {
      companies: 2,
      people: 0,
      jobs: 0,
    });
    assert.equal(result.totalMatches, 8);
    assert.deepEqual(result.presentation.visibleFields.companies, [
      "name",
      "industry",
      "location",
    ]);
  }
  assert.deepEqual(
    withResultPresentation({ companies: [], people: [], jobs: [] }).presentation
      .displayedCounts,
    { companies: 0, people: 0, jobs: 0 },
  );
  assert.equal(
    withResultPresentation({ jobs: [{ title: "Engineer" }] }).presentation
      .displayedCounts.jobs,
    1,
  );
});

test("the compact contract distinguishes current-turn duplication from explicit follow-ups", () => {
  assert.match(presentationPrompt, /CURRENT turn/);
  assert.match(presentationPrompt, /EARLIER turns/);
  assert.match(
    presentationPrompt,
    /incomplete set or missing ranking evidence/,
  );
  assert.match(presentationPrompt, /no prose is needed/);
});
