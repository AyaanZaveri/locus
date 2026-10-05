import { splitJobLocations } from "./job-location";

export type FilterLocationReference = {
  locationId: string | null;
  label: string;
  relation: "office" | "eligibility" | "unspecified";
  qualifier: string | null;
  sourceLabel: string;
};

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
  job: {
    location: string;
    locations?: FilterLocationReference[];
    workplaceType?: string | null;
  },
  selected: string[],
) {
  if (!selected.length || selected.includes("all")) return true;
  const places = job.locations?.length
    ? job.locations.map((place) => ({
        id: place.locationId,
        label: displayJobFilterLocation(place.label).toLowerCase(),
      }))
    : splitJobLocations(job.location).map((place) => ({
        id: null,
        label: displayJobFilterLocation(place).toLowerCase(),
      }));
  return selected.some((location) =>
    location === "remote"
      ? job.workplaceType === "remote" || /\bremote\b/i.test(job.location)
      : places.some((place) =>
          place.id
            ? place.id === location || place.label === location.toLowerCase()
            : place.label === location.toLowerCase(),
        ),
  );
}
