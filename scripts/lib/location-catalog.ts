import { createHash } from "node:crypto";
import { City, Country, State } from "country-state-city";
import {
  sanitizeLocation,
  splitJobLocations,
  getVerifiedLocationAliases,
} from "../../lib/job-location";
import {
  type LocationReference,
  locationReferencesDisplay,
} from "../../lib/location-reference";

export type CanonicalLocation = {
  id: string;
  identityKey: string;
  name: string;
  displayLabel: string;
  kind: "city" | "country" | "subdivision" | "region";
  countryCode: string | null;
  subdivisionCode: string | null;
};
export const aliasKey = (value: string) => value.trim().toLocaleLowerCase("en");
const countries = Country.getAllCountries();
const states = State.getAllStates();
const countryNames: Record<string, string> = {
  uk: "GB",
  "united kingdom": "GB",
  usa: "US",
  us: "US",
  "united states": "US",
  "south korea": "KR",
  "united arab emirates": "AE",
  czechia: "CZ",
  taiwan: "TW",
  "hong kong": "HK",
};
const regions = new Set([
  "APAC",
  "APJ",
  "ANZ",
  "EMEA",
  "Europe",
  "North America",
  "Americas",
  "Middle East",
  "San Francisco Bay Area, CA",
  "Bay Area, CA",
  "DC-metro area",
  "US West",
]);
const cityNames: Record<string, string> = {
  "New York": "New York City",
  Zürich: "Zurich",
  "Makati City": "Makati",
  Washington: "Washington, D.C.",
};
// Explicitly reviewed lists from the inventory; never split arbitrary commas.
const eligibilityLists: Record<string, string[]> = {
  "APAC, Singapore, Hong Kong": ["APAC", "Singapore", "Hong Kong"],
  "Americas, Canada": ["Americas", "Canada"],
  "Germany, United Kingdom, Ireland": ["Germany", "United Kingdom", "Ireland"],
  "India, Singapore": ["India", "Singapore"],
  "Ireland, United Kingdom": ["Ireland", "United Kingdom"],
  "Spain, United Kingdom, Ireland, Poland": [
    "Spain",
    "United Kingdom",
    "Ireland",
    "Poland",
  ],
  "United Kingdom, Ireland": ["United Kingdom", "Ireland"],
};

/** Our ID, not a dataset array index. Existing aliases override this at import. */
function make(
  kind: CanonicalLocation["kind"],
  name: string,
  countryCode: string | null,
  subdivisionCode: string | null,
  displayLabel: string,
): CanonicalLocation {
  const identityKey = [
    kind,
    countryCode ?? "",
    subdivisionCode ?? "",
    aliasKey(name),
  ].join(":");
  const hex = createHash("sha256")
    .update(`autumn:location:v1:${identityKey}`)
    .digest("hex")
    .slice(0, 32)
    .split("");
  hex[12] = "8";
  hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16);
  const raw = hex.join("");
  const id = `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
  return {
    id,
    identityKey,
    kind,
    name,
    countryCode,
    subdivisionCode,
    displayLabel,
  };
}

export function resolvePlace(
  value: string,
  countryHint?: string,
): CanonicalLocation | null {
  const label = sanitizeLocation(value);
  if (label.includes(" | ")) return null;
  if (/[()]/.test(label)) return null; // Unreviewed commentary is not geography.
  // Tourism authority explicitly identifies Abu Dhabi City; the package only
  // contains municipality/island records. Do not substitute either for the city.
  // https://www.visitabudhabi.ae/
  if (label === "Abu Dhabi, United Arab Emirates")
    return make("city", "Abu Dhabi", "AE", null, label);
  if (label === "Singapore")
    return make("city", "Singapore", "SG", null, "Singapore");
  const region = [...regions].find((r) => aliasKey(r) === aliasKey(label));
  if (region)
    return make(
      "region",
      region,
      /Bay Area|DC-metro|US West/.test(region) ? "US" : null,
      null,
      region,
    );
  const country =
    countries.find((c) => aliasKey(c.name) === aliasKey(label)) ??
    countries.find((c) => c.isoCode === countryNames[aliasKey(label)]);
  if (country) {
    const name =
      country.isoCode === "KR"
        ? "South Korea"
        : country.isoCode === "CZ"
          ? "Czechia"
          : country.isoCode === "TW"
            ? "Taiwan"
            : country.isoCode === "HK"
              ? "Hong Kong"
              : country.name;
    return make("country", name, country.isoCode, null, name);
  }
  const parts = label.split(",").map((p) => p.trim());
  let code = countryHint?.toUpperCase();
  // Reviewed region-only labels already present in our source inventory.
  const subdivisionCountries: Record<string, string> = {
    Alaska: "US",
    Arizona: "US",
    California: "US",
    Hawaii: "US",
    Idaho: "US",
    Montana: "US",
    "New Jersey": "US",
    Ontario: "CA",
    Oregon: "US",
    Washington: "US",
    Wyoming: "US",
  };
  code ??= subdivisionCountries[label];
  let stateCode: string | undefined;
  if (parts.length >= 2) {
    const suffixCountry = countries.find(
      (c) => aliasKey(c.name) === aliasKey(parts.at(-1)!),
    );
    code =
      suffixCountry?.isoCode ?? countryNames[aliasKey(parts.at(-1)!)] ?? code;
    const stateMatches = states.filter(
      (s) =>
        (!code || s.countryCode === code) &&
        (aliasKey(s.name) === aliasKey(parts[1]) || s.isoCode === parts[1]) &&
        ["US", "CA", "AU"].includes(s.countryCode),
    );
    const matchedStates =
      stateMatches.length > 1
        ? stateMatches.filter((s) =>
            (City.getCitiesOfState(s.countryCode, s.isoCode) ?? []).some(
              (c) =>
                aliasKey(c.name) === aliasKey(cityNames[parts[0]] ?? parts[0]),
            ),
          )
        : stateMatches;
    if (matchedStates.length === 1) {
      code = matchedStates[0].countryCode;
      stateCode = matchedStates[0].isoCode;
    }
  }
  // Country context is mandatory: never globally geocode bare ambiguous names.
  if (!code) return null;
  const state = states.filter(
    (s) => s.countryCode === code && aliasKey(s.name) === aliasKey(parts[0]),
  );
  if (state.length === 1 && !stateCode)
    return make(
      "subdivision",
      state[0].name,
      code,
      state[0].isoCode,
      `${state[0].name}, ${countries.find((c) => c.isoCode === code)!.name}`,
    );
  const cityName = cityNames[parts[0]] ?? parts[0];
  const cities = (City.getCitiesOfCountry(code) ?? []).filter(
    (c) =>
      aliasKey(c.name) === aliasKey(cityName) &&
      (!stateCode || c.stateCode === stateCode),
  );
  if (cities.length !== 1) return null;
  const city = cities[0];
  const name = parts[0] === "Makati City" ? "Makati" : parts[0];
  const displayLabel = ["US", "CA", "AU"].includes(code)
    ? `${name}, ${city.stateCode}`
    : `${name}, ${code === "GB" ? "UK" : code === "KR" ? "South Korea" : countries.find((c) => c.isoCode === code)!.name}`;
  return make(
    "city",
    name,
    code,
    ["US", "CA", "AU"].includes(code) ? city.stateCode : null,
    displayLabel,
  );
}

/** Qualifiers describe an association, not a different geographic identity. */
export function resolveSourcePlace(
  sourceLabel: string,
): CanonicalLocation | null {
  return resolvePlace(sourceLabel.replace(/^(?:Remote|Hybrid)\s*-\s*/i, ""));
}

export class LocationCatalog {
  places = new Map<string, CanonicalLocation>();
  aliases = new Map<string, string>();
  unresolved = new Set<string>();
  constructor(
    existing: CanonicalLocation[] = [],
    aliases: { alias: string; locationId: string }[] = [],
  ) {
    for (const place of existing) this.places.set(place.id, place);
    for (const alias of aliases)
      this.aliases.set(alias.alias, alias.locationId);
  }
  place(label: string, countryHint?: string) {
    const existingId = this.aliases.get(aliasKey(label));
    const place = existingId
      ? this.places.get(existingId)!
      : resolvePlace(label, countryHint);
    if (!place) return null;
    const stored =
      [...this.places.values()].find(
        (p) => p.identityKey === place.identityKey,
      ) ?? place;
    this.places.set(stored.id, stored);
    for (const alias of [label, sanitizeLocation(label), stored.displayLabel]) {
      const key = aliasKey(alias);
      if (this.aliases.has(key) && this.aliases.get(key) !== stored.id)
        throw new Error(`Ambiguous alias: ${alias}`);
      this.aliases.set(key, stored.id);
    }
    return stored;
  }
  seedVerifiedAliases() {
    for (const [alias, label] of Object.entries(getVerifiedLocationAliases())) {
      const place = [...this.places.values()].find(
        (p) => p.displayLabel === label,
      );
      if (!place) continue; // Qualifiers and places outside this catalog stay out.
      const existing = this.aliases.get(aliasKey(alias));
      if (
        existing &&
        existing !== place.id &&
        this.places.get(existing)?.kind === "subdivision" &&
        place.kind === "city"
      ) {
        // A staged company-only repair can add a correct city before the broad
        // backfill replaces mistaken state links. Keep the shared old alias until
        // that backfill, so other companies' existing links remain searchable.
        continue;
      }
      if (existing && existing !== place.id)
        throw new Error(`Conflicting verified alias: ${alias}`);
      this.aliases.set(aliasKey(alias), place.id);
    }
  }
  references(
    location: string,
    workplaceType?: string | null,
    options: { inferRemoteEligibility?: boolean } = {},
  ): LocationReference[] {
    return splitJobLocations(location).flatMap((sourceLabel) => {
      let label = sourceLabel;
      let relation: LocationReference["relation"] =
        workplaceType === "remote" && options.inferRemoteEligibility !== false
          ? "eligibility"
          : workplaceType === "onsite" || workplaceType === "hybrid"
            ? "office"
            : "unspecified";
      let qualifier: string | null = null;
      if (/^Remote-Friendly/i.test(label)) {
        relation = "eligibility";
        const match = label.match(/^Remote-Friendly,\s*(.+)$/i);
        if (!match)
          return {
            locationId: null,
            label,
            relation,
            qualifier: null,
            sourceLabel,
          };
        label = match[1];
        qualifier = "Remote-Friendly";
      } else if (/^Remote(?:\s*-\s*|$)/i.test(label)) {
        relation = "eligibility";
        label = label.replace(/^Remote\s*-?\s*/i, "") || "Remote";
      }
      if (/^Hybrid - /i.test(label)) {
        qualifier = "(Hybrid)";
        label = label.replace(/^Hybrid - /i, "");
        relation = "office";
      }
      if (relation === "eligibility" && eligibilityLists[label])
        return eligibilityLists[label].map((item) => {
          const place = this.place(item);
          if (!place)
            throw new Error(`Missing verified eligibility place: ${item}`);
          return {
            locationId: place.id,
            label: place.displayLabel,
            relation,
            qualifier: null,
            sourceLabel,
          };
        });
      if (relation === "eligibility" && label === "Americas, UTC-3 to UTC-10") {
        label = "Americas";
        qualifier = "UTC-3 to UTC-10";
      }
      const suffix = label.match(
        /\s+(HQ|Hub|Headquarters|\(Preferred\)|\(On-site\))$/i,
      );
      if (suffix) {
        qualifier = suffix[1];
        label = label.slice(0, -suffix[0].length);
      }
      const candidate =
        options.inferRemoteEligibility === false ? resolvePlace(label) : null;
      // Staged source-reviewed repairs must bypass the old city->state alias
      // before place() registers aliases; otherwise a correct city throws on
      // its display label's mistaken shared alias. Do not change other rows or
      // mutate shared aliases during a company-only repair.
      const hasMistakenStateAlias =
        candidate?.kind === "city" &&
        [label, sanitizeLocation(label), candidate.displayLabel].some(
          (alias) => {
            const id = this.aliases.get(aliasKey(alias));
            return id && this.places.get(id)?.kind === "subdivision";
          },
        );
      const place = hasMistakenStateAlias ? candidate : this.place(label);
      if (hasMistakenStateAlias && place) this.places.set(place.id, place);
      if (place && place.kind !== "city" && relation === "office")
        relation = "unspecified";
      if (
        !place &&
        label !== "Remote" &&
        !/^(Worldwide|Global|UTC[+-]|APAC business hours)/i.test(label)
      )
        this.unresolved.add(sourceLabel);
      return {
        locationId: place?.id ?? null,
        label: place?.displayLabel ?? label,
        relation,
        qualifier,
        sourceLabel,
      };
    });
  }
  job<
    T extends {
      location: string;
      workplaceType?: string | null;
      locations?: LocationReference[];
    },
  >(job: T, options: { inferRemoteEligibility?: boolean } = {}) {
    if (job.locations?.length) {
      const refs = job.locations.flatMap((ref) => {
        if (!ref.locationId)
          return this.references(ref.sourceLabel, job.workplaceType, options);
        const place = this.places.get(ref.locationId!) ?? this.place(ref.label);
        if (!place || place.id !== ref.locationId)
          throw new Error(`Unknown location ID: ${ref.locationId}`);
        return [{ ...ref, label: place.displayLabel }];
      });
      return {
        ...job,
        locations: refs,
        location: locationReferencesDisplay(refs),
      };
    }
    // Preserve original provenance across repeat imports and honor catalog IDs.
    const source = job.locations?.length
      ? [...new Set(job.locations.map((r) => r.sourceLabel))].join(" | ")
      : job.location;
    const refs = this.references(source, job.workplaceType, options);
    return {
      ...job,
      locations: refs,
      location: locationReferencesDisplay(refs),
    };
  }
}
