# `company.json` authoring guide

Every company profile lives at `data/companies/<slug>/company.json` and is
validated at runtime by [`lib/company-profile.ts`](../../lib/company-profile.ts).
That Zod schema is the executable source of truth; this guide is the compact
contract for people and agents authoring data.

`company-profile.schema.json` is the generated, machine-readable version of
that contract. Regenerate it after changing the Zod schema:

```sh
npm run generate:company-schema
```

Validate every profile before relying on new data:

```sh
npm run validate:companies
```

## Conventions

- Use `null` when a known nullable value is unavailable. Do not invent values
  or links.
- URLs must be absolute `https://` or `http://` URLs. New images live in the
  separate public image repository (`https://gitlab.com/aytozuno21/locus-images`)
  and should use its GitLab Pages URL, for example
  `https://locus-images-b3c414.gitlab.io/companies/mintlify/images/logo.webp`.
  Do not add new images under this app's `public/` directory.
- Dates use `YYYY-MM-DD`; use `null` if the announcement date is unknown.
- Monetary values are always USD. `amount` is the unformatted number and
  `display` is the UI-ready value (for example, `67000000` and `"$67M"`).
- `sourceUrl` should point to the best evidence for a funding round, person,
  or activity. It may be a company post, press release, or reputable coverage.
- `activity.time` is display text; `activity.dateTime` is a machine-readable
  date or timestamp.

## Automatic image publication for company research

A normal `/company-profile-research` run includes image sourcing and publication
and Neon import automatically, without a separate images request. Only an
explicit research-only/dry-run/no-publish request skips these writes.

- Use the image checkout `/Users/ayaanzaveri/Code/locus-images`, whose remote is
  `https://gitlab.com/aytozuno21/locus-images`. Do not save new images in this
  application's `public/` folder.
- Download company logo/banner to `public/companies/<slug>/images/`, portraits
  to `public/companies/<slug>/people/<person-slug>/avatar.<ext>`, and investor
  logos to shared `public/investors/` in that image checkout. Reuse suitable
  verified existing images. Use new filenames when replacing published images.
- Run the research skill's `scripts/image_assets.py check` on added/changed
  assets, then automatically commit and push only those assets to `origin/main`.
  Inspect staged changes and preserve unrelated work; never force-push.
- Wait for GitLab Pages publication, then verify each anonymous hosted URL
  returns decodable image bytes with the appropriate MIME type. Use
  `https://locus-images-b3c414.gitlab.io/` plus the path relative to `public/`.
- Set `logo`, `banner`, `people[].image`, and investor `logo` fields to verified
  hosted URLs; validate the payload, run `npm run db:import -- /absolute/path/to/company.json`,
  and verify the image URLs in the stored Neon profile. An images-only import
  must preserve the existing jobs and people collections.

Do not stop after researching or downloading images. Publication and import
are completion gates. Report actual access/deployment/import failures rather
than assuming publication is unavailable or substituting `null` for a failed
deployment. Use `null` only for images that genuinely cannot be sourced and
verified, and keep valid existing images on a failed refresh.

## Required top-level shape

```ts
{
  slug: string,                 // lowercase letters, numbers, and hyphens only
  name: string,
  tagline: string,
  description: string,
  website: string | null,
  foundedYear: number | null,
  banner: string | null,
  bannerPosition?: string,
  bannerOffsetY?: number,
  logo: string | null,
  industry: string,            // trimmed, non-empty primary category; no fixed list
  location: { label: string, countryCode: string, locationId?: string | null, sourceLabel?: string },
  stage: string,
  employees: string,
  financials: {
    totalFunding: Money | null, // null when no amount has been disclosed
    valuation: Money | null,
    annualRevenue: Money | null,
  },
  funding: {
    latestRoundId: string | null, // null when there is no verified round
    investors: Investor[],
    rounds: FundingRound[],
  },
  jobs: Job[],
  people: Person[],
  activity: Activity[],
}
```

## Reusable values

`industry` is a trimmed, non-empty string naming one primary category. There is
no fixed list: new categories do not require an app release or schema change.
Directory filters derive their choices from the stored company records.

Choose a concise, evidence-backed label for the company's main product or
market. Reuse an existing database label when it accurately fits, including its
capitalization, to avoid splitting equivalent categories. Otherwise create a
clear new label rather than forcing an inaccurate match. For example, HiringCafe
belongs in `Job Search`, not general `Web Search`.

Use title case while preserving acronyms such as AI. Put product-specific nuance
and supporting evidence in `tagline` and `description`, not in the category label.
Do not use a sentence, a comma-separated category list, or placeholders such as
`Unknown` or `Other`. If the category cannot be verified, resolve that uncertainty
before importing the required field.

```ts
type Money = {
  amount: number; // non-negative, unformatted USD amount
  currency: "USD";
  display: string; // e.g. "$45M"
};

type Investor = {
  name: string;
  website: string | null;
  logo?: string | null;
};

type FundingRound = {
  id: string; // referenced by funding.latestRoundId
  stage: string;
  announcedAt: "YYYY-MM-DD" | null;
  amount: Money;
  valuation: Money | null;
  leadInvestors: Investor[];
  investors: Investor[];
  sourceUrl: string | null;
};

type Job = {
  title: string;
  location: string; // normalized verified places separated by " | "; commas stay within one place
  // Canonical references; location is a compatibility display derived from these.
  locations?: {
    locationId: string | null;
    label: string;
    relation: "office" | "eligibility" | "unspecified";
    qualifier: string | null;
    sourceLabel: string;
  }[];
  focus: string;
  url?: string | null;
  // Almost-lossless, sanitized CommonMark transcription of the full posting.
  // Preserve every substantive heading, paragraph, list, and detail; do not
  // summarize facts that are also in structured fields. Remove only application
  // UI, navigation, scripts/tracking, and generic legal/privacy boilerplate.
  description?: string | null;
  status?: "open" | "closed" | "unknown" | null;
  workplaceType?: "remote" | "hybrid" | "onsite" | "flexible" | null;
  employmentType?: "full-time" | "part-time" | "contract" | "internship" | "temporary" | null;
  department?: string | null;
  skills?: string[];
  experience?: {
    minimumYears?: number | null;
    maximumYears?: number | null;
    level?: "intern" | "entry" | "mid" | "senior" | "staff" | "principal" | "manager" | "director" | "executive" | null;
    acceptsNewGrads?: boolean | null;
  } | null;
  compensation?: {
    salary?: {
      minimum: number | null;
      maximum: number | null;
      currency: string; // ISO 4217, e.g. USD or GBP
      period: "hour" | "month" | "year";
    } | null;
    equity?: {
      minimumPercent: number | null;
      maximumPercent: number | null;
    } | null;
  } | null;
  visa?: {
    // False powers “US visa not required”; this is distinct from sponsorship.
    requiresUSWorkAuthorization?: boolean | null;
    sponsorship?: "available" | "unavailable" | "unknown";
    citizenshipRequired?: boolean | null;
  } | null;
  interviewProcess?: {
    available: boolean;
    summary?: string | null;
    url?: string | null;
  } | null;
  postedAt?: "YYYY-MM-DD" | null;
  lastSeenAt?: "YYYY-MM-DD" | null;
};

type Person = {
  name: string;
  role: string;
  image: string | null;
  linkedin: string | null;
  x?: string | null;
  sourceUrl?: string | null;
  isFounder?: boolean;
};

type Activity = {
  type:
    | "documentation"
    | "funding"
    | "growth"
    | "hiring"
    | "news"
    | "people"
    | "product";
  time: string;
  dateTime: string;
  title: string;
  description: string;
  sourceUrl?: string | null;
};
```

### Job location policy

PostgreSQL now stores shared places in `locations`, exact verified aliases in
`location_aliases`, and one job/place reference per row in `job_locations`.
Companies reference the same catalog via `headquarters_location_id`. Do not use
arrays of foreign keys, dataset indices, or display labels as place identity.
Place IDs survive label changes. The `country-state-city` package is an import-time
reference dataset, not a fuzzy geocoder or a browser dependency.

In JSON, use a `locations` array of reference objects. `label` is a canonical
display snapshot, `sourceLabel` preserves provenance, `qualifier` retains HQ,
hybrid or travel restrictions, and `relation: "eligibility"` distinguishes remote
scope from an office. A null ID explicitly preserves an unresolved place or a
non-geographic scope such as a time-zone requirement. Never guess a city for a
country, region, or ambiguous label. Keep `location` for compatibility; parsing
derives it from the references when present. Import accepts legacy strings and
resolves them against the shared catalog. Company location also retains its
original `sourceLabel` alongside `locationId`.

Use `npm run db:migrate-locations -- --report /absolute/report.json` to review a
backfill. Applying requires `--apply --backup /absolute/new-backup.json`. This
command preserves existing job IDs, embeddings, people, and non-location data,
uses an atomic optimistic-concurrency guard, and verifies every stored record.
Do not bulk-seed ignored company caches to perform this migration.

Normalize every job location with the shared deterministic `sanitizeLocation`
normalizer at parse/import boundaries. Use curated verified aliases only; do
not fuzzy-geocode, infer from headquarters, or destructively guess ambiguous
places. Verify ambiguous alternatives against the canonical ATS posting. Split
only explicit or source-verified alternatives, with ` | ` between places and
commas only within a place.

- US, Canadian, and Australian cities use `City, official State/Province
  abbreviation` (Denver, CO; Toronto, ON; Melbourne, VIC; Sydney, NSW;
  Brisbane, QLD).
- Cities in other countries use `City, Country` consistently (London, UK;
  Berlin, Germany; Tokyo, Japan); do not invent an administrative subdivision.
  Preserve country-only labels (Japan) and region/province-only granularity.
- Remote eligibility is not an office or city. Canonicalize as
  `Remote - {original verified eligibility}`; preserve qualifiers such as
  `Remote-Friendly`, travel restrictions, and hybrid/onsite/HQ qualifiers.
  Never guess eligibility or workplace type.

Run `scripts/repair-job-locations.ts` for whole-database drift audits across
profile locations, normalized job rows, and searchable text. Repairs require a
reviewed dry run and backup, atomic optimistic-safe updates, preservation of IDs
and all non-location data, idempotence, and readback of every record. Do not
perform database mutations without authorization.

## Compatibility note

For older data, investor `logoUrl` is normalized to `logo` by the loader.
New files should always use `logo`.

## Database synchronization

Neon is the canonical source for company profiles. `company.json` is a
validated import payload, not a versioned repository record. Keep temporary or
bulk-import JSON outside Git.

After changing profile data:

```sh
npm run db:import -- /absolute/path/to/company.json
```

The importer upserts the company profile and replaces its normalized `jobs` and
`people` rows. Jobs carry the structured filtering fields documented above;
their title, focus, location, department, workplace, employment type, level,
description, and skills form the searchable text. Do not edit those database
rows directly for ordinary research refreshes. `db:seed` imports a local bulk
cache when one is intentionally available.

When changing the contract itself, update `lib/company-profile.ts` first, then
regenerate `company-profile.schema.json`, update `lib/db/schema.ts`, generate a
new Drizzle migration, apply it, and seed:

```sh
npm run generate:company-schema
npm run db:generate
npm run db:migrate
npm run db:seed
```
