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
  industry:
    | "AI Compute"
    | "AI Gateway"
    | "AI Inference"
    | "Database"
    | "Developer Tools"
    | "Energy"
    | "Fintech"
    | "Foundation Models"
    | "Market Intelligence"
    | "Web Search"
    | "Workflow Orchestration",
  location: { label: string, countryCode: string }, // ISO 3166-1 alpha-2, lowercase
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

`industry` is a single, broad primary category. Put product-specific nuance
(for example, GPU cloud or serverless compute) in `tagline` and `description`.
Only these values are valid:

```ts
type Industry =
  | "AI Compute"
  | "AI Gateway"
  | "AI Inference"
  | "Database"
  | "Developer Tools"
  | "Energy"
  | "Fintech"
  | "Foundation Models"
  | "Market Intelligence"
  | "Web Search"
  | "Workflow Orchestration";
```

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
  location: string; // distinct verified places separated by " | "; commas stay within one place
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
