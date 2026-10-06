import type { CSSProperties } from "react";

export const SOUL_PALETTES = {
  light: {
    amber: "#e4b273",
    jade: "#8fb9a8",
    rose: "#cf9eaf",
    violet: "#aaa3ce",
    ink: "#647b78",
  },
  dark: {
    amber: "#bc8a52",
    jade: "#438d78",
    rose: "#a66d86",
    violet: "#8271aa",
    ink: "#1a2827",
  },
} as const;

// A visual seed, not an identity/token: only this number reaches the browser.
export function getSoulCoverSeed(identity: string): number {
  let hash = 2166136261;
  for (let index = 0; index < identity.length; index++) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getSoulCoverComposition(seed: number) {
  const value = seed >>> 0;
  return {
    frame: 12000 + (value % 36000),
    rotation: 15 + (value % 100),
    offsetX: (((value >>> 8) % 21) - 10) / 100,
    offsetY: (((value >>> 16) % 15) - 7) / 100,
    amberX: `${15 + (value % 24)}%`,
    jadeX: `${56 + ((value >>> 8) % 24)}%`,
    violetX: `${28 + ((value >>> 16) % 28)}%`,
  };
}

export function getSoulCoverStyle(seed: number): CSSProperties {
  const composition = getSoulCoverComposition(seed);
  const colors = Object.fromEntries(
    Object.entries(SOUL_PALETTES).flatMap(([theme, palette]) =>
      Object.entries(palette).map(([name, value]) => [
        `--soul-${theme}-${name}`,
        value,
      ]),
    ),
  );
  return {
    ...colors,
    "--soul-amber-x": composition.amberX,
    "--soul-jade-x": composition.jadeX,
    "--soul-violet-x": composition.violetX,
  } as CSSProperties;
}
