import assert from "node:assert/strict";
import { test } from "node:test";
import {
  matchesJobLocationFilter,
  normalizeJobLocationSelection,
} from "./job-location-filter";

test("selected locations use OR matching", () => {
  const selected = ["San Francisco, CA", "New York, NY"];
  assert.equal(
    matchesJobLocationFilter({ location: "San Francisco, CA" }, selected),
    true,
  );
  assert.equal(
    matchesJobLocationFilter({ location: "New York, NY" }, selected),
    true,
  );
  assert.equal(
    matchesJobLocationFilter({ location: "London, UK" }, selected),
    false,
  );
});

test("remote can be combined with a city", () => {
  const selected = ["remote", "New York, NY"];
  assert.equal(
    matchesJobLocationFilter({ location: "Remote (US)" }, selected),
    true,
  );
  assert.equal(
    matchesJobLocationFilter(
      { location: "London, UK", workplaceType: "remote" },
      selected,
    ),
    true,
  );
  assert.equal(
    matchesJobLocationFilter({ location: "New York, NY" }, selected),
    true,
  );
  assert.equal(
    matchesJobLocationFilter({ location: "London, UK" }, selected),
    false,
  );
});

test("all locations is exclusive, and deselecting the last location resets it", () => {
  assert.deepEqual(normalizeJobLocationSelection(["all"], ["all", "remote"]), [
    "remote",
  ]);
  assert.deepEqual(
    normalizeJobLocationSelection(["remote"], ["remote", "all"]),
    ["all"],
  );
  assert.deepEqual(normalizeJobLocationSelection(["remote"], []), ["all"]);
  assert.equal(
    matchesJobLocationFilter({ location: "London, UK" }, ["all"]),
    true,
  );
});

test("location matching preserves hybrid normalization and ignores casing", () => {
  assert.equal(
    matchesJobLocationFilter({ location: "Hybrid - New York, NY (hybrid)" }, [
      "new york, ny",
    ]),
    true,
  );
});
