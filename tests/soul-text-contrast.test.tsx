import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SoulWordmark } from "../components/soul-wordmark";
import {
  blendedSoulColor,
  chooseSoulTextMode,
  contrastRatio,
  SOUL_TEXT_COLORS,
  type RGB,
} from "../lib/soul-text-contrast";

test("contrast uses WCAG linearized sRGB luminance", () => {
  assert.equal(contrastRatio([0, 0, 0], [255, 255, 255]), 21);
  assert.equal(contrastRatio([20, 184, 166], [20, 184, 166]), 1);
});

test("blend remains active over readable light and dark extremes", () => {
  for (const background of [
    [0, 0, 0],
    [255, 255, 255],
  ] as RGB[]) {
    assert.equal(chooseSoulTextMode([background]), "blend");
    assert.ok(contrastRatio(blendedSoulColor(background), background) >= 3.25);
  }
});

test("midtone greens use a readable teal fallback instead of disappearing", () => {
  for (const background of [
    [0, 189, 170],
    [0, 148, 136],
    [0, 214, 146],
    [128, 128, 128],
  ] as RGB[]) {
    const mode = chooseSoulTextMode([background]);
    const color =
      mode === "blend" ? blendedSoulColor(background) : SOUL_TEXT_COLORS[mode];
    assert.ok(
      contrastRatio(color, background) >= 3.25,
      `${background}: ${mode}`,
    );
  }
  assert.notEqual(chooseSoulTextMode([[0, 189, 170]]), "blend");
});

test("return to blending requires a larger safety margin, avoiding threshold chatter", () => {
  let intermediate: RGB | undefined;
  for (let channel = 0; channel < 256; channel++) {
    const background: RGB = [channel, channel, channel];
    const score = contrastRatio(blendedSoulColor(background), background);
    if (score >= 3.25 && score < 4) {
      intermediate = background;
      break;
    }
  }
  assert.ok(intermediate);
  assert.equal(chooseSoulTextMode([intermediate], "blend"), "blend");
  assert.notEqual(chooseSoulTextMode([intermediate], "dark"), "blend");
  assert.equal(chooseSoulTextMode([], "light"), "light");
});

test("one shared fallback is chosen from samples across the entire word", () => {
  assert.equal(
    chooseSoulTextMode([
      [0, 189, 170],
      [0, 175, 160],
      [20, 184, 166],
    ]),
    "dark",
  );
});

test("server-rendered wordmark stays muted until the shader is sampled", () => {
  const markup = renderToStaticMarkup(<SoulWordmark />);
  assert.match(markup, /data-soul-text-mode="loading"/);
  assert.match(markup, /text-muted-foreground/);
  assert.doesNotMatch(markup, /mix-blend-difference|mix-blend-color/);
  assert.match(markup, />SOUL<\/span>/);
});
