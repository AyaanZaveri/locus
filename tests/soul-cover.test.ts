import assert from "node:assert/strict";
import test from "node:test";
import {
  SOUL_PALETTES,
  getSoulCoverSeed,
  getSoulCoverComposition,
  getSoulCoverStyle,
} from "../lib/soul-cover";

test("Soul artwork is deterministic for a user without exposing their identity", () => {
  const seed = getSoulCoverSeed("example-user-123");
  assert.equal(seed, getSoulCoverSeed("example-user-123"));
  assert.notEqual(seed, getSoulCoverSeed("another-user"));
  assert.ok(Number.isSafeInteger(seed) && seed >= 0);
  assert.deepEqual(
    getSoulCoverComposition(seed),
    getSoulCoverComposition(seed),
  );
  assert.doesNotMatch(JSON.stringify(getSoulCoverStyle(seed)), /example-user/);
});

test("light and dark artwork use distinct palettes and valid bounded parameters", () => {
  assert.notDeepEqual(SOUL_PALETTES.light, SOUL_PALETTES.dark);
  for (const palette of Object.values(SOUL_PALETTES)) {
    assert.equal(Object.values(palette).length, 5);
    for (const color of Object.values(palette))
      assert.match(color, /^#[a-f0-9]{6}$/);
  }
  for (const seed of [0, 1, 4294967295, getSoulCoverSeed("locus-soul")]) {
    const composition = getSoulCoverComposition(seed);
    assert.ok(composition.frame >= 12000 && composition.frame < 48000);
    assert.ok(composition.rotation >= 15 && composition.rotation < 115);
    assert.ok(Math.abs(composition.offsetX) <= 0.1);
    assert.ok(Math.abs(composition.offsetY) <= 0.07);
    const style = getSoulCoverStyle(seed);
    assert.equal(Object.keys(style).length, 13);
  }
});
