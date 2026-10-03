"use client";

import { useSyncExternalStore } from "react";

// Match the bottom-sheet styling used by the existing drawers.
const query = "(max-width: 639px)";
function subscribe(listener: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
const snapshot = () => window.matchMedia(query).matches;
const serverSnapshot = () => false;

export function useMobileSheet() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
