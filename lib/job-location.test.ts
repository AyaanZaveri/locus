import { strict as assert } from "node:assert";
import { test } from "node:test";

import { sanitizeLocation, splitJobLocations } from "./job-location";

test("separates repeated US city/state pairs without splitting one address", () => {
  assert.equal(
    sanitizeLocation("San Francisco, CA, New York City, NY, Seattle, WA"),
    "San Francisco, CA | New York, NY | Seattle, WA",
  );
  assert.equal(
    sanitizeLocation("New York City, New York, United States"),
    "New York, NY",
  );
});

test("keeps source remote regions distinct while expanding unambiguous country codes", () => {
  assert.deepEqual(
    splitJobLocations(
      "London, UK; Ontario, CAN; Remote-Friendly, United States; San Francisco, CA",
    ),
    [
      "London, UK",
      "Ontario, Canada",
      "Remote-Friendly, United States",
      "San Francisco, CA",
    ],
  );
  assert.equal(
    sanitizeLocation("Dublin, IE | Zürich, CH"),
    "Dublin, Ireland | Zürich, Switzerland",
  );
});

test("separates verified hybrid-city lists and leaves ambiguous regional lists alone", () => {
  assert.equal(
    sanitizeLocation("Hybrid - San Francisco, New York City, Austin"),
    "Hybrid - San Francisco, CA | Hybrid - New York, NY | Hybrid - Austin, TX",
  );
  assert.equal(sanitizeLocation("Hybrid - London"), "Hybrid - London, UK");
  assert.equal(
    sanitizeLocation("San Francisco or Palo Alto"),
    "San Francisco, CA | Palo Alto, CA",
  );
  assert.equal(
    sanitizeLocation("Remote - Spain, United Kingdom, Ireland"),
    "Remote - Spain, United Kingdom, Ireland",
  );
  assert.equal(
    sanitizeLocation("Pune or Bangalore, India"),
    "Pune or Bangalore, India",
  );
  assert.equal(
    sanitizeLocation("San Francisco | San Francisco"),
    "San Francisco, CA",
  );
});

test("canonicalizes city aliases without changing remote scope or uncertain places", () => {
  assert.equal(
    sanitizeLocation("San Francisco | San Francisco, California | San Francisco, CA"),
    "San Francisco, CA",
  );
  assert.equal(
    sanitizeLocation("New York City, NY | New York, New York | New York"),
    "New York, NY",
  );
  assert.equal(
    sanitizeLocation("Hybrid - San Francisco | Toronto, Ontario, Canada | London"),
    "Hybrid - San Francisco, CA | Toronto, ON | London, UK",
  );
  assert.equal(sanitizeLocation("Remote - San Francisco"), "Remote - San Francisco");
  assert.equal(sanitizeLocation("Remote (Canada)"), "Remote (Canada)");
  assert.equal(sanitizeLocation("Portland"), "Portland");
  assert.equal(sanitizeLocation("San Francisco Bay Area"), "San Francisco Bay Area");
  assert.equal(
    sanitizeLocation("San Francisco HQ | Toronto Hub"),
    "San Francisco, CA HQ | Toronto, ON Hub",
  );
  assert.equal(
    sanitizeLocation("San Francisco or NYC | San Francisco, Amsterdam"),
    "San Francisco, CA | New York, NY | Amsterdam, Netherlands",
  );
  assert.equal(
    sanitizeLocation("United States (New York | San Francisco)"),
    "New York, NY | San Francisco, CA",
  );
});
