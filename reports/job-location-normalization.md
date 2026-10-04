# Job-location normalization — 2026-10-03

## Database result

- Audited **46 companies and 3,664 jobs**, including both company profile JSON and normalized job rows.
- Updated **431 jobs across 21 companies** in one atomic, optimistic, row-locked SQL statement.
- Preserved job IDs, job counts, all non-location job fields, all other profile fields, and source location order.
- Updated search text alongside each location; full readback confirmed expected values and preserved non-location fingerprints.
- No unresolved place labels remain under the reviewed current-location vocabulary. A post-update dry run must report zero changes.
- Created a private pre-write backup; an additional full pre-audit snapshot is retained outside the repository. Neither contains connection credentials.

## Canonical policy

- US, Canada, Australia: `City, State/Province abbreviation` (Denver, CO; Toronto, ON; Sydney, NSW).
- Elsewhere: `City, Country` (Tokyo, Japan; Bengaluru, India; Cape Town, South Africa).
- Country-only locations stay country-only: `Japan` does not become Tokyo.
- Region/province-only labels retain their granularity. The San Francisco Bay Area remains a region, not the city of San Francisco.
- Separate distinct verified places with ` | `. Commas stay inside a place. Deduplicate equivalent aliases, preserving order.
- Remote eligibility uses `Remote - …`; retain geography lists, time-zone constraints, and travel requirements. Preserve hybrid, on-site, preferred, HQ and Hub qualifiers.
- Exact curated aliases are not a geocoder. Ambiguous bare names require source evidence and qualification, not a headquarters or fuzzy matching guess.

## Source-reviewed exceptions

- Cohere's Ashby structured address data confirms Richmond, **Virginia**, for the Financial Services and Sales Operations roles, and Victoria, **British Columbia**, for the two Canadian annotation roles. Corrections were scoped to those exact posting URLs; bare Richmond and Victoria were not made global city aliases.
  - https://api.ashbyhq.com/posting-api/job-board/cohere
  - https://jobs.ashbyhq.com/cohere/178915c8-8b0c-4735-a428-cd57264280b3
  - https://jobs.ashbyhq.com/cohere/9845c80d-95ba-4769-94a7-62408d73d603
- Cohere's Europe and Middle East postings enumerate region and city alternatives. Normalization keeps the broad region and all explicitly listed cities rather than losing parenthesis fragments or narrowing eligibility.
  - https://jobs.ashbyhq.com/cohere/2d256112-b336-4539-8133-a0bf7f6698f0
  - https://jobs.ashbyhq.com/cohere/291e5dee-dcda-49e6-a1b6-dae0d48f80af
- Together's postings confirm Pune/Bangalore and London/Amsterdam are alternative cities.
  - https://job-boards.greenhouse.io/togetherai/jobs/4840844007
  - https://job-boards.greenhouse.io/togetherai/jobs/5214645007
- Firecrawl's location string and compensation text confirm San Francisco, CA and Toronto, ON; retain the original preferred qualifier and Americas time-zone restriction.
  - https://jobs.ashbyhq.com/firecrawl/2bd672ee-34b1-4702-9432-36ae00bad762

## Future imports and maintenance

The research skill and schema guide document this policy. `sanitizeLocation` runs at profile parsing and ATS collection. The importer now rejects unreviewed labels before any database writes; add verified aliases and tests rather than weakening that gate.

```sh
# Read-only whole-database audit; optional --report /absolute/path.json
npm run db:normalize-job-locations

# Apply reviewed changes, requiring a new backup file; unknown labels block writes
npm run db:normalize-job-locations -- --apply --backup /absolute/path/backup.json

# Source-scoped exceptions may additionally use --overrides /absolute/path.json
npx tsx --test lib/job-location.test.ts lib/job-location-country.test.ts scripts/lib/job-location-repairs.test.ts
```

A zero-change audit proves idempotence for known aliases, not that future ATS names can be guessed safely.
