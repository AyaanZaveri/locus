import { test } from "node:test";
import assert from "node:assert/strict";
import { getLocationGroups } from "./job-location-groups";
import type { LocationReference } from "./location-reference";

const ref = (
  label: string,
  countryCode: string | null,
  kind: LocationReference["kind"],
): LocationReference => ({
  locationId: `id-${label}`,
  label,
  countryCode,
  kind,
  sourceLabel: label,
  relation: "unspecified",
  qualifier: null,
});

test("catalog countries get flags; multinational regions stay separate", () => {
  const groups = getLocationGroups([
    {
      location: "",
      locations: [
        ref("DC-metro area", "US", "region"),
        ref("Indonesia", "ID", "country"),
        ref("EMEA", null, "region"),
        ref("APJ", null, "region"),
      ],
    },
  ]);
  assert.deepEqual(
    groups.map((g) => g.label),
    ["Indonesia", "United States", "Regions"],
  );
  assert.equal(
    groups.find((g) => g.code === "us")!.places[0].countryCode,
    "us",
  );
  assert.equal(
    groups.find((g) => g.code === "id")!.places[0].countryCode,
    "id",
  );
  assert.deepEqual(
    groups
      .find((g) => g.code === "regions")!
      .places.map((p) => [p.label, p.countryCode]),
    [
      ["APJ", null],
      ["EMEA", null],
    ],
  );
});
test("canonical metadata wins over label guesses and retains selection IDs", () => {
  const groups = getLocationGroups([
    {
      location: "",
      locations: [
        ref("Unknown city", "ID", "city"),
        ref("London", null, "region"),
      ],
    },
  ]);
  assert.equal(groups[0].code, "id");
  assert.equal(groups[0].places[0].value, "id-Unknown city");
  assert.equal(groups[1].code, "regions");
  assert.equal(groups[1].places[0].countryCode, null);
});
test("legacy snapshots group DC and Indonesia while unknown geography stays unknown", () => {
  const groups = getLocationGroups([
    {
      location:
        "DC-metro area | Indonesia | EMEA | APJ | Unverified area | Remote",
    },
  ]);
  assert.deepEqual(
    groups.map((g) => g.label),
    ["Indonesia", "United States", "Regions", "Other locations"],
  );
  assert.equal(groups.flatMap((g) => g.places).length, 5);
});
test("duplicate links count each job once per country", () => {
  const groups = getLocationGroups([
    {
      location: "",
      locations: [
        ref("New York", "US", "city"),
        ref("New York", "US", "city"),
        ref("Austin", "US", "city"),
      ],
    },
    { location: "Indonesia" },
  ]);
  assert.equal(groups.find((g) => g.code === "us")!.jobCount, 1);
  assert.equal(groups.find((g) => g.code === "us")!.places.length, 2);
});
