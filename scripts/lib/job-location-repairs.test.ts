import assert from "node:assert/strict";
import test from "node:test";

import { type LocationCompany, type LocationJobRow, planLocationRepairs } from "./job-location-repairs";

function fixture(location: string) {
  const company: LocationCompany = {
    id: "company-1", slug: "sample", name: "Sample", profile: {
      jobs: [{ title: "Engineer", url: "https://example.com/job", location, description: "Original description" }],
      people: [{ name: "Preserved Person" }],
    },
  };
  const row: LocationJobRow = {
    id: "job-1", company_id: company.id, title: "Engineer", url: "https://example.com/job", location,
    search_text: `Sample Engineer ${location} Engineering Original description`,
  };
  return { company, row };
}

test("plans only location/search changes and preserves IDs and profile facts", () => {
  const { company, row } = fixture("Denver");
  const plan = planLocationRepairs([company], [row]);
  assert.equal(plan.jobChanges[0].id, "job-1");
  assert.equal(plan.jobChanges[0].location, "Denver, CO");
  assert.equal(plan.jobChanges[0].search_text, "Sample Engineer Denver, CO Engineering Original description");
  assert.deepEqual(plan.companyChanges[0].profile, {
    ...company.profile, jobs: company.profile.jobs.map((job) => ({ ...job, location: "Denver, CO" })),
  });
  assert.equal(row.location, "Denver");
  assert.equal(company.profile.jobs[0].location, "Denver");
  assert.deepEqual(plan.unresolved, []);
});

test("requires source-scoped overrides for ambiguous names", () => {
  const { company, row } = fixture("Richmond");
  assert.equal(planLocationRepairs([company], [row]).unresolved.length, 1);
  const override = { url: row.url!, expectedLocation: "Richmond", location: "Richmond, VA", sourceUrl: "https://example.com/source" };
  const plan = planLocationRepairs([company], [row], [override]);
  assert.equal(plan.jobChanges[0].location, "Richmond, VA");
  assert.deepEqual(plan.unresolved, []);
  assert.throws(() => planLocationRepairs([company], [row], [{ ...override, expectedLocation: "Other place" }]), /Stale override/);
});

test("refuses profile-row drift and malformed search text", () => {
  const { company, row } = fixture("Denver");
  assert.throws(() => planLocationRepairs([company], [{ ...row, location: "Boston" }]), /profile\/row drift/);
  assert.throws(() => planLocationRepairs([company], [{ ...row, search_text: "Unexpected text" }]), /Unexpected search text/);
  assert.throws(() => planLocationRepairs([company], [row, { ...row, id: "extra" }]), /orphan job rows/);
});

test("already normalized records create no writes", () => {
  const { company, row } = fixture("Denver, CO");
  assert.deepEqual(planLocationRepairs([company], [row]), { companyChanges: [], jobChanges: [], unresolved: [] });
});
