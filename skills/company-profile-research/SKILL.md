---
name: company-profile-research
description: Research companies into validated Autumn company profiles with evidence-backed funding, people, jobs, activity, and brand assets. Use for company-profile data work, not prose reports or UI implementation.
---

# Company Profile Research

Return a single valid JSON object for the requested company. The result is data
for a company profile, not a prose report or UI implementation.

## Autumn contract: source of truth

When Autumn is the destination, do not use a generic, legacy, or inferred
output shape. At the repository root, read these files before researching or
writing data:

1. `data/companies/SCHEMA.md` for authoring conventions.
2. `data/companies/company-profile.schema.json` for the exact machine-readable
   contract.
3. `lib/company-profile.ts` for the executable Zod schema, normalization, and
   TypeScript types.
4. One or two recent `data/companies/*/company.json` records for local
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
- Store company assets under `public/companies/{slug}/images/` and reference them as `/companies/{slug}/images/{filename}`.
- Use semantic names such as `banner.{ext}` and `logo.{ext}`; preserve the source format unless conversion is necessary.
- Store downloaded person portraits under `public/companies/{slug}/people/{person-slug}/avatar.{ext}`.
- Preserve the repository keys `banner`, `logo`, `employees`, `financials`, `funding`, `jobs`, `people`, and `activity`.
- Store investor logos in the **shared** `public/investors/` folder, named `{slug}.{ext}`, and reference them as `/investors/{slug}.{ext}`. Check for an existing file first and reuse it; only download when absent. Prefer local paths over remote proxy URLs.
- Never reference a local asset path that does not exist, and never leave a remote proxy URL where a local asset is expected.
- Validate JSON syntax, confirm every referenced local asset exists, and run
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
- Use the same `slug` for the import payload and `public/companies/{slug}/` assets.
- Before importing, validate the payload with `parseCompanyProfile` or the
  import command. A record that cannot validate must not be presented as
  complete.
- After changing profile data, run `npm run db:import -- /absolute/path/to/company.json`.
  It upserts `companies` and replaces the company’s normalized `jobs` and
  `people` rows.
- When changing the profile contract, update `lib/company-profile.ts` first,
  regenerate the JSON schema, update `lib/db/schema.ts`, generate and apply a
  Drizzle migration, then seed: `npm run generate:company-schema`, `npm run
db:generate`, `npm run db:migrate`, and `npm run db:seed`.
- Verify URLs, exact ISO dates, monetary values, country codes, and local asset paths individually. An existing value from another company is not evidence for the target company.

## Reusable research workflow

Treat this as structured data collection, not a narrative task. Work in passes:

1. Inspect the target repository schema and existing assets.
2. Search primary sources first: company site, newsroom/blog, official investor announcements, canonical careers board, and official social profiles.
3. Use WebSearch for discovery and exact dates, WebFetch for static pages and APIs, and agent-browser for JavaScript-rendered pages. If WebSearch is unavailable, blocked, or fails to surface a needed primary source, use [Brave Search](https://search.brave.com/search?q=) with a URL-encoded query as the fallback. Prefer structured first-party job-board APIs such as Greenhouse or Ashby.
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
5. Enumerate all currently open jobs from the canonical board. Every job needs its exact application URL, not the generic careers URL. **Retrieve the full individual posting before writing `jobs[].description`; an ATS listing card, search result, or API excerpt is never sufficient.** The description must contain the complete substantive job-page copy in sanitized CommonMark. It is a transcription field, not a summary: preserve the source wording, order, and level of detail while converting its presentation to Markdown. Keep structured role facts in parallel. If a board API exposes only a short description, follow the individual job URL or its detail endpoint for the full body. Close emphasis before a following link and leave whitespace between them (for example, `***Announcement.*** [***Read more***](https://example.com)`); never concatenate Markdown marker runs. **Do not assume the ATS from the company name** — a slug that resolves for one company returns empty for another, and a name-based guess can silently yield zero jobs. Derive the real board from the careers page, then prefer its public JSON API over scraping:
   - Ashby: `https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true`
   - Greenhouse: `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs`
   - Lever: `https://api.lever.co/v0/postings/{slug}?mode=json`
     An empty `jobs` array from a guessed slug is indistinguishable from a company with no openings, so confirm the slug against the careers page before trusting a zero result. Note also that a company may link its own branded paths (e.g. `/careers/{title}-{id}`) that are not the real application URL; resolve each posting to the underlying ATS URL.

6. Enumerate current employees. Start by fetching `/humans.txt`, which some companies maintain as a complete roster, then the official team page, and verify LinkedIn/X URLs. Do not add people only found in old articles. A roster can be very large: if it is, select founders and named leadership for the `people` array rather than dumping hundreds of names, and say so.
7. Add recent activity from distinct dates and sources, including acquisitions, funding, launches, partnerships, research, and hiring.
8. Write the repository-shaped JSON, download requested assets, then run syntax and path checks.

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

## Parallel research

When subagents are available, make parallel evidence collection the default.
First, the lead resolves the target company and reads the Autumn contract.
Then dispatch every independent lane concurrently; do not serialise funding,
people, jobs, activity, company basics, and asset discovery when they can run
at the same time. For a narrowly scoped request, dispatch only the lanes needed
for that request.

Use these independent assignments:

- **Company basics:** official website, canonical domain, tagline, location,
  stage, employee range, and controlled `industry` value.
- **Funding:** distinct rounds, arithmetic, investors, and primary-source URLs.
- **Jobs:** canonical careers board and exact open-job URLs.
- **People:** current leadership and employee verification plus attributable
  portraits.
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

Use a layered approach to gather information efficiently:

1. **WebSearch** — Initial discovery: funding announcements, news, Crunchbase/Tracxn profiles, LinkedIn results, job boards. Cast a wide net first.
   - **Fallback:** When WebSearch cannot provide an actionable result, open `https://search.brave.com/search?q={URL-encoded query}` and continue from the result's primary source. Brave is a discovery fallback, not a citation substitute.
2. **WebFetch** — Pull structured content from pages that render well without JavaScript: company about pages, press releases, blog posts, SEC filings.
3. **agent-browser** — Use for pages that require JavaScript rendering, interactive navigation, or block simple fetches:
   - Company career pages (Ashby, Greenhouse, Lever, Workday)
   - LinkedIn profiles and company pages (for extracting profile pictures, logos, and banners)
   - Crunchbase, Tracxn, PitchBook pages behind dynamic loaders
   - GitHub repositories (for star counts, contributor data)
   - Any page where WebFetch returns incomplete or empty content

   Example workflow:

   ```
   agent-browser open https://company.com/careers
   agent-browser snapshot -i
   // read job listings from the snapshot
   ```

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

1. The company's team, leadership, author, or newsroom page with the person's
   name and role beside their portrait.
2. An official company press kit, event/speaker page, webinar, podcast, or
   partner announcement that identifies the person in the image.
3. The person's own site or official bio page.
4. Their verified LinkedIn profile picture.
5. A verified GitHub or X profile only when it is clearly the same person and
   no stronger portrait is available.

Search the company domain first (`site:company.com "Full Name"`), then search
for the person with the company and role. Verify identity with at least two
independent signals: a source that names the person and a current-role source.
Never decide that an unlabeled face is the right person by visual resemblance.
Avoid group shots, stock images, heavily cropped photos, and low-resolution
avatars. Prefer a recent, square-or-crop-safe headshot with enough resolution
for the profile UI.

**LinkedIn profile pictures** — LinkedIn is a strong fallback, not the default.
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
sources above. Do not use unavatar.io or email/avatar proxies as final profile
portraits: they are difficult to attribute, may be stale, and do not provide
enough identity confidence. Use `null` when no attributable, crop-safe image
can be verified.

**Company/investor logo URLs** — Prefer an official brand asset, Brandfetch, or
Logo.dev over LinkedIn. LinkedIn is a useful fallback; unavatar is last resort.
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

**Career page URLs** — Use agent-browser to scrape the actual career page and extract the **exact deep-link URL for each job posting**. Do not use the generic careers page URL for individual jobs. Use JavaScript evaluation to extract hrefs:

```bash
agent-browser open https://company.com/careers
agent-browser eval "Array.from(document.querySelectorAll('a')).filter(a => a.href.includes('/jobs/')).map(a => ({title: a.textContent.trim(), url: a.href}))"
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
- **Cross-check the round arithmetic.** Sum the individual round amounts and compare against any independently reported total. If the company reports $863M raised across six rounds, those six amounts must sum to $863M. A mismatch means a round is missing, duplicated, or mis-sized.
- When sources conflict, rank them: the company's own announcement and contemporaneous reporting first, then a later aggregator or advisor/legal-vendor page. Vendor "deals" pages can carry wrong figures (one listed an $80M round as $200M; another named the wrong lead investor).
- Use `YYYY-MM-DD` for a verified funding announcement date. If an exact date
  cannot be verified, use `null`; do not substitute partial dates.
- **Always search for exact funding dates.** Do not settle for just the year. Search for each round specifically:
  ```
  WebSearch: "{Company} Series A funding date"
  WebSearch: "{Company} Series A announced"
  WebSearch: site:pitchbook.com "{Company}" OR site:crunchbase.com "{Company}"
  ```
  PitchBook, Crunchbase, Caplight, and press releases often have exact dates. Only use `YYYY` as a last resort after checking these sources.
- Retain a compact source record for every non-trivial claim so downstream users can audit it.
- Use a company's official brand assets only when a direct, stable asset URL is available. Otherwise return `null`; do not fabricate asset URLs.
- **Fill every field possible.** The output contract has many optional fields — make a serious effort to populate each one. Only leave `null` after searching at least 2-3 sources. Profile quality is measured by completeness.

## Avatars and images

**Prioritize attributable portraits over convenient URLs.** Company pages and
official bios are usually the strongest proof of identity. LinkedIn is a
useful verified-profile fallback; proxies are not final assets.

### LinkedIn Profile Pictures

For people, extract the raw LinkedIn profile picture URL:

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

Before looking up a company logo or banner, resolve its official X handle from
the company website, an official social link, or the account's company
identity. Never derive the handle from the company name. For a verified handle,
query `https://api.fxtwitter.com/<handle>` first and use its returned profile
image and banner as the first candidates. Only retain direct, stable image URLs
from that verified profile; then download them locally and run the asset checks
below. If the response is unavailable or unsuitable, continue through the
fallback order rather than guessing an X handle.

**Logo source order:**

1. Profile image from `api.fxtwitter.com` for the verified official X handle.
2. Official company brand, press, or media assets.
3. Brandfetch Logo or Brand API, using the verified company domain or a
   resolved brand identity.
4. Logo.dev Logo or Brand API, using the verified domain.
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

Use Brandfetch and Logo.dev only with credentials or access already available
to the active environment; never invent tokens or bypass provider terms. When
a social candidate is selected, confirm it is owned by the verified company
account, current enough to represent the brand, non-blank, and crop-safe.

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

Use [unavatar.io](https://unavatar.io) only for a company or investor logo when
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
python <skill-dir>/scripts/image_assets.py check public/investors/*.png public/companies/{slug}/images/* public/companies/{slug}/people/*/avatar.*
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
python <skill-dir>/scripts/image_assets.py fetch accel=accel.com gv=gv.com --dest public/investors --token "$LOGO_DEV_TOKEN"
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
regenerated schema with the source change.
