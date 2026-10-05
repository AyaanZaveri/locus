import { test } from "node:test";
import assert from "node:assert/strict";
import { LocationCatalog, resolvePlace } from "./location-catalog";
import { locationReferenceSchema } from "../../lib/location-reference";

test("Sydney aliases share an ID and preserve country/subdivision", () => {
  const c = new LocationCatalog();
  const a = c.place("Sydney, Australia")!;
  const b = c.place("Sydney, NSW")!;
  assert.equal(a.id, b.id);
  assert.equal(a.countryCode, "AU");
  assert.equal(a.subdivisionCode, "NSW");
  assert.equal(a.displayLabel, "Sydney, NSW");
  assert.equal(c.place("Sydney, NS")?.countryCode, "CA");
});
test("Multiple places become references, remote eligibility is not an office", () => {
  const c = new LocationCatalog();
  const job = c.job({
    location: "Singapore | Sydney, Australia",
    workplaceType: "onsite",
  });
  assert.equal(job.locations.length, 2);
  assert.equal(job.location, "Singapore | Sydney, NSW");
  for (const ref of job.locations) locationReferenceSchema.parse(ref);
  const remote = c.references("Remote - Sydney, NSW")[0];
  assert.equal(remote.locationId, job.locations[1].locationId);
  assert.equal(remote.relation, "eligibility");
});
test("Country, region, qualifier and unknown scope retain their granularity", () => {
  const c = new LocationCatalog();
  assert.equal(resolvePlace("Australia")?.kind, "country");
  assert.equal(resolvePlace("APJ")?.kind, "region");
  const hub = c.references("Toronto, ON Hub")[0];
  assert.equal(hub.locationId, c.place("Toronto, ON")!.id);
  assert.equal(hub.qualifier, "Hub");
  assert.equal(c.references("Remote - UTC-5 to UTC+3")[0].locationId, null);
  assert.equal(c.references("Unknown City")[0].locationId, null);
  const list = c.job({ location: "Remote - Germany, United Kingdom, Ireland" });
  assert.equal(list.locations.length, 3);
  assert.deepEqual(c.job(list), list);
  assert.equal(
    c.job({ location: "Remote - Americas, UTC-3 to UTC-10" }).location,
    "Remote - Americas, UTC-3 to UTC-10",
  );
  assert.equal(
    c.references("Remote-Friendly, Australia")[0].qualifier,
    "Remote-Friendly",
  );
  assert.equal(
    c.references("Remote-Friendly (Travel Required)")[0].label,
    "Remote-Friendly (Travel Required)",
  );
  assert.equal(
    resolvePlace(
      "San Francisco, CA (company financing announcement dateline)",
      "US",
    ),
    null,
  );
  assert.equal(resolvePlace("Springfield"), null);
});
test("Import is idempotent and honors existing IDs across label changes", () => {
  const c = new LocationCatalog();
  const once = c.job({ location: "Hybrid - Sydney, NSW" });
  assert.deepEqual(c.job(once), once);
  const withProvenance = {
    ...once,
    locations: once.locations.map((ref) => ({
      ...ref,
      sourceLabel: "Sydney regional hub from source",
    })),
  };
  assert.equal(
    c.job(withProvenance).locations[0].locationId,
    once.locations[0].locationId,
  );
  const s = resolvePlace("Sydney, NSW")!;
  const existing = {
    ...s,
    id: "00000000-0000-4000-8000-000000000001",
    displayLabel: "Sydney, New South Wales",
  };
  const catalog = new LocationCatalog(
    [existing],
    [{ alias: "sydney, nsw", locationId: existing.id }],
  );
  assert.equal(catalog.place("Sydney, NSW")?.id, existing.id);
});
