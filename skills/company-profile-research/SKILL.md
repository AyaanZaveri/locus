---
name: company-profile-research
description: Research companies into validated Autumn company profiles, automatically source and publish images to the locus-images GitLab repository, and import the profile with verified hosted image URLs into Neon. Use for company-profile data work, not prose reports or UI implementation.
---

# Company Profile Research

Return a single valid JSON object for the requested company. The result is data
for a company profile, not a prose report or UI implementation.

## Default invocation: complete research, images, publication, and import

Running this skill for Autumn (for example, “run /company-profile-research on
Heidi Health”) requests the entire workflow, including images and publication.
Do not treat it as research-only unless the user explicitly requests a dry run,
JSON-only output, or no publishing/database changes. No separate “do the images”
prompt or routine confirmation is needed.

1. Research the company and source its logo, banner, current employee portraits,
   and investor logos. Reuse verified existing assets when suitable. Images are
   part of every full run, not an optional follow-up.
2. Save accepted images to `/Users/ayaanzaveri/Code/locus-images/public/`, using
   the paths below. Check the checkout's remote points to
   `gitlab.com/aytozuno21/locus-images` and read its README. If the checkout is
   absent, locate or clone that repository using available credentials.
3. Run `scripts/image_assets.py check` over every added/changed image. Reject
   invalid or blank files; preserve alpha and account for background-only marks.
4. Stage only the intended assets, inspect the staged diff, commit, and push to
   `origin/main` automatically. Preserve unrelated changes; never force-push,
   include secrets, or overwrite other work. Reuse existing published files
   without an empty commit when nothing changed. Use new filenames for replaced
   images to avoid stale CDN/browser caches.
5. Wait for GitLab Pages publication and verify each image URL anonymously:
   successful HTTP response, correct image MIME type, and decodable image bytes.
   Use `https://locus-images-b3c414.gitlab.io/` plus its path relative to `public/`.
6. Put those verified URLs in `logo`, `banner`, `people[].image`, and investor
   `logo` fields throughout the validated profile. Import the complete payload
   with `npm run db:import -- /absolute/path/to/company.json` from Autumn, then
   verify the stored company profile in Neon contains the intended image URLs.
   Preserve existing jobs/people when doing an images-only refresh, since the
   importer replaces those collections.

Finish only after publication, URL checks, validation, and database import have
succeeded. If authentication, push, deployment, or import actually fails, report
the precise failing step and retain the payload/assets for retry. Do not assume
publishing is unavailable without trying the configured checkout and credentials,
or silently use `null` to conceal a deployment failure. `null` is appropriate
only when no attributable, usable image can be verified after sourcing attempts;
preserve a valid existing image rather than removing it on a failed refresh.

## Autumn contract: source of truth

When Autumn is the destination, do not use a generic, legacy, or inferred
output shape. At the repository root, read these files before researching or
writing data:

1. `data/companies/SCHEMA.md` for authoring conventions.
2. `data/companies/company-profile.schema.json` for the exact machine-readable
   contract.
3. `lib/company-profile.ts` for the executable Zod schema, normalization, and
   TypeScript types.
4. `lib/location-reference.ts`, `scripts/lib/location-catalog.ts`, and
   `lib/db/schema.ts` for shared place identities and location references.
5. One or two recent `data/companies/*/company.json` records for local
   conventions.

The Zod schema is authoritative. The generated JSON Schema is its
machine-readable companion. If documentation and Zod disagree, follow Zod and
report the documentation gap. `z.infer` is for TypeScript consumers; it is not
a substitute for the JSON Schema when an agent needs to author data.

Autumn output must conform exactly to `companyProfileSchema`: no `company`
wrapper, `recentActivity`, `logoUrl`, or `imageUrl` aliases. Use `null` for an
unknown nullable scalar and `[]` for an unverified collection. Do not add
placeholder strings, guessed URLs, dates, or zero values.

## Repository output conventions

When saving to Autumn, inspect an existing record first and match its current
top-level profile schema. Neon is the canonical source of company, job, and
people data; `company.json` is a validated import payload, not a tracked
repository record. Do not hand-edit normalized database tables.

- Write the validated result to a temporary JSON file, then import it with
  `npm run db:import -- /absolute/path/to/company.json`. Do not commit the
  payload under `data/companies/`.
- Store company assets under `public/companies/{slug}/images/` in the **separate public GitLab repo** at `/Users/ayaanzaveri/Code/locus-images/`, not in this app repo. Reference the published GitLab Pages URL: `https://locus-images-b3c414.gitlab.io/companies/{slug}/images/{filename}`.
- Use semantic names such as `banner.{ext}` and `logo.{ext}`; preserve the source format unless conversion is necessary.
- Store downloaded person portraits under `public/companies/{slug}/people/{person-slug}/avatar.{ext}` in the image repo and use the same GitLab Pages URL prefix.
- Preserve the repository keys `banner`, `logo`, `employees`, `financials`, `funding`, `jobs`, `people`, and `activity`.
- Format `employees` as a number, numeric range, or supported lower bound followed
  by ` employees`: `300 employees`, `11–50 employees`, `5,000+ employees`.
  A `+` is valid when the source supports "at least" or "more than"; preserve it
  rather than turning a lower bound into an exact count. Omit "approximately",
  "estimated", source names, dates, parentheses, brackets, and explanatory notes
  from this display field. Keep that provenance and uncertainty in the separate
  research/evidence ledger instead. Preserve supported numbers/range endpoints;
  do not invent a count, midpoint, or upper bound to satisfy the format.
  Before import, check both `profile.employees` and `companies.employee_count`
  use this format and match; verify both again on database readback.
- Store investor logos in the **shared** `public/investors/` folder of the image repo, named `{slug}.{ext}`, and reference them as `https://locus-images-b3c414.gitlab.io/investors/{slug}.{ext}`. Check for an existing file first and reuse it; only download when absent. Prefer our hosted URL over a third-party proxy URL.
- Never reference an asset URL that has not been deployed to the public GitLab Pages site. Do not add new images to this app repo's `public/` directory.
- Validate JSON syntax, confirm every referenced image exists in the image repo and loads anonymously from GitLab Pages, and run
  this skill's `scripts/image_assets.py check` over downloaded assets before
  finishing.

### Autumn schema gate

When the result will be saved to Autumn, the repository schema is the contract.
No legacy generic output shape is valid for Autumn and must not be used.
Read `data/companies/SCHEMA.md`,
`data/companies/company-profile.schema.json`, `lib/company-profile.ts`, and a
current `data/companies/*/company.json` before writing.

- Preserve every required key and its expected primitive type, including nested funding-round and person fields.
- Unknown optional facts must remain `null` (or `[]` for collections). In particular, `funding.rounds[].announcedAt` may be `null` when no reliable date exists; never invent a date just to satisfy validation.
- Use the same `slug` for the import payload and the image repo's `public/companies/{slug}/` assets.
- Before importing, validate the payload with `parseCompanyProfile` or the
  import command. A record that cannot validate must not be presented as
  complete.
- After changing profile data, run `npm run db:import -- /absolute/path/to/company.json`.
  It upserts `companies` and replaces the company’s normalized `jobs` and
  `people` rows.
- **Before importing a profile with new/updated images**, commit and push only
  its assets in `/Users/ayaanzaveri/Code/locus-images/` to `origin/main`.
  Wait for the GitLab Pages pipeline to succeed and verify an anonymous HTTPS
  request returns the image with the correct MIME type. Then import the JSON
  with full hosted URLs into Neon. Do not commit images to the Locus app or
  redeploy it for an image change. Check `git status` and staged diffs in the
  *image repo*; never commit temporary JSON payloads, secrets, or unrelated
  changes. For research-only requests, do not create a commit.
- Older ignored `data/companies/*/company.json` caches may still contain
  `/companies/...` or `/investors/...` paths from before the migration. Do not
  run `npm run db:seed` without an explicit, audited import payload: that could
  restore broken local image references to Neon. Convert any legacy asset paths
  to published GitLab Pages URLs before importing.
- When changing the profile contract, update `lib/company-profile.ts` first,
  regenerate the JSON schema, update `lib/db/schema.ts`, generate and apply a
  Drizzle migration, then seed: `npm run generate:company-schema`, `npm run
db:generate`, `npm run db:migrate`, and `npm run db:seed`.
- Verify URLs, exact ISO dates, monetary values, country codes, and published image URLs individually. An existing value from another company is not evidence for the target company.

## Reusable research workflow

Treat this as structured data collection, not a narrative task. Work in passes:

1. Inspect the target repository schema and existing assets.
2. Search primary sources first: company site, newsroom/blog, official investor announcements, canonical careers board, official social profiles, and—when the company has a Y Combinator profile—the YC company page and linked founder profiles. Use YC as a high-value accelerator source for company facts, batch, founders, team-size snapshot, hiring, founder bios, and founder social/profile-photo links; cross-check changeable facts against current first-party sources.
3. Load the `ketch` skill and use Ketch first: `search` for discovery and exact dates, `scrape` for known URLs, and `crawl` to enumerate careers boards/blogs/site sections. Ketch can extract JavaScript-heavy ATS pages, including Ashby, without interactive browsing. Follow the Research tools section below for budgets and fallbacks. Cross-check structured first-party job-board APIs such as Greenhouse or Ashby for exhaustive listings and structured role facts.
4. Normalize funding rounds independently. Never merge rounds that share a letter, and never replace a disclosed valuation with an estimate.
   Record a verified accelerator investment, including a YC investment, as its
   own funding round rather than only an accelerator badge. Use the disclosed
   stage (normally `Pre-seed` for the initial YC cheque), amount, investors,
   and best primary `sourceUrl`; add the accelerator to the round's investor
   list and the profile-level `funding.investors` list. Do not infer the amount
   or date from an accelerator's current standard deal: terms, dates, and
   investment structures change, and historical company records must be backed
   by evidence. If the company confirms participation but not its investment
   amount, keep the round out rather than fabricating a zero-value raise.
   - Include only bona fide primary financing rounds in `funding.rounds`.
     Exclude standalone employee/shareholder secondary tenders, liquidity
     events, and authorized but unclosed offerings: they raise no new capital
     for the company and must not inflate the total. Record the announced amount
     of a primary round as announced, even when that round also funds an
     employee secondary tranche. Many companies sell secondaries inside every
     round (Supabase funds "liquidity for the employees" from each raise, up to
     25% of vested stock); the headline figure is still the round size, so do
     not subtract an embedded secondary from a disclosed round amount. The
     distinction is standalone versus embedded, not primary versus secondary
     dollars. If a standalone tender is the company's most newsworthy capital
     event, note it in `activity` rather than `funding.rounds`.
   - Record valuations on one stated basis and say which. A valuation is
     pre-money or post-money and the two differ by the round size, so a profile
     that mixes them is wrong by construction. Prefer the basis the company
     states; if only one is reported, use it and keep `financials.valuation`
     consistent with the latest round. Never silently convert between the two.
   - Audit for omitted rounds, not just reported ones. Search the company's
     funding/newsroom history, investor announcements, credible contemporaneous
     coverage, and regulatory filings where useful. Resolve same-stage
     extensions and community offerings as separate events when evidence shows
     distinct primary financings; exclude unrelated-company or same-name
     contamination.
   - Store `funding.rounds` newest-first. Confirm the profile UI's rendering
     convention before changing presentation code; do not reverse the data
     order merely to compensate for a UI that already reverses it.
   - Sum the included round amounts and reconcile the result to
     `financials.totalFunding.amount`. They must match exactly; a profile whose
     rounds do not sum to its stated total is holding either a missing round, a
     duplicated one, or a rounded total. Reconcile against independent reported
     totals too, but do not force the sum to match a contaminated or
     differently scoped third-party figure.
5. Enumerate all currently open jobs from the canonical board. Every job needs its exact application URL, not the generic careers URL. **Ketch-read the full individual posting before writing its description, locations, or workplaceType; a listing card, search result, or API excerpt is never sufficient.** Preserve the complete substantive copy in sanitized CommonMark, including workplace requirements. It is a transcription field, not a summary. Keep structured facts in parallel, following the location gate below. Close emphasis before a following link and leave whitespace between them (for example, `***Announcement.*** [***Read more***](https://example.com)`). **Do not assume the ATS from the company name.** Derive the actual board from the careers page. Cross-check its public JSON API for complete listing coverage and structured facts; the API complements individual source reads rather than overriding contradictory role requirements:
   - Ashby: `https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true`
   - Greenhouse: `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs`
   - Lever: `https://api.lever.co/v0/postings/{slug}?mode=json`
     An empty `jobs` array from a guessed slug is indistinguishable from a company with no openings, so confirm the slug against the careers page before trusting a zero result. Note also that a company may link its own branded paths (e.g. `/careers/{title}-{id}`) that are not the real application URL; resolve each posting to the underlying ATS URL.

### Job team/category gate

The company Jobs UI builds its **team filter from `jobs[].department`**, not
`jobs[].focus`. Set both fields deliberately for every role; do not use a
mixed label just because the title spans disciplines. Use the role's primary
function and the company's actual team labels where available. For example,
when a company has an applied AI researcher and a separate full-stack engineer,
use `Research` and `Engineering` respectively, **not** `Research & Engineering`
and `Engineering`. The researcher's `focus` should also be `Research`, so
search, cards, and filters remain consistent.

- Treat automated ATS focus/category mapping as a proposal, not verified data.
  Review each distinct `department`/`focus` pair against the individual role
  and the company's careers page, including roles with similar titles.
- Avoid overlapping or compound categories that create duplicate-looking
  filter chips when the roles have clear separate functions. If the company
  genuinely uses a cross-functional team name, preserve it when the role does
  not have a clear primary function; do not split a real team on a guess. But
  an ATS umbrella such as `AI Research & Engineering`, `Research & Research
  Engineering`, or `Engineering & Infra` must not hide unambiguously research
  roles from the `Research` filter. Classify those roles by primary function;
  do not reassign every role in a mixed team with a single blind replacement.
- Before import, list the distinct departments and their roles, then check the
  exact team chips the UI will derive. After import, verify both the JSON
  profile and normalized jobs rows carry the intended `department` and `focus`.
  A valid schema is not proof that the taxonomy is useful.

### Job-location normalization gate

Read [references/locations.md](references/locations.md) before researching,
authoring, importing, or repairing company/job locations. It defines the
structured contract, evidence workflow, examples, and import/readback checks.

- Author `jobs[].locations` as structured references with `locationId`, `label`,
  `relation`, `qualifier`, and `sourceLabel`. `jobs[].location` is only the
  compatibility display derived by `locationReferencesDisplay`, with ` | `
  separating places. Preserve company `location.locationId` and `sourceLabel`.
- Use shared catalog IDs, not labels, dataset indices, guessed UUIDs, or a
  company-specific place registry. Preserve unknown geography with null IDs.
- Ketch-read every individual posting, including its complete body. Reconcile
  headers, secondary locations, explicit workplace requirements, and ATS flags.
  A successful board crawl or schema validation is not a complete role audit.
- Keep geography independent from workplace arrangement. `Remote; New York;
  San Francisco` means remote **or** those cities, not remote restricted to
  those cities. Only explicit remote restrictions use `relation: "eligibility"`
  for a named geography. A standalone Remote reference uses that relation too.
- A city header alone does not establish onsite/hybrid/remote; use
  `workplaceType: null` when unspecified. Remote teams, customer territories,
  onsite interviews, and job-title place names are not workplace evidence.
- Quote-check explicit body requirements that contradict a header/ATS flag;
  record the conflict and decision in a separate source-linked ledger. Do not
  invent a reconciliation or a hybrid attendance schedule.
- Before writes, verify that the actual parser/importer preserves reviewed
  references and workplaceType. After writes, verify every profile, job row,
  junction reference, and affected search field. Location-only repairs preserve
  job IDs and unrelated fields/companies; require a backup, atomic concurrency
  protection, and a zero-difference rerun.

For jobs/location-only requests, stay in that scope: do not republish images or
replace unrelated profile collections. Batch at roughly 100–150 jobs (ceiling
200), or about five small boards; freeze URL manifests when splitting a large
company. Cursor's audit/repair is an example, not a generic all-company command.

6. Enumerate current employees. Start by fetching `/humans.txt`, which some companies maintain as a complete roster, then the official team page and, if available, the company's YC profile and each linked active founder profile. YC pages can be especially useful for resolving founders, current founder roles, bios, LinkedIn/X links, and identified founder portraits; verify current-role claims against the company's current site or another current source. Verify LinkedIn/X URLs rather than constructing handles from names. Do not add people only found in old articles. A roster can be very large: if it is, select founders and named leadership for the `people` array rather than dumping hundreds of names, and say so.
7. Add recent activity from distinct dates and sources, including acquisitions, funding, launches, partnerships, research, and hiring.
8. Complete the default image-publication workflow above: source and download images, validate them, commit/push to the GitLab image repository, verify hosted URLs, validate the profile, import it into Neon, and verify the stored image URLs.

### Job-description fidelity gate

`jobs[].description` must be an almost lossless Markdown transcription of the
individual job page's substantive content. Do not rewrite it into a compact
"Role" or "Work and benefits" summary. Preserve every meaningful section,
paragraph, list item, and concrete detail — including company context, job and
candidate sections, values, responsibilities, requirements, qualifications,
compensation, benefits, workplace expectations, visa information, and the
hiring process. If the source says "About us", "Job", "You", "Life at
{Company}", or "Compensation & benefits", those should remain distinct
headings with their full text beneath them.

- Convert source headings and labels to Markdown headings, source lists to
  Markdown lists, and prose to paragraphs. Preserve links, emphasis, numbers,
  company names, and named tools when present.
- Do **not** summarize, paraphrase, deduplicate, or omit a section because the
  same fact also appears in `skills`, `compensation`, `visa`, or another
  structured field. Those fields are for filtering; the description is the
  complete reading experience.
- Retain all hiring and application information expressed as job-page prose.
  Remove only non-content: raw HTML, scripts/tracking, page navigation, cookie
  notices, form inputs/buttons, and generic legal/privacy/EEO boilerplate.
- Before saving, compare the rendered source body to the Markdown output. Every
  substantive source block must have a corresponding Markdown block. If the
  full body cannot be retrieved, leave `description` as `null` and report that
  limitation; never substitute a short listing preview or a generated summary.

### CommonMark validity gate

Every `jobs[].description` must be valid, sanitized CommonMark. In particular,
never leave whitespace immediately before a closing emphasis delimiter:
write `**Innovate with courage.** Lead with bold ideas`, not
`**Innovate with courage. **Lead with bold ideas`. Use paired delimiters only
around non-empty text and keep delimiter runs out of ordinary prose.

Before importing any profile data, run `npm run validate:job-markdown`. This
typed repository check parses every job description with `remark-parse` and
rejects strong-emphasis runs that CommonMark would leave as literal asterisks.
If it fails, repair the source Markdown, rerun the check, then run
`npm run validate:companies`; do not import until both pass.

### Profile rules gate

`npm run validate:companies` is not only a schema check. It runs
`parseCompanyProfile` for shape and then the semantic rules in
`scripts/lib/company-profile-rules.ts`, which Zod cannot express:

- every `funding.rounds[].announcedAt` is a real `YYYY-MM-DD`, `YYYY-MM`,
  `YYYY`, or `null`;
- `funding.rounds` is newest-first across its dated entries, and
  `funding.latestRoundId` references `rounds[0]`;
- the round amounts sum exactly to `financials.totalFunding.amount`;
- no amount `display` carries an unverified marker such as "derived";
- every `jobs[].skills` entry is trimmed, unique within the job, not a general
  competency, and traceable to the posting's own title or description.

A failing run lists each violation by company. Do not import while it fails and
do not weaken the check to make a profile pass: a red run means the data is
wrong, not that the rule is. When a chip is flagged as untraceable, the posting
does not name it, so remove the chip rather than expanding the alias table to
admit it. Extend `SKILL_EVIDENCE` only for a genuine spelling variant the source
uses, such as an ATS writing "Postgres" for `PostgreSQL`.

### Job skills: concrete named entities only

`jobs[].skills` is a compact filter/tag list of specific, verifiable skills,
not a summary of the role's responsibilities or general competencies. Include
concrete named items such as programming languages, frameworks, platforms,
software products, developer tools, and formally named standards or
methodologies when the posting supports them. Examples include `SQL`,
`TypeScript`, `Excel`, `Salesforce`, `Terraform`, `SOC 2`, and `MEDDIC`.

- Do **not** use generic duties, domains, or competencies as skills. Examples
  to exclude: accounting, forecasting, audit, internal controls, RevOps,
  accounts payable, fixed assets, negotiation, communication, leadership,
  customer success, enterprise sales, and cross-functional collaboration.
- Do not infer a tool from the job title, typical industry practice, company
  stack, or what a person in that role would normally use. Each skill must be
  traceable to an explicit mention in that individual posting (including its
  title). A named tool in a customer list, company context, or unrelated
  example is not automatically a required skill; inspect how it is used.
- Use canonical product/technology spelling and capitalization (`TypeScript`,
  `Node.js`, `PostgreSQL`, `DocuSign`, `ClickHouse`, `OpenSearch`). Preserve
  intentionally lowercase branding such as `dbt`. Avoid ambiguous terms and
  acronyms when they can match ordinary prose (for example, `Excel` must not
  match “excel at”; `REST API` must not match “the rest”; a vendor name that is
  also a customer must be validated in context).
- A function or department acronym is not a skill, even a formally named one.
  `RevOps`, `FP&A`, `ITSM`, and `PLG` name what a team does, so they are
  excluded alongside `accounting` and `audit`. Named *standards* and
  *methodologies* (`SOC 2`, `ISO 27001`, `GAAP`, `MEDDIC`, `ABM`) are skills
  because they are specific, verifiable, and filterable; named *org functions*
  are not.
- Prefer the smallest accurate set. Do not add aliases, duplicate a platform
  and every sub-service without a useful distinction, or add a broad category
  merely to increase coverage. Do include a specific named product when the
  posting identifies it as relevant, even if it is a bonus qualification.
- An empty list is correct when the posting names no concrete skills. Use
  `skills: []`; do not fill gaps with generic competencies or guessed tools.
  The complete job description remains authoritative and must not be altered
  to make the skills list appear more comprehensive.
- Before saving, review each distinct skill in context and check for false
  positives, customer-name collisions, ordinary-word matches, and casing.
  Confirm every chip against the actual full posting, then validate/import the
  profile as usual.

## Parallel research

When subagents are available, make parallel evidence collection the default.
First, the lead resolves the target company and reads the Autumn contract.
Then dispatch every independent lane concurrently; do not serialise funding,
people, jobs, activity, company basics, and asset discovery when they can run
at the same time. For a narrowly scoped request, dispatch only the lanes needed
for that request.

Use these independent assignments:

- **Company basics:** official website, canonical domain, tagline, location,
  stage, employee range, and controlled `industry` value. Check the YC company
  profile when one exists; report its facts as a dated snapshot and note any
  conflicts with the current company site.
- **Funding:** distinct rounds, arithmetic, investors, and primary-source URLs.
- **Jobs:** canonical careers board and exact open-job URLs.
- **People:** current leadership and employee verification plus attributable
  portraits. Check the YC company page and founder profiles for named founders,
  current titles, LinkedIn/X links, and identified founder photos; independently
  verify that they still work at the company.
- **Activity:** feeds, recent distinct events, and verified dates.
- **Brand assets:** logo and banner candidates, source ownership, dimensions,
  and deterministic asset checks.

Give each subagent the company identity, relevant contract fields, and one
read-only evidence-report format: claim, direct source URL, source tier,
publication date, candidate local asset path if applicable, and uncertainty.
Subagents report findings; they do not write `company.json` or download into the
shared asset directory.

The lead waits for the evidence reports, reconciles conflicts and duplicates,
selects sources, writes the single final JSON object and assets, then runs
`npm run validate:companies`. Identity resolution, schema interpretation, final
synthesis, and writes remain lead-owned. If subagents are unavailable, perform
the same passes sequentially rather than skipping them.

### Quality and uncertainty rules

- Keep a source URL for every non-trivial claim while researching; include the most useful sources in the final record when the schema supports them.
- If reputable sources conflict, prefer the primary source and do not invent a reconciliation.
- Use `null` for unknown scalar fields and `[]` for unknown lists. Never fabricate handles, domains, compensation, revenue, valuations, or job URLs.
- Distinguish announcement date from publication/update date.
- Keep employees separate from investors, board members, and advisors unless the repository schema has no other place for them.
- Reconcile the final record field-by-field against the target schema before writing it: required values must be present and valid, while genuinely unverified nullable values must remain `null`. Do not turn missing evidence into placeholder strings, guessed dates, or zero amounts.

## Research tools

### Ketch first: discovery, pages, and careers-board enumeration

Use the `ketch` skill and CLI before another search/scraping tool. These are
the default entry points for every evidence lane, including subagents:

```sh
ketch search 'Company funding announcement' --json --limit 5
ketch scrape 'https://company.com/announcement' --json --max-chars 8000
ketch crawl 'https://jobs.ashbyhq.com/verified-board-slug' --json --depth 1
ketch scrape 'https://jobs.ashbyhq.com/verified-board-slug/posting-id' --json --max-chars 8000
```

Save large crawl/scrape results to a research file and inspect bounded summaries
or selected entries instead of dumping entire boards into context. Keep Markdown
formatting for job-description collection; `--trim` is for text-only inspection.
Read `ketch <surface> --help` for supported flags. Check exit status and each
result's errors. Verify title, company identity, and direct source URLs: search
can still return similarly named companies.

For jobs, derive the real ATS board from the company careers page, crawl the
board to enumerate exact posting URLs and listing metadata, then scrape each
individual posting for its complete description. Cross-check the canonical
ATS JSON API for the full job set, secondary locations, workplace mode, dates,
salary currency/ranges, and equity. Use the complete API body as an additional
primary source or fallback when a detail scrape is incomplete. A crawl result
containing every job link is not proof that all linked descriptions were read.
Do not truncate or summarize descriptions to fit the default output budget;
inspect the returned ending/length and raise the cap for a longer known posting.

Verified on Heidi's Ashby board: `ketch scrape` of the Support Engineer posting
returned the full role, requirements, values, and benefits; `ketch crawl` of
`https://jobs.ashbyhq.com/heidihealth.com.au` returned a single board page with
79 distinct posting links and listing metadata. It did not return 79 full
posting bodies. Treat this as a workflow example, not a permanent job count.

Fallback only after Ketch is unavailable or demonstrably fails: DonSeTch CLI
(`donsetch-cli` skill) for search/fetch, then built-in `websearch` for discovery.
For authentication, forms, screenshots, or interaction that extraction cannot
handle, use `bladebro-cli`; do not use `agent-browser`. Do not fetch a
search-results page as a substitute for a search tool. Direct structured ATS
API calls are allowed and complement this source-reading workflow.

Search-query examples labeled `WebSearch` below are query suggestions for
`ketch search`, not instructions to bypass Ketch. Older social-profile browser
examples describe extraction intent; use `bladebro-cli` when interaction is
necessary, not `agent-browser`.

## Exhaustive URL resolution

Search hard for every URL. `null` is a last resort, not a default. For each field that expects a URL:

**Investor websites** — Do not guess domains. Search for each investor individually:

```
WebSearch: "{Investor Name} venture capital website"
WebSearch: "{Investor Name} official site"
```

Verify the domain by checking the search result URL, not just the title. Common patterns:

- Venture firms often use abbreviations (e.g., `theoryvc.com` not `theoryventures.com`)
- Some use `.vc` TLD (e.g., `garage.vc`)
- Some use compound names (e.g., `49palmsvc.com`, `gtmfund.com`)

**Venture-capital logos are a required research pass.** For every named VC,
venture fund, accelerator, or institutional investor in each funding round,
resolve and verify its official website/domain first, then try to obtain a logo
from Logo.dev or Brandfetch. Check `public/investors/{slug}.{ext}` **in the image repo** for an
existing passing asset before fetching; reuse it if it belongs to that same
investor. Otherwise download a candidate, convert only when needed, save it in
`public/investors/` in that repo, and reference it in the investor object's `logo` field as
`https://locus-images-b3c414.gitlab.io/investors/{slug}.{ext}`. Never put a third-party proxy URL in that field when
authoring an Autumn profile. Do not stop after finding a domain or after the
first provider fails: try the other provider before using a favicon fallback.
Run `image_assets.py check` on every downloaded logo and reject blank, invalid,
or misattributed files. Record which provider supplied each saved logo in the
research ledger. Individual angel investors do not need firm logos.

Use only the verified investor domain in the provider URL. The currently
available public Logo.dev token and Brandfetch client ID are:

```
https://img.logo.dev/{verified-domain}?token=live_6a1a28fd-6420-4492-aeb0-b297461d9de2&size=128&retina=false&format=webp
https://cdn.brandfetch.io/domain/{verified-domain}/fallback/lettermark/theme/light/h/400/w/400/icon?c=1bfwsmEH20zzEfSNTed
```

Try Logo.dev first, then Brandfetch; preserve the actual response format when
naming the local file. These public image-service client credentials are
supplied for this workflow, not evidence that a candidate is the correct logo.
Verify ownership against the investor's official domain/name and run the asset
checker. If both services fail or return an unusable/misattributed image, try
an attributable official brand asset and document the failure; `logo: null` is
the last resort, not the default.

**People LinkedIn URLs** — Search for each person by full name + company:

```
WebSearch: "{Full Name} {Company} LinkedIn"
```

LinkedIn profile URLs follow the pattern `https://www.linkedin.com/in/{handle}`. Extract the handle from search results.

**People verification** — Verify each person's current role by checking their LinkedIn profile. Look for:

- "Current" position at the company
- Employment dates (start date to present)
- Job title and department

Search for current employees using:

```
WebSearch: site:linkedin.com/company/{handle} "current"
WebSearch: "{Company} team members 2026"
WebSearch: "{Company} leadership team"
```

**Y Combinator company and founder profiles** — For a YC-backed or YC-founded
company, locate the exact company profile on `ycombinator.com/companies/{slug}`
and inspect its current company page plus any linked founder profiles. Use this
as an explicit research pass, not merely a discovery snippet. Capture the YC
batch, company description, location, team-size snapshot, active status, hiring
links, founder names/titles, and any founder social/profile links or photos the
page identifies. Treat employee count and other time-sensitive YC fields as a
dated snapshot and prefer newer first-party evidence when it conflicts. A YC
founder profile or portrait can be an attributable source when the page clearly
names the person; still corroborate the individual's current company role before
adding them to `people`. Preserve verified LinkedIn and X URLs in the schema's
`linkedin` and `x` fields; do not invent handles or store unsupported social
networks in those fields.

**Important:** Only include current employees in the `people` array. Board directors, investors, and advisors should be noted separately or included in the `investors` array if they have investment roles.

**Company banner** — Treat LinkedIn and X/Twitter headers as social-banner
candidates, not automatic choices. Use the source order in “Brand assets and
banners” below. Do not select a social header until it passes ownership,
recency, non-blank, and crop-safety checks.

**Company tagline** — Prefer the LinkedIn company tagline over the website tagline. Search:

```
WebSearch: "{Company Name} LinkedIn"
```

LinkedIn shows the tagline directly in search snippets (e.g., "Company | 123 followers on LinkedIn. {tagline}"). Use that as the `tagline` field.

**People portraits** — Find and verify the person before choosing an image. Use
this source order:

1. The company's official team, leadership, or brand page with the person's
   name and role beside their portrait. Check this before social providers;
   use these official portraits for everyone for whom they are available.
2. **unavatar.io through the `curl-via-proxy` skill**, using the person's
   verified LinkedIn username or own X/Twitter username, when the company
   has no official team page with pictures or that page lacks this person's
   usable portrait. Follow the workflow below; never guess a username.
3. The `user.avatar_url` returned by `https://api.fxtwitter.com/<handle>` for
   the person's verified own X account. Apply the mandatory
   `_normal` → `_400x400` replacement below before downloading the avatar.
4. An official company author/newsroom, press kit, event/speaker page, webinar, podcast, or
   partner announcement that identifies the person in the image.
5. The person's own site or official bio page.
6. The person's identified founder photo on their YC founder profile or the
   company's YC profile. Use only where the page labels/links the person, and
   corroborate identity and current employment independently.
7. Their verified LinkedIn profile picture retrieved directly, where permitted.
8. A verified GitHub profile only when it is clearly the same person and no
   stronger portrait is available.

Search the company domain first (`site:company.com "Full Name"`), then search
for the person with the company and role. Verify identity with at least two
independent signals: a source that names the person and a current-role source.
Never decide that an unlabeled face is the right person by visual resemblance.
Avoid group shots, stock images, heavily cropped photos, and low-resolution
avatars. Prefer a recent, square-or-crop-safe headshot with enough resolution
for the profile UI.

### Second-priority portraits: unavatar.io with curl-via-proxy

Load the `curl-via-proxy` skill and use its bundled Bun helper for these
public image GET requests. Use exact usernames from verified profile URLs
or official social links; corroborate the person's identity and current role
before selecting their image. Search `Full Name Company site:linkedin.com/in/`
to discover LinkedIn URLs; do not fabricate handles. A search snippet can
identify a profile without opening LinkedIn when the user requests that.

Supported endpoints:

```text
https://unavatar.io/linkedin/user:{username}
https://unavatar.io/x/{username}
```

Run from the `curl-via-proxy` skill directory, or resolve its script path:

```sh
bun run scripts/download.ts \
  'https://unavatar.io/linkedin/user:simon-last-41404140' \
  --output '/absolute/temp/path/simon-last.jpg' --expect-image --country us
bun run scripts/download.ts \
  'https://unavatar.io/x/verified-username' \
  --output '/absolute/temp/path/person-avatar.jpg' --expect-image --country us
```

Keep TLS verification enabled. Never send credentials, cookies, private URLs,
or authorization headers through free proxies, and never silently fall back
to a direct request. Record the returned proxy, HTTP status, actual MIME type,
byte count, endpoint, and output path in the research ledger. All-proxy failure
means try the next ranked portrait source, not invent an image.

Inspect the response before publishing: HTTP 200 and `image/*` can still be
a generic silhouette, default SVG, initials, blank image, or unrelated person.
Reject generic placeholders and misattributed images. A branded illustration
is acceptable only when attributable to that specific person's verified
profile; do not describe it as a photograph. Preserve the actual image format,
not the requested filename extension, and run `scripts/image_assets.py check`.

For Autumn writes, download accepted portraits into the separate image repo's
`public/companies/{slug}/people/{person-slug}/avatar.{ext}`. Automatically
commit/push only the intended assets, wait for GitLab Pages success, verify
each hosted URL anonymously with the correct MIME type, then import the
updated profile with `npm run db:import -- /absolute/path/to/company.json`.
Do not stop at a temporary download or store an unavatar.io proxy URL in Neon.
For research-only requests, do not publish or import.

**Direct LinkedIn profile pictures** — This is a later fallback after official
team portraits and the unavatar.io proxy workflow.
When the profile and current role are verified, extract the raw image URL:

```
agent-browser open https://linkedin.com/in/{handle}
agent-browser eval "document.querySelector('img.pv-top-card-profile-picture__image--show').src"
```

LinkedIn profile picture URLs follow this pattern:

```
https://media.licdn.com/dms/image/v2/{path}/profile-displayphoto-scale_200_200/{hash}?e={timestamp}&v=beta&t={hash}
```

If LinkedIn does not provide a usable image, continue through the ranked
sources above. Accepted unavatar.io downloads may be final portrait assets
after identity, placeholder, image-quality, and publication checks; never use
an unverified email/avatar proxy or its remote endpoint as the stored image.
Use `null` when no attributable, crop-safe image can be verified.

**Company/investor logo URLs** — For a company avatar/logo, first use the
verified X account and FxTwitter workflow under **Brand assets and banners**;
only then try official brand assets, Logo.dev, Brandfetch, and LinkedIn. For
venture-capital/institutional investors, follow the mandatory dual-provider
procedure under **Investor websites** above. LinkedIn is a useful fallback;
unavatar is last resort.
Extract raw LinkedIn logo URLs only when the stronger sources do not provide a
usable, attributable asset:

```
agent-browser open https://linkedin.com/company/{handle}
agent-browser eval "document.querySelector('img.pv-top-card-profile-picture__image--show').src"
```

LinkedIn company logo URLs follow this pattern:

```
https://media.licdn.com/dms/image/v2/{path}/company-logo_200_200/{hash}?e={timestamp}&v=beta&t={hash}
```

Fallback: Use unavatar.io with the verified domain:

```
https://unavatar.io/{verified-domain.com}
```

**Career page URLs** — Use Ketch to scrape the actual careers page and crawl
its verified ATS board to extract the **exact deep-link URL for each posting**.
Do not use the generic careers page URL for individual jobs. For example:

```bash
ketch scrape 'https://company.com/careers' --json --max-chars 8000
ketch crawl 'https://jobs.ashbyhq.com/verified-board-slug' --json --depth 1
ketch scrape 'https://jobs.ashbyhq.com/verified-board-slug/posting-id' --json --max-chars 8000
```

Each `jobs[].url` must take the user directly to that specific role's application page. Open that exact page (or its detail API) and capture its whole substantive posting for `jobs[].description`; do not stop at the careers-listing preview.

## Research standard

- Prefer primary company, investor, regulatory, and job-listing sources for facts. Use credible reporting to fill gaps only when primary sources are unavailable.
- Do not infer a funding round, valuation, investor, role, revenue figure, date, or social profile. Use `null` for a scalar that cannot be verified and `[]` for a list with no verified entries.
- **Distinguish between employees and board members/investors.** The `people` array should only include current employees, not board directors or investors. Board members and investors belong in the `investors` array or should be noted separately. Search for:
  ```
  WebSearch: "{Company} team leadership"
  WebSearch: site:linkedin.com/company/{handle} employees
  WebSearch: "{Company} board of directors"
  ```
  Verify each person's current role by checking their LinkedIn profile for "Current" positions at the company.
- Keep funding rounds distinct. Each round must carry its own date, amount, valuation, lead investors, other participating investors, and source URL where known.
- Treat verified accelerator funding as funding, not merely company metadata.
  A YC-backed company with a documented YC investment should receive a distinct
  `Pre-seed` (or source-disclosed stage) round with Y Combinator represented as
  an investor. Keep it separate from a later seed round even if reporting
  groups both events under "seed funding". A cohort label alone is insufficient
  evidence of a specific cash amount, announced date, or lead-investor role.
- **Enumerate every named participant per round, and take that list from the company's own announcement.** A round's full investor list is usually published only in the company's press release (Business Wire / PR Newswire) or its own blog. Aggregator and blog summaries routinely truncate it: a round recorded here as 3 investors had 10 in the company release. Treat "including" in a news story as an explicit signal that the list is partial, and prefer the release that enumerates. Some companies have no blog post for a round at all; others publish at non-obvious slugs (e.g. `/blog/series-b-40m-to-build-the-next-web`), so probe the blog before concluding a round has no published leads.
- **Cross-check the round arithmetic.** Sum the individual round amounts and compare against `financials.totalFunding.amount` and any independently reported total. If the company reports $863M raised across six rounds, those six amounts must sum to $863M. A mismatch means a round is missing, duplicated, or mis-sized. This check catches real defects: it is how a missing $8M round in a $88M total surfaced.
- When sources conflict, rank them: the company's own announcement and contemporaneous reporting first, then a later aggregator or advisor/legal-vendor page. Vendor "deals" pages can carry wrong figures (one listed an $80M round as $200M; another named the wrong lead investor).
- Record funding dates at the precision you can actually verify, and never
  fake the rest. `YYYY-MM-DD` is preferred; a verified `YYYY-MM` or `YYYY` is
  acceptable as a last resort and is better than `null`, because it preserves
  real evidence at its true precision. Never pad a partial date into a
  fabricated full one, and never use `null` for a date you have verified to the
  year. Any other form (`2019/01`, `Jan 2019`, `Q1 2019`) is invalid.
- **Always search for exact funding dates first.** Do not settle for a year
  without trying:
  ```
  WebSearch: "{Company} Series A funding date"
  WebSearch: "{Company} Series A announced"
  WebSearch: site:pitchbook.com "{Company}" OR site:crunchbase.com "{Company}"
  ```
  PitchBook, Crunchbase, Caplight, and press releases often have exact dates.
  Fall back to `YYYY-MM`, then `YYYY`, only after checking these sources.
- Retain a compact source record for every non-trivial claim so downstream users can audit it.
- Use a company's official brand assets only when a direct, stable asset URL is available. Otherwise return `null`; do not fabricate asset URLs.
- **Fill every field possible.** The output contract has many optional fields — make a serious effort to populate each one. Only leave `null` after searching at least 2-3 sources. Profile quality is measured by completeness.

## Avatars and images

**Prioritize official team portraits, then unavatar.io via curl-via-proxy.**
Follow the ranked **People portraits** workflow above for both LinkedIn and
X/Twitter avatars. FxTwitter and direct LinkedIn images are later fallbacks.
Establish identity and current role independently; a name match or successful
proxy response alone is not identity proof. Publish and import accepted new
portraits automatically for Autumn writes, just like logos and banners.

### LinkedIn Profile Pictures

If the higher-priority sources failed and direct LinkedIn browsing is permitted,
extract the raw LinkedIn profile picture URL:

```
agent-browser open https://linkedin.com/in/{handle}
agent-browser eval "document.querySelector('img.pv-top-card-profile-picture__image--show').src"
```

LinkedIn profile picture URL pattern:

```
https://media.licdn.com/dms/image/v2/{path}/profile-displayphoto-scale_200_200/{hash}?e={timestamp}&v=beta&t={hash}
```

**Note:** A LinkedIn image is only usable after the profile's current role is
verified. If it is unavailable, continue to other attributable sources or use
`null`, rather than a proxy.

### Brand assets and banners

Use trusted asset APIs for discovery, then verify the candidate before writing
it locally. A provider response establishes a candidate, not a guarantee that
the image is current, correctly attributed, or suitable for the banner crop.

Before looking up a company logo (avatar) or banner, resolve its official X
handle from the company website, an official social link, or the account's
company identity. Never derive the handle from the company name. Query the
public FxTwitter user endpoint **first**, before the brand APIs:

```sh
curl -fsSL 'https://api.fxtwitter.com/elevenlabs'
```

The response has `code: 200` and a `user` object with `screen_name`, `name`,
`website`, `avatar_url`, and `banner_url` (the last may be empty). For a real
company, replace `elevenlabs` with its verified handle and corroborate the
returned identity/website against its official site. Use `user.avatar_url` for
the company avatar/logo and `user.banner_url` for the banner as the **first
candidates**; never use a default X avatar or a missing/blank banner.

**Mandatory avatar resolution (company and people):** FxTwitter often returns
the tiny `_normal` version. Before downloading **any** `user.avatar_url`,
replace the `_normal` immediately before its file extension with `_400x400`,
preserving the rest of the URL, extension, and any query string. For example:

```text
API:      https://pbs.twimg.com/profile_images/2053914120483999744/t2XFL2R6_normal.jpg
Download: https://pbs.twimg.com/profile_images/2053914120483999744/t2XFL2R6_400x400.jpg
```

Fetch the rewritten URL and confirm it returns a real, attributable image of
sufficient size; do **not** save the `_normal` thumbnail as the final asset. If
the `_400x400` variant fails, try another verified high-resolution source in
the fallback order. Do not apply this filename replacement to `banner_url`.
Only retain direct, stable image URLs from the verified profile; download to
local `logo.{ext}` and `banner.{ext}` files and run the deterministic checks
below. If the response or image is unavailable, stale, incorrectly attributed,
or unsuitable for the UI crop, continue through the fallback order rather than
guessing an X handle. For verified personal X handles, use the same endpoint's
`user.avatar_url` as a later portrait candidate under **People portraits**,
after official team portraits and unavatar.io through `curl-via-proxy`.

**Logo source order:**

1. Profile image from `api.fxtwitter.com` for the verified official X handle.
2. Official company brand, press, or media assets.
3. Logo.dev, using the verified company domain.
4. Brandfetch, using the verified company domain or a resolved brand identity.
5. LinkedIn company logo.
6. unavatar favicon/avatar fallback only when the verified domain has no
   stronger candidate.

**Banner source order:**

1. Banner from `api.fxtwitter.com` for the verified official X handle.
2. An official company press/brand asset or a suitable first-party `og:image`
   or `twitter:image`.
3. A verified Brandfetch brand-asset candidate when available.
4. Logo.dev Brand API social-banner candidate when available.
5. LinkedIn company cover image.
6. X/Twitter profile header from the verified handle.

Use Logo.dev and Brandfetch only with the documented public credentials or
other access already available to the active environment; never invent tokens
or bypass provider terms. The example client credentials above are available
for these image requests. When a social candidate is selected, confirm it is
owned by the verified company account, current enough to represent the brand,
non-blank, and crop-safe.

### LinkedIn Company Logo Fallback

For companies, extract the raw LinkedIn logo URL only after higher-priority
sources do not provide a usable candidate:

```
agent-browser open https://linkedin.com/company/{handle}
agent-browser eval "document.querySelector('img.pv-top-card-profile-picture__image--show').src"
```

LinkedIn company logo URL pattern:

```
https://media.licdn.com/dms/image/v2/{path}/company-logo_200_200/{hash}?e={timestamp}&v=beta&t={hash}
```

### Social banner fallbacks

LinkedIn and X are useful fallbacks because their header art is often
purpose-built for wide layouts, but a flat-colour, stale, or low-resolution
header must be rejected. For a LinkedIn company-cover candidate:

```
agent-browser open https://linkedin.com/company/{handle}
agent-browser eval "document.querySelector('img.pv-top-card-profile-picture__image--show').src"
```

LinkedIn banner URL pattern:

```
https://media.licdn.com/dms/image/v2/{path}/image-scale_191_1128/image-scale_191_1128/{hash}?e={timestamp}&v=beta&t={hash}
```

For X, use a profile header only from the verified official handle; do not
substitute a fan, employee, or third-party account. Then verify and normalise
the crop. Match the repository's existing banner aspect ratio rather than
inventing one, and if you crop, crop programmatically so the geometry is
reproducible and auditable. A blank candidate must be rejected — see “Asset
verification” below.

### Fallback: unavatar.io for company and investor logos

For company or investor logos, use [unavatar.io](https://unavatar.io) only when
official assets, Brandfetch, Logo.dev, and LinkedIn do not provide a usable
candidate:

**Pattern:** `https://unavatar.io/{identifier}`

- **Companies (by domain):** `https://unavatar.io/{domain}` — resolves the favicon or brand avatar for the domain

Use this only as an asset candidate. For Autumn repository writes, download a
verified candidate and store it in the required local destination before
populating an investor's `logo` or the root `logo` field.

If no identifier is available (no email, no handle, no domain), use `null`.

## Asset verification

**The gate is deterministic, not visual.** Every downloaded asset must pass a
programmatic check, which works identically whether or not the active model has
image-input capability. Do not claim a visual inspection when image input is
unavailable.

Run the bundled checker over everything you downloaded:

```
python <skill-dir>/scripts/image_assets.py check /Users/ayaanzaveri/Code/locus-images/public/investors/*.png /Users/ayaanzaveri/Code/locus-images/public/companies/{slug}/images/* /Users/ayaanzaveri/Code/locus-images/public/companies/{slug}/people/*/avatar.*
```

It reports a verdict per file and exits non-zero on failure:

| Verdict            | Meaning                                                  | Action                                                                  |
| ------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `OK`               | Visible on light and dark backgrounds                    | Keep                                                                    |
| `OK_LIGHT_BG_ONLY` | Dark mark on transparency                                | Keep, but render on a light background; do not flatten alpha onto black |
| `OK_DARK_BG_ONLY`  | Light mark on transparency                               | Keep, but render on a dark background; do not flatten alpha onto white  |
| `BLANK`            | Near-uniform; no visible content                         | Reject and re-source                                                    |
| `INVALID`          | Undecodable, an HTML error page, zero-byte, or too small | Reject and re-source                                                    |

What the checks catch, mapped to failures that actually occur:

- **Blank or solid-colour banners.** A social banner can be a single flat colour. The file is valid and returns HTTP 200, so only a uniform-surface test catches it.
- **A logo that vanishes under flattening.** A dark logo on a transparent background looks like a black square if alpha is flattened onto black. This is a compositing bug in your own pipeline, not a bad download — record the intended background instead of discarding the asset.
- **An error page saved as an image.** A 404 HTML body written to `logo.png` decodes as garbage; check the container and magic bytes, not just the HTTP status.
- **Degenerate sizes.** A 32px favicon is the floor for a logo, not a good outcome. Prefer logo.dev with a token; the favicon services are a genuine last resort and the script flags them as low-resolution.

Use `fetch` mode to download with the full fallback chain in one call, which also re-validates and re-downloads any existing file that fails its checks:

```
python <skill-dir>/scripts/image_assets.py fetch accel=accel.com gv=gv.com --dest /Users/ayaanzaveri/Code/locus-images/public/investors --token "$LOGO_DEV_TOKEN"
```

**When the active model can actually inspect images:** use `--contact-sheet
OUT.png` with `check` or `fetch` and review the logo and banner as they will be
used. Confirm that the logo is the correct entity, remains legible with enough
padding and contrast, and that the banner retains its focal subject in the
wide UI crop without important content being hidden by the logo or text. This
is a supplementary identity-and-composition check, never a replacement for the
deterministic verdicts above. If image inspection is unavailable, use verified
source ownership, dimensions, aspect ratio, site title/`og:site_name`, and
profile text instead; do not imply the visual-fit check happened.

## Recent activity dates

Each `activity` entry must have a **unique, verified date**. Do not cluster
everything on one date. Search for the latest news, product releases, blog
posts, and hiring activity independently:

```
WebSearch: "{Company} blog 2026"
WebSearch: "{Company} release notes"
WebSearch: "{Company} latest news this month"
WebSearch: site:github.com/{org}/{repo}/releases
```

Pull from multiple sources: the company blog, GitHub releases, news coverage, job board postings. Each entry should reflect when it actually happened, not when the funding round was announced.

**Fetch the company's own feed before searching.** A changelog or blog feed gives you hundreds of precisely dated, first-party entries in one request, which beats assembling dates from search results. Try, in order, `/rss.xml`, `/atom`, `/feed.xml`, `/blog/rss.xml`, `/changelog/rss.xml`. Parse with a small script rather than reading the raw XML:

```
curl -s https://company.com/rss.xml -o /tmp/feed.xml
python3 -c "
import re; x=open('/tmp/feed.xml',encoding='utf-8',errors='ignore').read()
for it in re.findall(r'<item>(.*?)</item>',x,re.S)[:30]:
    t=re.search(r'<title>(.*?)</title>',it,re.S); d=re.search(r'<pubDate>(.*?)</pubDate>',it,re.S)
    print((t.group(1).strip() if t else '?'),'|',(d.group(1) if d else '?'))
"
```

For Atom feeds, match `<entry>` and `<updated>`/`<published>`. Prefer the feed's own dates over any date you infer from a search snippet.

## Output and completion

For Autumn, return or write only the object defined by
`companyProfileSchema`. The generated
`data/companies/company-profile.schema.json` is the canonical output template;
do not duplicate it in this skill or hand-maintain a second contract.

Keep a compact evidence ledger while researching: claim, direct source URL,
source tier, publication date, and confidence. Map the best direct evidence to
each supported `sourceUrl`. If the user asks for research only, return the same
contract-shaped object and include a source summary only when requested. Do not
invent local asset paths until a repository write is in scope.

Before completion, verify slug, URLs, local paths, country code, dates, and
money values field by field; then run `npm run validate:companies`. If the Zod
contract changes, run `npm run generate:company-schema` and include the
regenerated schema with the source change. For an imported profile with new or
updated local assets, complete the commit-and-push gate above before reporting
the profile as deployed; a database import is not an asset deployment.
