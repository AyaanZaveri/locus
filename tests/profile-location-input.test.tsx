import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ProfileLocationInput,
  getLocationBadgeLabel,
} from "../components/profile-location-input";

test("location badges omit the country without changing the saved location", () => {
  const location = { label: "Toronto, Ontario, Canada", countryCode: "CA" };
  assert.equal(getLocationBadgeLabel(location), "Toronto, Ontario");
  assert.equal(location.label, "Toronto, Ontario, Canada");
  assert.equal(
    getLocationBadgeLabel({ label: "Singapore", countryCode: "SG" }),
    "Singapore",
  );
  assert.equal(
    getLocationBadgeLabel({ label: "Anywhere, my time zone", countryCode: "" }),
    "Anywhere, my time zone",
  );
});

test("an empty location renders the globe, not a spinner, on reload", () => {
  const markup = renderToStaticMarkup(
    <ProfileLocationInput id="location" value="" onChange={() => {}} />,
  );
  assert.match(markup, /lucide-globe/);
  assert.doesNotMatch(markup, /lucide-loader-circle/);
});

test("a saved location renders its server-resolved flag before suggestions load", () => {
  const markup = renderToStaticMarkup(
    <ProfileLocationInput
      id="location"
      value="Buenos Aires, Argentina"
      initialCountryCode="AR"
      onChange={() => {}}
    />,
  );
  assert.match(markup, /flags\/ar\.svg/);
  assert.doesNotMatch(markup, /lucide-loader-circle|lucide-globe/);
});

test("preferred locations render as removable flagged chips inside a multi-select input", () => {
  const markup = renderToStaticMarkup(
    <ProfileLocationInput
      id="desiredLocations"
      value=""
      onChange={() => {}}
      selectedValues={[
        "Toronto, Ontario, Canada",
        "London, England, United Kingdom",
      ]}
      initialCountryCodes={{
        "Toronto, Ontario, Canada": "CA",
        "London, England, United Kingdom": "GB",
      }}
      onSelectedValuesChange={() => {}}
    />,
  );
  assert.match(markup, /data-slot="combobox-chips"/);
  assert.equal((markup.match(/data-slot="combobox-chip"/g) ?? []).length, 2);
  assert.equal(
    (markup.match(/data-slot="combobox-chip-remove"/g) ?? []).length,
    2,
  );
  assert.match(markup, /flags\/ca\.svg/);
  assert.match(markup, /flags\/gb\.svg/);
  assert.match(markup, /id="desiredLocations"/);
  assert.match(markup, /Add location/);
  assert.doesNotMatch(markup, /lucide-loader-circle/);
});

test("preferred locations preserve custom saved entries and disable editing during save", () => {
  const markup = renderToStaticMarkup(
    <ProfileLocationInput
      id="desiredLocations"
      value=""
      onChange={() => {}}
      selectedValues={["Anywhere in my time zone"]}
      onSelectedValuesChange={() => {}}
      disabled
    />,
  );
  assert.match(markup, /Anywhere in my time zone/);
  assert.match(markup, /lucide-globe/);
  const input = markup.match(/<input\b[^>]*id="desiredLocations"[^>]*>/)?.[0];
  assert.ok(input);
  assert.match(input, /\sdisabled=""/);
});
