import assert from "node:assert/strict";
import test from "node:test";
import {
  searchProfileLocations,
  resolveProfileLocationCountryCode,
} from "../lib/profile-locations";
import { GET } from "../app/api/locations/route";
import populationData from "../data/locations/city-populations.json";

test("location suggestions include cities and country flags", () => {
  const toronto = searchProfileLocations("Toronto, Canada");
  assert.ok(
    toronto.some(
      (place) =>
        place.label === "Toronto, Ontario, Canada" &&
        place.countryCode === "CA",
    ),
  );
  assert.ok(
    searchProfileLocations("India").some(
      (place) => place.label === "India" && place.countryCode === "IN",
    ),
  );
});

test("search is accent insensitive, bounded, and supports free text", () => {
  assert.ok(
    searchProfileLocations("Montreal, Canada").some(
      (place) => place.countryCode === "CA",
    ),
  );
  assert.ok(searchProfileLocations("").length > 0);
  assert.equal(searchProfileLocations("san").length, 40);
  assert.deepEqual(searchProfileLocations("zzzznonexistent"), []);
});

test("initial suggestions are 30 startup hubs, not the largest cities by population", () => {
  const first = searchProfileLocations("");
  assert.equal(first.length, 30);
  assert.deepEqual(
    first.slice(0, 3).map((place) => place.label),
    [
      "San Francisco, California, United States",
      "Toronto, Ontario, Canada",
      "New York City, New York, United States",
    ],
  );
  assert.ok(first.some((place) => place.label === "Calgary, Alberta, Canada"));
  assert.equal(first[first.length - 1].label, "Shanghai, China");
  assert.ok(!first.some((place) => /Lagos|Chongqing/.test(place.label)));
  assert.deepEqual(searchProfileLocations("", 40), []);
});

test("typed searches retain the full catalog and chunked pagination", () => {
  const first = searchProfileLocations("san");
  const second = searchProfileLocations("san", 40);
  assert.equal(first.length, 40);
  assert.equal(second.length, 40);
  assert.ok(
    second.every((place) => !first.some((item) => item.label === place.label)),
  );
  assert.ok(
    searchProfileLocations("Ushuaia").some(
      (place) => place.countryCode === "AR",
    ),
  );
});

test("saved location country codes are resolved before rendering the input", () => {
  assert.equal(
    resolveProfileLocationCountryCode("Calgary, Alberta, Canada"),
    "CA",
  );
  assert.equal(
    resolveProfileLocationCountryCode("Buenos Aires, Argentina"),
    "AR",
  );
  assert.equal(resolveProfileLocationCountryCode(""), null);
  assert.equal(resolveProfileLocationCountryCode("Somewhere unknown"), null);
});

test("exact city matches rank by population before similarly named places", () => {
  for (const [query, expected] of [
    ["toronto", "Toronto, Ontario, Canada"],
    ["london", "London, England, United Kingdom"],
    ["paris", "Paris, Île-de-France, France"],
    ["austin", "Austin, Texas, United States"],
    ["boston", "Boston, Massachusetts, United States"],
  ])
    assert.equal(searchProfileLocations(query)[0].label, expected);
  const toronto = searchProfileLocations("toronto");
  assert.equal(
    toronto[toronto.length - 1].label,
    "Toronto county, Ontario, Canada",
  );
  assert.ok(toronto.some((place) => place.countryCode === "AU"));
});

test("explicit locations and niche cities are not overridden by populous matches", () => {
  assert.equal(
    searchProfileLocations("Toronto, New South Wales")[0].countryCode,
    "AU",
  );
  assert.equal(
    searchProfileLocations("London, Ontario, Canada")[0].label,
    "London, Ontario, Canada",
  );
  assert.equal(searchProfileLocations("India")[0].label, "India");
  assert.equal(
    searchProfileLocations("Montréal")[0].label,
    searchProfileLocations("Montreal")[0].label,
  );
});

test("population snapshot distinguishes same-name places and records provenance", () => {
  const populations: Record<string, number> = populationData.populations;
  assert.ok(populations["CA:ON:Toronto"] > populations["AU:NSW:Toronto"]);
  assert.ok(populations["US:TX:Austin"] > populations["US:AR:Austin"]);
  assert.ok(!populations["CA:ON:Toronto county"]);
  assert.match(populationData.attribution, /GeoNames.*CC BY 4\.0/);
  assert.match(populationData.sourceSha256, /^[a-f0-9]{64}$/);
});

test("location API exposes subsequent pages and validates offsets", async () => {
  const defaults = await GET(
    new Request("http://localhost/api/locations"),
  ).json();
  assert.equal(defaults.locations.length, 30);
  assert.equal(defaults.nextOffset, null);
  const first = await GET(
    new Request("http://localhost/api/locations?q=san"),
  ).json();
  assert.equal(first.locations.length, 40);
  assert.equal(first.nextOffset, 40);
  const second = await GET(
    new Request("http://localhost/api/locations?q=san&offset=40"),
  ).json();
  assert.notEqual(first.locations[0].label, second.locations[0].label);
  const empty = await GET(
    new Request("http://localhost/api/locations?q=zzzznonexistent"),
  ).json();
  assert.equal(empty.nextOffset, null);
  assert.equal(
    GET(new Request("http://localhost/api/locations?offset=-1")).status,
    400,
  );
  assert.equal(
    GET(new Request("http://localhost/api/locations?offset=oops")).status,
    400,
  );
});

test("location API validates query length and returns suggestions", async () => {
  const response = GET(new Request("http://localhost/api/locations?q=Toronto"));
  assert.equal(response.status, 200);
  assert.ok((await response.json()).locations.length > 0);
  assert.equal(
    GET(new Request(`http://localhost/api/locations?q=${"x".repeat(121)}`))
      .status,
    400,
  );
});
