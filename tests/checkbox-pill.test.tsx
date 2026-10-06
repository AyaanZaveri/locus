import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Checkbox } from "../components/ui/checkbox";

test("company-size pills retain checkbox semantics without a visible checkmark", () => {
  const markup = renderToStaticMarkup(
    <Checkbox variant="pill" checked aria-label="11–50 employees">
      11–50
    </Checkbox>,
  );
  assert.match(markup, /role="checkbox"/);
  assert.match(markup, /aria-checked="true"/);
  assert.match(markup, /data-checked/);
  assert.match(markup, /bg-control/);
  assert.match(markup, /data-checked:bg-primary/);
  assert.doesNotMatch(markup, /checkbox-indicator|<svg/);
});

test("unselected and disabled pills expose their state", () => {
  const markup = renderToStaticMarkup(
    <Checkbox
      variant="pill"
      checked={false}
      disabled
      aria-label="1–10 employees"
    >
      1–10
    </Checkbox>,
  );
  assert.match(markup, /aria-checked="false"/);
  assert.match(markup, /data-disabled/);
});

test("standard checkboxes still render their check indicator", () => {
  const markup = renderToStaticMarkup(
    <Checkbox checked aria-label="Open to relocating" />,
  );
  assert.match(markup, /checkbox-indicator/);
  assert.match(markup, /<svg/);
});
