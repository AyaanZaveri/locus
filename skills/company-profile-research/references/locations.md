# Shared company and job locations

Read this for any company/job location research, import, or repair. The current
executable contract remains authoritative: `lib/company-profile.ts`,
`lib/location-reference.ts`, `scripts/lib/location-catalog.ts`, and
`lib/db/schema.ts`. Also read `data/companies/SCHEMA.md` and its JSON Schema.

## Contract and identity

PostgreSQL `locations` stores shared places, `location_aliases` stores verified
exact aliases, `job_locations` stores ordered job/place associations, and
`companies.headquarters_location_id` references the same catalog. Do not use
foreign-key arrays, labels, reference-dataset indices, or a per-company ID scheme.

Author each job's `locations` array with these fields:

| Field | Meaning |
| --- | --- |
| `locationId` | Verified shared UUID, or null for an unresolved/non-geographic scope. |
| `label` | Canonical display snapshot, not identity. |
| `relation` | `office`, `eligibility`, or `unspecified`, supported by source evidence. |
| `qualifier` | Verified association qualifier, or null. |
| `sourceLabel` | Original source location text for this association. Preserve provenance. |

`office` means a verified office association, not automatically five-day onsite
work. `eligibility` means explicit remote geography or a standalone Remote
option; it does not mean all geography on a remotely eligible role.
`unspecified` means geography is verified but the association is not more specific.

Keep the required `location` string in sync using `locationReferencesDisplay`.
It is a compatibility field: references take precedence when parsed. Separate
places with ` | `; commas stay within a place. Do not fix only this string while
leaving stale structured references, workplace status, or search text behind.

Company `location` retains its required `label` and `countryCode` and may carry
`locationId` and `sourceLabel`. Resolve headquarters independently of jobs; never
infer a job location from headquarters or a financing-release dateline.

### Resolution

- Load the shared catalog and verified aliases before resolving. Reuse existing
  IDs. For genuinely new verified places, use `LocationCatalog`/`resolvePlace`
  and the repository import path; do not fabricate a UUID or hand-edit tables.
- The `country-state-city` package is an import-time reference dataset, not a
  fuzzy geocoder or frontend dependency. Confirm same-name city/state identity:
  New York city is `New York, NY`, not New York state (`New York, United States`).
- US/Canadian/Australian cities use official state/province abbreviations;
  other cities use `City, Country` (London, UK; Tokyo, Japan). Countries and
  subdivisions retain their granularity; Singapore uses its established label.
- Split only explicit/source-verified alternatives. Do not split arbitrary
  commas, geocode destructively, infer cities from territory/title, or invent a
  country for a multinational region. Unresolved scope retains a null ID and
  its source text, with a ledger entry for review.
- Audit distinct source variants against existing labels. Extend only verified
  exact aliases/splitting rules with regression tests. Unchanged output from
  `sanitizeLocation` does not prove a label is recognized.

`countryCode` and `kind` on job references are optional rendering metadata,
hydrated from the shared catalog by `lib/db/location-labels.ts`; do not treat
them as a second author-maintained identity system. The filter uses catalog
metadata, with a fallback only for older records. Indonesia belongs under
Indonesia with its flag; DC-metro area belongs under United States with its
flag even though it is a region. EMEA/APJ span countries: no single-country
flag; group them under Regions. Unknown places stay separate from known regions.

## Evidence workflow: every role

1. Resolve the company's actual careers/ATS board. Use Ketch to read the careers
   page and crawl/enumerate the board, then cross-check the first-party ATS API
   for complete listings, secondary locations, and stable posting identifiers.
   A guessed board slug returning zero jobs is not proof of no openings.
2. Freeze a manifest of source URLs/identifiers, including stored jobs needing
   reconciliation. Ketch-scrape every individual posting and read its full
   substantive body, not just keyword snippets. Check errors, titles, lengths,
   endings, and possible truncation; raise caps/retry incomplete results. A
   crawl returning all links does not establish that all bodies were read.
3. Review each location header and full body against ATS location/workplace
   fields. Take explicit role requirements seriously: ATS Remote flags and
   headers can contradict required office presence in the body. Quote-check
   each claimed requirement against the actual saved source, even if a subagent
   supplied it. Never rely on a paraphrased quote or a guessed posting URL.
4. Determine geography, association relations, and workplaceType separately.
   A city/country header with no arrangement evidence gets workplaceType null.
   Preserve an explicit onsite/hybrid/flexible arrangement. Do not call a role
   remote because it manages a remote team, sells into a region, mentions a
   remote AI colleague, or conducts onsite interviews. Office attendance with
   no stated schedule is not evidence for an invented three-day hybrid policy.
5. Explicit role-specific body requirements can narrow/override a generic
   header or ATS flag; record both sources and the conflict. If neither source
   resolves the conflict, preserve uncertainty and flag it rather than choosing
   arbitrarily. Do not silently rewrite the full description to hide a conflict.
6. Keep a separate ledger for every role: company, stable posting ID/URL,
   fetched-at date, raw header, exact body evidence (when applicable), ATS facts,
   normalized locations/references, workplaceType, reasoning/conflicts, and
   source-body hash or equivalent snapshot linkage. Check quotes actually occur
   in the saved body. Ledger facts do not become unsupported profile fields.
7. Reconcile source and stored role sets; report new/missing/closed/unavailable
   postings. Do not drop roles just because a scrape failed, or equate a dead
   page with verified closure. In large boards, assign disjoint frozen slices
   and track coverage so every role is reviewed exactly once.

### Confirmed unpublished postings

When removal is authorized, retry the exact posting without cache and compare
its stable ID with a fresh complete first-party listing. Remove a stored listing
only when its posting explicitly reports not found (or its verified first-party
detail API returns HTTP 404 Job not found) **and** the current listing excludes
that exact ID. A cookie-only extraction, timeout, 401/403, empty guessed board,
or changed title alone is not removal evidence. Confirm no replacement-ID
mapping on a title guess; track new postings separately.

Use `scripts/remove-unpublished-jobs.ts` with a reviewed manifest, fresh source
and board proofs, and a new absolute backup path. It validates proof, defaults
to dry-run, guards atomic deletion against concurrent changes, removes the
matching embedded jobs and cascading junctions, and verifies every survivor
plus unrelated companies. Confirm the rerun has zero removals. Update the
source-review ledger (`--review-directory data/job-location-reviews`) only after
verification so a future import cannot quietly resurrect an old posting.

Ketch examples (verify current flags with `--help`):

```sh
ketch scrape 'https://company.com/careers' --json --max-chars 30000
ketch crawl 'https://verified-board.example/company' --json --depth 1
ketch scrape /absolute/role-urls.txt --json --no-cache --max-chars 30000 --concurrency 5
```

Save large outputs to a research file and inspect bounded summaries; an output
budget never permits storing a truncated description. ATS APIs complement, not
replace, source reads. Use the main skill's Ketch → DonSeTch fallback policy.

## Examples and regression cases

IDs below are intentionally null in **pre-resolution authoring examples**.
Resolve verified places to their shared IDs before import; never copy invented
example UUIDs. Do not import these null-city examples blindly through the legacy
remote inference path described below.

### Remote or independently listed cities

Source: `Remote; New York; San Francisco`, no body restriction.

```json
{
  "workplaceType": "remote",
  "location": "Remote | New York, NY | San Francisco, CA",
  "locations": [
    {"locationId": null, "label": "Remote", "relation": "eligibility", "qualifier": null, "sourceLabel": "Remote"},
    {"locationId": null, "label": "New York, NY", "relation": "unspecified", "qualifier": null, "sourceLabel": "New York"},
    {"locationId": null, "label": "San Francisco, CA", "relation": "unspecified", "qualifier": null, "sourceLabel": "San Francisco"}
  ]
}
```

Do not turn either city into `Remote - City`, or claim remote is worldwide.
`workplaceType: remote` records an available remote arrangement, not an
assertion that all listed cities restrict that arrangement.

### Explicit remote eligibility

Source explicitly says remote in Singapore or Australia:

```json
{
  "workplaceType": "remote",
  "location": "Remote - Singapore | Remote - Australia",
  "locations": [
    {"locationId": null, "label": "Singapore", "relation": "eligibility", "qualifier": null, "sourceLabel": "Remote - Singapore"},
    {"locationId": null, "label": "Australia", "relation": "eligibility", "qualifier": null, "sourceLabel": "Remote - Australia"}
  ]
}
```

Country eligibility stays a country. Do not invent Sydney for Australia.

### Unknown arrangement and conflicting requirements

- Header `Singapore`, ATS Remote, body does not establish arrangement:
  Singapore reference `unspecified`, workplaceType null; record the ATS conflict.
- Header `Remote; SF; NYC`, body requires presence in SF or NYC offices but
  provides no schedule: remove the unsupported Remote option; verified offices
  can use `office`, workplaceType null; record header/body conflict.
- Body explicitly requires five office days weekly: workplaceType onsite,
  verified city association `office`.
- Explicit hybrid New York: canonical **city** ID, relation office, preserve
  the Hybrid qualifier/source text. Strip Remote/Hybrid prefixes when resolving
  geography; never accidentally resolve New York city to New York state.
- APJ header, body explicitly permits Singapore or Sydney: those are the job
  bases. APJ is not evidence for every APJ country; territory names in a title
  are not extra locations.

## Import and repair gates

### Known legacy inference hazard

Inspect the actual importer before writing. `LocationCatalog.references` can
default a named geography to `eligibility` solely because workplaceType is
remote. The current seeder disables this default for Cursor and companies with
an audit under `data/job-location-reviews/`, **not every other company**.
`scripts/lib/reviewed-job-locations.ts` applies those reviewed references and
workplace facts and refuses unreviewed URLs. ATS-only sync is blocked for these
companies. An incomplete audit excludes unavailable roles; importing a payload
containing those roles therefore stops before writes rather than inventing facts.
Existing resolved references preserve their relations, but null-ID
references may be re-resolved through the legacy default. `parseCompanyProfile`
also derives display text from references, so a string-only correction is lost.

For all companies, resolve source-reviewed labels with
`{ inferRemoteEligibility: false }`, then assign evidence-backed relations and
derive the display. Preflight the same `catalog.job`/parser path the importer
will use; compare IDs, order, relations, qualifiers, labels, sourceLabel,
derived display, and workplaceType. Null-ID references are re-resolved from
sourceLabel, so an authored relation/qualifier alone may not survive import.
If that path changes an independently listed city into remote eligibility,
**stop before writes** and fix/test the scoped import path. Do not compensate
with invented IDs or label prefixes. Do not blindly rerun an ATS sync: it can
overwrite reviewed workplace facts. Cursor's ATS-only sync is intentionally
blocked; its checked-in audit applies only to that company's reviewed URLs.

Run relevant checks before import (and any added regression cases):

```sh
npm run typecheck
npm run validate:companies
npm run validate:job-markdown
npx tsx --test lib/job-location*.test.ts lib/location-query.test.ts scripts/lib/location-catalog.test.ts scripts/lib/cursor-location-repair.test.ts
```

Use the standard profile importer for an authorized full profile import.
For a location/workplace-only repair, do **not** replace jobs/people by importing
the entire profile: that can regenerate IDs and overwrite unrelated data.
Use a reviewed scoped repair with a new absolute backup path, atomic optimistic
concurrency protection, preserved IDs/non-location fields, and no other-company
changes. WorkplaceType/search updates are in scope when correcting workplace
classification. Cursor's `repair-cursor-remote-locations.ts` and
`build-cursor-location-audit.ts` are implementation examples, not all-company
commands. A catalog backfill is not a source/workplace audit.

After writes, verify every role's embedded profile and normalized job row,
ordered `job_locations` references, workplace_type, display string, and affected
search text. Verify company headquarters FK/profile identity if changed. Confirm
equivalent aliases share IDs; no city/state collision, false remote chip,
duplicate filter identity, country flag on a multinational region, or lost
qualifier remains. Repeat the reviewed transformation and require zero changes;
confirm unrelated jobs/companies are unchanged and scoped-repair job IDs are
preserved. Full profile imports replace job/people rows: verify their new rows
and junctions rather than claiming IDs were preserved. A no-op normalizer or
schema pass alone cannot establish source accuracy.

Provide the role-by-role source-linked ledger, coverage/failures/conflicts,
before/after counts, backups, readback results, and deployment status. Any future
sync/import path must preserve the reviewed semantics or fail for review when
sources change. Do not claim a finished batch if any role remains unreviewed.
