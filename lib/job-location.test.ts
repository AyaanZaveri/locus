import { strict as assert } from "node:assert";
import { test } from "node:test";

import { sanitizeLocation, splitJobLocations } from "./job-location";

test("separates repeated US city/state pairs without splitting one address", () => {
  assert.equal(
    sanitizeLocation("San Francisco, CA, New York City, NY, Seattle, WA"),
    "San Francisco, CA | New York City, NY | Seattle, WA",
  );
  assert.equal(
    sanitizeLocation("New York City, New York, United States"),
    "New York City, New York, United States",
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
    "Hybrid - San Francisco | Hybrid - New York City | Hybrid - Austin",
  );
  assert.equal(sanitizeLocation("Hybrid - London"), "Hybrid - London");
  assert.equal(
    sanitizeLocation("San Francisco or Palo Alto"),
    "San Francisco | Palo Alto",
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
    "San Francisco",
  );
});
