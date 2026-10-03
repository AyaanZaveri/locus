/** Include Focus-owned portals as well as the panel in click-away detection. */
export function isLocusFocusClickZone(
  path: readonly (EventTarget | undefined)[],
  panel: EventTarget,
) {
  return (
    path.includes(panel) ||
    path.some(
      (target) =>
        target !== undefined &&
        "hasAttribute" in target &&
        typeof target.hasAttribute === "function" &&
        target.hasAttribute("data-locus-focus-click-zone"),
    )
  );
}
