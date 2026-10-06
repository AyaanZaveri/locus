import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileLocationInput } from "../components/profile-location-input";

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
