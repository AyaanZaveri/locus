import { test } from "node:test";
import assert from "node:assert/strict";
import { LocationCatalog, resolvePlace } from "./location-catalog";

test("remote alternatives do not turn every named city into remote eligibility", () => {
  const catalog = new LocationCatalog();
  const job = catalog.job(
    { location: "Remote | New York | San Francisco", workplaceType: "remote" },
    { inferRemoteEligibility: false },
  );
  assert.equal(job.location, "Remote | New York, NY | San Francisco, CA");
  assert.deepEqual(
    job.locations.map((ref) => ref.relation),
    ["eligibility", "unspecified", "unspecified"],
  );
});
test("explicitly scoped remote geography stays scoped", () => {
  const catalog = new LocationCatalog();
  const job = catalog.job(
    {
      location: "Remote - Singapore | Remote - Australia",
      workplaceType: "remote",
    },
    { inferRemoteEligibility: false },
  );
  assert.equal(job.location, "Remote - Singapore | Remote - Australia");
  assert.ok(job.locations.every((ref) => ref.relation === "eligibility"));
});
test("explicit New York and Washington city/state pairs are cities, not subdivisions", () => {
  assert.equal(resolvePlace("New York, NY")?.kind, "city");
  assert.equal(resolvePlace("New York, NY")?.displayLabel, "New York, NY");
  assert.equal(resolvePlace("Washington, DC")?.kind, "city");
});
