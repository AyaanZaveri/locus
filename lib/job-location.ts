/** A job's locations are distinct places, separated by pipes in the profile. */
const usRegions =
  "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";
const usPlace = new RegExp(`([^,;|]+),\\s*(${usRegions})(?=,\\s*|$)`, "gi");

const hybridCities = new Set([
  "San Francisco",
  "New York City",
  "Austin",
  "London",
  "Berlin",
  "Sydney",
  "Palo Alto",
  "Stockholm",
]);

const countrySuffixes: Record<string, string> = {
  CAN: "Canada",
  CH: "Switzerland",
  IE: "Ireland",
  UK: "UK",
};

function normalizePlace(place: string) {
  return place
    .trim()
    .replace(
      /,\s*(CAN|CH|IE|UK)$/i,
      (_, code: string) => `, ${countrySuffixes[code.toUpperCase()]}`,
    );
}

function separateKnownPlaces(part: string): string[] {
  // A repeated city/state pattern is evidence of multiple US places; commas
  // inside a single address (e.g. "New York City, New York, United States") are not.
  const matches = [...part.matchAll(usPlace)];
  if (
    matches.length > 1 &&
    matches.map((match) => match[0].trim()).join(", ") === part
  ) {
    return matches.map((match) => match[0].trim());
  }

  // These ATS labels list hybrid cities rather than one geographic place.
  const hybrid = part.match(/^Hybrid\s*[-–]\s*(.+)$/i);
  if (hybrid) {
    const cities = hybrid[1].split(/,\s*/).map((city) => city.trim());
    if (cities.length > 1 && cities.every((city) => hybridCities.has(city))) {
      return cities.map((city) => `Hybrid - ${city}`);
    }
  }

  const alternatives = part.split(/\s+or\s+/i);
  if (
    alternatives.length > 1 &&
    alternatives.every((city) => hybridCities.has(city))
  ) {
    return alternatives;
  }

  return [part];
}

export function splitJobLocations(location: string): string[] {
  return [
    ...new Set(
      location
        .split(/\s*[;|]\s*/)
        .flatMap((part) => separateKnownPlaces(part.trim()))
        .map(normalizePlace)
        .filter(Boolean),
    ),
  ];
}

export function sanitizeLocation(location: string): string {
  return splitJobLocations(location).join(" | ");
}
