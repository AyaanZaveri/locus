import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getReviewedJobLocations } from "./reviewed-job-locations";
import { LocationCatalog, resolvePlace } from "./location-catalog";
import {
  locationReferencesDisplay,
  type LocationReference,
} from "../../lib/location-reference";

test("batch-one imports preserve every reviewed relation, identity and qualifier", async () => {
  let total = 0;
  for (const slug of [
    "linear",
    "coder",
    "openrouter",
    "parallel",
    "mintlify",
  ]) {
    const audit = JSON.parse(
      await readFile(
        new URL(
          `../../data/job-location-reviews/${slug}.json`,
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const reviewed = await getReviewedJobLocations(slug);
    assert.ok(reviewed);
    const catalog = new LocationCatalog();
    for (const role of audit.roles) {
      for (const ref of role.locations) {
        if (!ref.locationId) continue;
        const place = resolvePlace(ref.label);
        assert.ok(place, ref.label);
        assert.equal(place.id, ref.locationId, ref.label);
        catalog.places.set(place.id, place);
      }
      const source: {
        location: string;
        workplaceType: "remote" | "onsite" | "hybrid" | "flexible" | null;
        locations?: LocationReference[];
      } = reviewed.get(role.url);
      const job = catalog.job(source, { inferRemoteEligibility: false });
      assert.equal(job.workplaceType, role.workplaceType);
      assert.deepEqual(job.locations, role.locations);
      assert.equal(job.location, locationReferencesDisplay(role.locations));
      total++;
    }
    for (const url of [
      ...audit.unavailable,
      ...(audit.removedPostings ?? []).map((role: { url: string }) => role.url),
    ])
      assert.throws(() => reviewed.get(url), /Unreviewed/);
    assert.throws(
      () => reviewed.get("https://example.com/new-posting"),
      /Unreviewed/,
    );
  }
  assert.equal(total, 110);
});

test("batch-two reviewed references survive import without false remote classification", async () => {
  let count = 0;
  for (const slug of ["convex", "weave", "tavily", "vooma", "harmonic"]) {
    const audit = JSON.parse(
      await readFile(
        new URL(
          `../../data/job-location-reviews/${slug}.json`,
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const reviewed = await getReviewedJobLocations(slug);
    assert.ok(reviewed);
    const catalog = new LocationCatalog();
    for (const role of audit.roles) {
      for (const ref of role.locations) {
        const place = resolvePlace(ref.label);
        assert.ok(place, ref.label);
        assert.equal(place.id, ref.locationId);
        catalog.places.set(place.id, place);
      }
      const source: {
        location: string;
        workplaceType: "remote" | "onsite" | "hybrid" | "flexible" | null;
        locations?: LocationReference[];
      } = reviewed.get(role.url);
      const job = catalog.job(source, { inferRemoteEligibility: false });
      assert.deepEqual(job.locations, role.locations);
      assert.equal(job.workplaceType, role.workplaceType);
      assert.ok(
        !job.locations.some((ref) => ref.relation === "eligibility"),
        role.url,
      );
      assert.ok(!job.location.includes("New York, United States"), role.url);
      count++;
    }
  }
  assert.equal(count, 54);
});

test("unreviewed companies keep their existing import path and unsafe slugs fail", async () => {
  assert.equal(
    await getReviewedJobLocations("nonexistent-review-fixture"),
    null,
  );
  await assert.rejects(
    () => getReviewedJobLocations("../linear"),
    /Invalid company slug/,
  );
});
