import { splitJobLocations } from "./job-location";

export function displayJobFilterLocation(place: string) {
  return place
    .trim()
    .replace(/^Hybrid\s*[-–]\s*/i, "")
    .replace(/\s*(?:\((?:on-?site|hybrid)\)|\b(?:HQ|Hub|Headquarters))$/i, "");
}

/** All is an exclusive reset option. An empty selection means all locations. */
export function normalizeJobLocationSelection(
  previous: string[],
  next: string[],
) {
  if (next.includes("all") && !previous.includes("all")) return ["all"];
  const locations = next.filter((value) => value !== "all");
  return locations.length ? locations : ["all"];
}

export function matchesJobLocationFilter(
  job: { location: string; workplaceType?: string | null },
  selected: string[],
) {
  if (!selected.length || selected.includes("all")) return true;
  const places = splitJobLocations(job.location).map((place) =>
    displayJobFilterLocation(place).toLowerCase(),
  );
  return selected.some((location) =>
    location === "remote"
      ? job.workplaceType === "remote" || /\bremote\b/i.test(job.location)
      : places.includes(location.toLowerCase()),
  );
}
