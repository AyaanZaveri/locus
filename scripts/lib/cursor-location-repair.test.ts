import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LocationCatalog,
  resolvePlace,
  resolveSourcePlace,
} from "./location-catalog";
import { reviewedCursorLocation } from "./cursor-location-review";
import audit from "../../data/companies/cursor/location-review.json";

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

test("hybrid-prefixed sources resolve to the same New York city identity", () => {
  const city = resolvePlace("New York, NY")!;
  assert.equal(resolveSourcePlace("Hybrid - New York, NY")?.id, city.id);
  assert.equal(resolveSourcePlace("Remote - New York, NY")?.id, city.id);
});

test("staged city repairs bypass mistaken state aliases before alias registration", () => {
  const state = resolvePlace("New York, United States")!;
  const catalog = new LocationCatalog(
    [state],
    [{ alias: "new york, ny", locationId: state.id }],
  );
  const refs = catalog.references("Remote - New York City", "remote", {
    inferRemoteEligibility: false,
  });
  assert.equal(refs[0].label, "New York, NY");
  assert.equal(catalog.places.get(refs[0].locationId!)?.kind, "city");
  assert.equal(catalog.aliases.get("new york, ny"), state.id);
});

test("explicitly evidenced US states resolve as subdivisions", () => {
  for (const state of [
    "Alaska",
    "Hawaii",
    "Idaho",
    "Montana",
    "Oregon",
    "Washington",
    "Wyoming",
  ]) {
    const place = resolvePlace(state)!;
    assert.equal(place.kind, "subdivision");
    assert.equal(place.countryCode, "US");
  }
});

test("all source-reviewed Cursor roles rebuild cleanly without stale remote inference", () => {
  assert.equal(audit.roles.length, 132);
  const catalog = new LocationCatalog();
  for (const role of audit.roles) {
    const result = catalog.job(reviewedCursorLocation(role.url), {
      inferRemoteEligibility: false,
    });
    assert.equal(result.workplaceType, role.workplaceType);
    assert.equal(
      result.locations.some((ref) => ref.relation === "eligibility"),
      role.workplaceType === "remote",
      role.url,
    );
    assert.ok(!result.location.includes("New York, United States"), role.url);
  }
  assert.deepEqual([...catalog.unresolved], []);
});
test("source-only cities and remote team prose do not classify Cursor roles remote", () => {
  for (const slug of [
    "account-executive-commercial-singapore",
    "head-of-apj-field-marketing",
    "software-engineer-rl-environments",
    "paid-media-manager",
  ]) {
    const role = reviewedCursorLocation(`https://cursor.com/careers/${slug}`);
    assert.equal(role.workplaceType, null);
    assert.ok(!role.location.includes("Remote"));
  }
  assert.equal(
    reviewedCursorLocation(
      "https://cursor.com/careers/deal-desk-analyst-americas",
    ).workplaceType,
    "onsite",
  );
  assert.throws(
    () =>
      reviewedCursorLocation("https://cursor.com/careers/new-unreviewed-role"),
    /Unreviewed/,
  );
});
