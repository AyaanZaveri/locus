import { City, Country, State } from "country-state-city";
import populationData from "@/data/locations/city-populations.json";

export type ProfileLocation = { label: string; countryCode: string };

type CatalogPlace = ProfileLocation & {
  name: string;
  search: string;
  population: number | null;
};
const populations: Record<string, number> = populationData.populations;

// Product defaults for people looking for startup roles, not a population chart.
const startupHubs: [name: string, country: string, state?: string][] = [
  ["San Francisco", "US", "CA"],
  ["Toronto", "CA", "ON"],
  ["New York City", "US", "NY"],
  ["London", "GB", "ENG"],
  ["Melbourne", "AU", "VIC"],
  ["Sydney", "AU", "NSW"],
  ["Calgary", "CA", "AB"],
  ["Vancouver", "CA", "BC"],
  ["Montreal", "CA", "QC"],
  ["Seattle", "US", "WA"],
  ["Boston", "US", "MA"],
  ["Austin", "US", "TX"],
  ["Los Angeles", "US", "CA"],
  ["Chicago", "US", "IL"],
  ["Denver", "US", "CO"],
  ["Paris", "FR"],
  ["Berlin", "DE"],
  ["Amsterdam", "NL"],
  ["Dublin", "IE"],
  ["Stockholm", "SE"],
  ["Zurich", "CH"],
  ["Lisbon", "PT", "11"],
  ["Barcelona", "ES"],
  ["Singapore", "SG"],
  ["Bengaluru", "IN"],
  ["Tokyo", "JP"],
  ["Seoul", "KR"],
  ["Dubai", "AE"],
  ["Tel Aviv", "IL"],
  ["Shanghai", "CN"],
];
let defaultLocations: CatalogPlace[] | undefined;

function byPopulation(a: CatalogPlace, b: CatalogPlace) {
  return (
    (b.population ?? -1) - (a.population ?? -1) ||
    a.label.localeCompare(b.label)
  );
}

function relevance(place: CatalogPlace, query: string) {
  if (place.name === query || place.search === query) return 3;
  if (place.name.startsWith(query)) return 2;
  if (place.search.startsWith(query)) return 1;
  return 0;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Keep the full city catalog on the server, not in the profile's client bundle.
let catalog: CatalogPlace[] | undefined;
function getCatalog() {
  if (catalog) return catalog;
  const countries = Country.getAllCountries();
  const countryNames = new Map(
    countries.map((country) => [country.isoCode, country.name]),
  );
  const states = new Map(
    State.getAllStates().map((state) => [
      `${state.countryCode}:${state.isoCode}`,
      state.name,
    ]),
  );
  const places: CatalogPlace[] = countries.map((country) => ({
    label: country.name,
    countryCode: country.isoCode,
    name: normalize(country.name),
    search: normalize(country.name),
    population: null,
  }));
  const hubKeys = new Map(
    startupHubs.map(([name, country, state]) => [
      `${country}:${normalize(name)}`,
      state,
    ]),
  );
  const hubs = new Map<string, CatalogPlace>();
  for (const city of City.getAllCities() ?? []) {
    const country = countryNames.get(city.countryCode);
    const state = states.get(`${city.countryCode}:${city.stateCode}`);
    const label = [city.name, state !== city.name ? state : undefined, country]
      .filter(Boolean)
      .join(", ");
    const place: CatalogPlace = {
      label,
      countryCode: city.countryCode,
      name: normalize(city.name),
      search: normalize(label),
      population:
        populations[`${city.countryCode}:${city.stateCode}:${city.name}`] ??
        null,
    };
    places.push(place);
    const key = `${city.countryCode}:${place.name}`;
    if (
      hubKeys.has(key) &&
      (!hubKeys.get(key) || hubKeys.get(key) === city.stateCode)
    ) {
      const previous = hubs.get(key);
      if (!previous || byPopulation(place, previous) < 0) hubs.set(key, place);
    }
  }
  catalog = [
    ...new Map(places.map((place) => [place.label, place])).values(),
  ].sort(byPopulation);
  defaultLocations = startupHubs.flatMap(([name, countryCode]) => {
    const place = hubs.get(`${countryCode}:${normalize(name)}`);
    return place ? [place] : [];
  });
  return catalog;
}

export const PROFILE_LOCATION_PAGE_SIZE = 40;

export function searchProfileLocations(
  query: string,
  offset = 0,
  limit = PROFILE_LOCATION_PAGE_SIZE,
): ProfileLocation[] {
  const normalized = normalize(query).slice(0, 120);
  const places = getCatalog();
  const tokens = normalized.split(/[\s,]+/).filter(Boolean);
  const matches = normalized
    ? places
        .filter((place) =>
          tokens.every((token) => place.search.includes(token)),
        )
        .sort(
          (a, b) =>
            relevance(b, normalized) - relevance(a, normalized) ||
            byPopulation(a, b),
        )
    : defaultLocations!;
  return matches
    .slice(offset, offset + limit)
    .map(({ label, countryCode }) => ({ label, countryCode }));
}

export function resolveProfileLocationCountryCode(
  label: string,
): string | null {
  const query = normalize(label);
  if (!query) return null;
  return (
    getCatalog().find((place) => place.search === query)?.countryCode ?? null
  );
}
