"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_LOCUS_MODEL,
  isLocusModelId,
  type LocusModelId,
} from "@/lib/locus-models";

const key = "locus:focus-model";
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
let fallback: LocusModelId = DEFAULT_LOCUS_MODEL;
function snapshot() {
  try {
    const value = localStorage.getItem(key);
    return isLocusModelId(value) ? value : fallback;
  } catch {
    return fallback;
  }
}
function setModel(model: LocusModelId) {
  fallback = model;
  try {
    localStorage.setItem(key, model);
  } catch {
    // Selection still works when browser storage is unavailable.
  }
  listeners.forEach((listener) => listener());
}
export function useLocusModel() {
  const model = useSyncExternalStore(
    subscribe,
    snapshot,
    () => DEFAULT_LOCUS_MODEL,
  );
  return [model, setModel] as const;
}
