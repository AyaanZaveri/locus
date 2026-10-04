import { jobRegionAliases, verifiedJobPlaceAliases } from "./job-location-aliases";

/** A job's locations are distinct places, separated by pipes in the profile. */
const usRegions =
  "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";
const usPlace = new RegExp(`([^,;|]+),\\s*(${usRegions})(?=,\\s*|$)`, "gi");

const hybridCities = new Set([
  "San Francisco",
  "New York City",
  "NYC",
  "Austin",
  "Amsterdam",
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

// Curated places observed on job boards. Never infer a city from a region,
// a country-only label, or a substring inside a remote-work designation.
// The canonical label is shared by profile imports, company filters and search.
const cityAliases: Record<string, string> = {
  "san francisco": "San Francisco, CA",
  "san francisco, ca": "San Francisco, CA",
  "san francisco, california": "San Francisco, CA",
  "san francisco, california, united states": "San Francisco, CA",
  "san francisco hq": "San Francisco, CA HQ",
  "san francisco, ca hq": "San Francisco, CA HQ",
  "new york": "New York, NY",
  "new york city": "New York, NY",
  "nyc": "New York, NY",
  "new york, ny": "New York, NY",
  "new york city, ny": "New York, NY",
  "new york, new york": "New York, NY",
  "new york city, new york, united states": "New York, NY",
  "seattle": "Seattle, WA",
  "seattle, wa": "Seattle, WA",
  "seattle, washington": "Seattle, WA",
  "austin": "Austin, TX",
  "austin, tx": "Austin, TX",
  "austin, texas": "Austin, TX",
  "boston": "Boston, MA",
  "boston, ma": "Boston, MA",
  "boston, massachusetts": "Boston, MA",
  "los angeles": "Los Angeles, CA",
  "los angeles, ca": "Los Angeles, CA",
  "los angeles, california": "Los Angeles, CA",
  "palo alto": "Palo Alto, CA",
  "palo alto, ca": "Palo Alto, CA",
  "mountain view": "Mountain View, CA",
  "mountain view, ca": "Mountain View, CA",
  "san mateo": "San Mateo, CA",
  "san mateo, ca": "San Mateo, CA",
  "chicago": "Chicago, IL",
  "chicago, il": "Chicago, IL",
  "chicago, illinois": "Chicago, IL",
  "dallas, tx": "Dallas, TX",
  "dallas, texas": "Dallas, TX",
  "denver": "Denver, CO",
  "denver, co": "Denver, CO",
  "denver, colorado": "Denver, CO",
  "denver, colorado, united states": "Denver, CO",
  "washington dc": "Washington, DC",
  "washington, d.c.": "Washington, DC",
  "washington, dc": "Washington, DC",
  "london": "London, UK",
  "london, uk": "London, UK",
  "london, united kingdom": "London, UK",
  "london, england": "London, UK",
  "toronto": "Toronto, ON",
  "toronto, on": "Toronto, ON",
  "toronto, canada": "Toronto, ON",
  "toronto, ontario": "Toronto, ON",
  "toronto, ontario, canada": "Toronto, ON",
  "toronto hub": "Toronto, ON Hub",
  "toronto headquarters": "Toronto, ON Headquarters",
  "toronto, on hub": "Toronto, ON Hub",
  "toronto, on headquarters": "Toronto, ON Headquarters",
  "montreal": "Montréal, QC",
  "montréal": "Montréal, QC",
  "montreal, qc": "Montréal, QC",
  "montréal, qc": "Montréal, QC",
  "vancouver": "Vancouver, BC",
  "vancouver, bc": "Vancouver, BC",
  "dublin": "Dublin, Ireland",
  "dublin, ireland": "Dublin, Ireland",
  "amsterdam": "Amsterdam, Netherlands",
  "amsterdam, netherlands": "Amsterdam, Netherlands",
  "munich": "Munich, Germany",
  "munich, germany": "Munich, Germany",
  "stockholm": "Stockholm, Sweden",
  "stockholm, sweden": "Stockholm, Sweden",
  "sydney": "Sydney, NSW",
  "sydney, australia": "Sydney, NSW",
  "sydney, nsw": "Sydney, NSW",
  "sydney, new south wales": "Sydney, NSW",
  "sydney, nsw, australia": "Sydney, NSW",
  "sydney, new south wales, australia": "Sydney, NSW",
  "melbourne": "Melbourne, VIC",
  "melbourne, australia": "Melbourne, VIC",
  "melbourne, vic": "Melbourne, VIC",
  "melbourne, victoria": "Melbourne, VIC",
  "melbourne, vic, australia": "Melbourne, VIC",
  "melbourne, victoria, australia": "Melbourne, VIC",
  "brisbane": "Brisbane, QLD",
  "brisbane, australia": "Brisbane, QLD",
  "brisbane, qld": "Brisbane, QLD",
  "brisbane, queensland": "Brisbane, QLD",
  "brisbane, qld, australia": "Brisbane, QLD",
  "brisbane, queensland, australia": "Brisbane, QLD",
  "tokyo": "Tokyo, Japan",
  "tokyo, japan": "Tokyo, Japan",
  "seoul": "Seoul, South Korea",
  "seoul, south korea": "Seoul, South Korea",
  "mumbai": "Mumbai, India",
  "mumbai, india": "Mumbai, India",
  "warsaw": "Warsaw, Poland",
  "warsaw, poland": "Warsaw, Poland",
  "paris": "Paris, France",
  "paris, france": "Paris, France",
  "berlin": "Berlin, Germany",
  "berlin, germany": "Berlin, Germany",
};

function canonicalPlace(place: string): string {
  if (/\b(distributed|anywhere)\b/i.test(place)) return place;
  if (/^Remote-Friendly\s*\(Travel[- ]Required\)$/i.test(place)) {
    return "Remote-Friendly (Travel Required)";
  }
  if (/^Remote-Friendly\b/i.test(place)) return place;

  const remotePrefix = place.match(/^Remote(?:\s*[-–,]\s*|\s*\((.*)\)$)(.*)$/i);
  const remoteSuffix = place.match(/^(.*?)\s*(?:[-–,]\s*Remote|\(Remote\))$/i);
  if (remotePrefix || remoteSuffix) {
    const eligibility = (remotePrefix ? remotePrefix[1] || remotePrefix[2] : remoteSuffix![1]).trim();
    // Normalize spelling, never turn remote eligibility into an office or split
    // an eligibility list into new independent locations.
    const region = jobRegionAliases[eligibility.toLocaleLowerCase("en")];
    const city = verifiedJobPlaceAliases[eligibility.toLocaleLowerCase("en")];
    return `Remote - ${region || city || eligibility}`;
  }
  if (/^Remote$/i.test(place)) return "Remote";

  // Keep workplace modifiers visible, but don't let them make identical cities
  // different filter options. Do not remove a qualifier we cannot recognize.
  const prefix = place.match(/^(Hybrid\s*[-–]\s*)(.+)$/i);
  const base = prefix ? prefix[2] : place;
  const suffix = base.match(/^(.*?)(\s*(?:\((?:on-?site|hybrid|preferred)\)|HQ|Hub|Headquarters))$/i);
  const name = (suffix ? suffix[1] : base).trim();
  const key = name.toLocaleLowerCase("en");
  const canonical = verifiedJobPlaceAliases[key] || cityAliases[key] || jobRegionAliases[key];
  if (!canonical) return place;
  return `${prefix ? prefix[1] : ""}${canonical}${suffix ? suffix[2] : ""}`;
}

function normalizePlace(place: string) {
  return canonicalPlace(
    place
    .trim()
    .replace(
      /,\s*(CAN|CH|IE|UK)$/i,
      (_, code: string) => `, ${countrySuffixes[code.toUpperCase()]}`,
    ),
  );
}

function separateKnownPlaces(part: string): string[] {
  // Verified on Together's individual postings: alternatives, not one address.
  if (/^Pune or Bangalore, India$/i.test(part)) return ["Pune", "Bangalore"];
  if (/^London & Amsterdam$/i.test(part)) return ["London", "Amsterdam"];
  if (/^Japan \(Tokyo\)$/i.test(part)) return ["Tokyo, Japan"];
  // Keep Firecrawl's preference and remote time-zone restriction intact.
  if (part === "San Francisco, US or Toronto, Canada (Preferred) OR Remote (Americas, UTC-3 to UTC-10)") {
    return ["San Francisco, CA", "Toronto, ON (Preferred)", "Remote - Americas, UTC-3 to UTC-10"];
  }
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

  const cities = part.split(/,\s*/).map((city) => city.trim());
  if (cities.length > 1 && cities.every((city) => hybridCities.has(city))) {
    return cities;
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
  // One verified ATS pattern encloses two explicit US cities in parentheses.
  const listedPlaces = location === "United States (New York | San Francisco)"
    ? "New York | San Francisco"
    : location
        // Verified ATS region labels with explicitly enumerated cities. Keep
        // the broad region, rather than silently narrowing eligibility.
        .replace("Europe (London | Brussels | Munich)", "Europe | London | Brussels | Munich")
        .replace("Middle East (Dubai | Riyadh)", "Middle East | Dubai | Riyadh");
  return [
    ...new Set(
      listedPlaces
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

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
const verifiedRegions = new Set([
  "Europe", "North America", "Americas", "Middle East", "APAC", "APJ", "EMEA", "ANZ", "Worldwide",
  "Arizona", "California", "New Jersey", "Ontario", "Ontario, Canada", "Alberta, Canada", "Victoria", "Korea",
]);
for (let first = 65; first <= 90; first++) {
  for (let second = 65; second <= 90; second++) {
    const code = String.fromCharCode(first, second);
    const name = countryNames.of(code);
    if (name && name !== code) verifiedRegions.add(name);
  }
}
const verifiedPlaces = new Set([
  ...Object.values(cityAliases),
  ...Object.values(verifiedJobPlaceAliases),
]);

/** Unknown labels need source review, not a guessed city or subdivision. */
export function getJobLocationReviewIssues(location: string): string[] {
  return splitJobLocations(location).flatMap((place) => {
    if (/^Remote(?: - |$)|^Remote-Friendly\b/i.test(place)) return [];
    const base = place
      .replace(/^Hybrid\s*[-–]\s*/i, "")
      .replace(/\s*(?:\((?:on-?site|hybrid|preferred)\)|HQ|Hub|Headquarters)$/i, "")
      .trim();
    return verifiedPlaces.has(base) || verifiedRegions.has(base) ? [] : [place];
  });
}
