import assert from "node:assert/strict";
import test from "node:test";

import { splitJobLocations } from "./job-location";
import {
  getJobLocationCountryCode,
  getJobLocationCountryCodes,
} from "./job-location-country";

test("uses the role's city country", () => {
  assert.deepEqual(getJobLocationCountryCodes("Toronto, ON"), ["ca"]);
  assert.deepEqual(getJobLocationCountryCodes("Makati City"), ["ph"]);
  assert.deepEqual(getJobLocationCountryCodes("New York, NY | Remote"), ["us"]);
});

test("recognizes Heidi's Australian and South African city locations", () => {
  assert.equal(getJobLocationCountryCode("Brisbane"), "au");
  assert.equal(getJobLocationCountryCode("Cape Town"), "za");
  assert.deepEqual(getJobLocationCountryCodes("Brisbane | Cape Town"), [
    "au",
    "za",
  ]);
});

test("deduplicates countries and preserves first location order", () => {
  assert.deepEqual(
    getJobLocationCountryCodes("Sydney, Australia | Melbourne | London, UK"),
    ["au", "gb"],
  );
  assert.deepEqual(
    getJobLocationCountryCodes("Melbourne | Sydney, Australia"),
    ["au"],
  );
  assert.deepEqual(
    getJobLocationCountryCodes("Toronto | London | Berlin | Sydney | Paris"),
    ["ca", "gb", "de", "au", "fr"],
  );
});

test("does not invent countries for remote or regional roles", () => {
  for (const location of [
    "Remote",
    "Worldwide",
    "Remote - APAC",
    "Unknown",
    "",
  ]) {
    assert.deepEqual(getJobLocationCountryCodes(location), []);
  }
  assert.deepEqual(getJobLocationCountryCodes("Remote - US"), ["us"]);
  assert.deepEqual(getJobLocationCountryCodes("Remote - UK"), ["gb"]);
});

test("retains the single-country API for existing consumers", () => {
  assert.equal(getJobLocationCountryCode("Toronto"), "ca");
  assert.equal(getJobLocationCountryCode("Toronto | London"), null);
  assert.equal(getJobLocationCountryCode("EMEA | London"), null);
});

test("resolves a separate flag for every displayed city, including repeats", () => {
  const countriesForCities = (location: string) =>
    splitJobLocations(location).map(getJobLocationCountryCode);

  assert.deepEqual(
    countriesForCities("London, UK | Berlin, Germany | Paris, France"),
    ["gb", "de", "fr"],
  );
  assert.deepEqual(countriesForCities("Sydney, Australia | Melbourne"), [
    "au",
    "au",
  ]);
  assert.deepEqual(countriesForCities("Toronto, ON | Remote"), ["ca", null]);
});
