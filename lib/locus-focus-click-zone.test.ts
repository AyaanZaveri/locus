import assert from "node:assert/strict";
import { test } from "node:test";
import { isLocusFocusClickZone } from "./locus-focus-click-zone";

class PortalZone extends EventTarget {
  hasAttribute(name: string) {
    return name === "data-locus-focus-click-zone";
  }
}

test("panel clicks stay inside Focus", () => {
  const panel = new EventTarget();
  assert.equal(isLocusFocusClickZone([new EventTarget(), panel], panel), true);
});

test("portaled menu and submenu clicks stay inside Focus without the panel in their path", () => {
  const panel = new EventTarget();
  for (const portal of [new PortalZone(), new PortalZone()]) {
    assert.equal(
      isLocusFocusClickZone(
        [new EventTarget(), portal, new EventTarget()],
        panel,
      ),
      true,
    );
  }
});

test("unrelated outside clicks still dismiss Focus", () => {
  assert.equal(
    isLocusFocusClickZone(
      [new EventTarget(), new EventTarget()],
      new EventTarget(),
    ),
    false,
  );
});
