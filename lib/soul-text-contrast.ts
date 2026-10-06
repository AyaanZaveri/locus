export type RGB = readonly [number, number, number];
export type SoulTextMode = "blend" | "dark" | "light";
export const SOUL_TEXT_COLORS = {
  tint: [20, 184, 166],
  dark: [4, 47, 46],
  light: [240, 253, 250],
} as const satisfies Record<string, RGB>;

export function contrastRatio(a: RGB, b: RGB): number {
  const luminance = (color: RGB) => {
    const channels = color.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// W3C non-separable "color" blend: preserve the luminosity of the pale-mint
// difference layer while replacing its hue/saturation with teal.
export function blendedSoulColor(background: RGB): RGB {
  const lum = (rgb: readonly number[]) =>
    rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11;
  const tint = SOUL_TEXT_COLORS.tint.map((channel) => channel / 255);
  const targetLum = lum(
    background.map(
      (channel, index) =>
        Math.abs(SOUL_TEXT_COLORS.light[index] - channel) / 255,
    ),
  );
  let color = tint.map((channel) => channel + targetLum - lum(tint));
  const low = Math.min(...color);
  const high = Math.max(...color);
  if (low < 0)
    color = color.map(
      (channel) =>
        targetLum + ((channel - targetLum) * targetLum) / (targetLum - low),
    );
  if (high > 1)
    color = color.map(
      (channel) =>
        targetLum +
        ((channel - targetLum) * (1 - targetLum)) / (high - targetLum),
    );
  return color.map((channel) =>
    Math.max(0, Math.min(255, channel * 255)),
  ) as unknown as RGB;
}

export function chooseSoulTextMode(
  backgrounds: RGB[],
  previous: SoulTextMode = "blend",
): SoulTextMode {
  if (!backgrounds.length) return previous;
  const score = (mode: SoulTextMode) =>
    Math.min(
      ...backgrounds.map((background) =>
        contrastRatio(
          mode === "blend"
            ? blendedSoulColor(background)
            : SOUL_TEXT_COLORS[mode],
          background,
        ),
      ),
    );
  const blendScore = score("blend");
  // Enter fallback before reaching 3:1; require a healthier margin to return.
  if (blendScore >= (previous === "blend" ? 3.25 : 4)) return "blend";
  const darkScore = score("dark");
  const lightScore = score("light");
  const best = darkScore >= lightScore ? "dark" : "light";
  if (
    previous !== "blend" &&
    score(previous) >= 3.25 &&
    score(best) < score(previous) + 0.75
  )
    return previous;
  return best;
}
