# Locus tool capabilities: faster retrieval without arbitrary database access

Research date: 2026-10-03. This is a proposal, not an implementation. No packages were installed or database settings changed.

## Recommendation

Give the model a richer, bounded query language, not arbitrary SQL. Start with company filters on funding, database-side cross-entity intersections, compact model outputs, and strict runtime validation. Experiment with sandboxed code orchestration only after those foundations are sound.

“One pass” has three different meanings:

1. One database retrieval: achievable for many combined questions through joins/EXISTS.
2. One model-generated tool invocation: achievable with a composite tool or sandboxed code orchestration.
3. One model generation including the final researched prose: ordinary local tool calling still needs another generation to interpret results. A deterministic result widget can avoid that final generation for appropriate lookup answers.

## Findings in the current code

- `lib/ai/funding-query.ts`: dates, companySlug, stage, minimumAmount, investor, sort and limit exist. Industry/location filters, multiple company slugs and pagination do not.
- `app/api/chat/route.ts:38-45`: the prompt explicitly composes funding then jobs using returned slugs. This can intersect a limited preview rather than the full matching set.
- `lib/search.ts:120-180`: all three entity categories are queried even when only one is requested by the tool.
- `lib/ai/tools.ts:180-241`: fallback can stop because an excluded category matched; it can also silently simplify to the first keyword that returns anything.
- `lib/search.ts:105-135`: company name similarity ranks candidates, but regex prefix predicates decide admission. This is not genuinely typo-tolerant name retrieval.
- `lib/ai/funding-query.ts`, `entity-queries.ts`, `jobs-query.ts`: runtime input objects use `z.object`, which strips unknown properties rather than rejecting them. Unsupported filters can disappear.
- `lib/ai/entity-queries.ts`: company stage is present in the CTE but absent from the final projection even though the result mapper reads it.
- `components/locus-chat.tsx`: funding/activity results become company cards; key round/event evidence still requires generated prose.
- `lib/ai/tools.ts`: presentation verification can perform one lookup per supplied identity instead of batching.
- Route and client inspection found no application-level rate limiting, request-size policy, read-only database credential setup or database statement timeout. Infrastructure-level protections were not checked.

These are code findings, not measured database latency claims.

## 1. Enrich funding queries first

Add a shared company-filter object with industry, country/location, multiple verified slugs and optional company-description query. Add maximumAmount, lead-only investor matching, and explicit round versus distinct-company result modes where useful.

Illustrative proposed invocation, not a current API:

```json
{
  "company": { "industry": "Web Search" },
  "announcedAfter": "2025-09-01",
  "announcedBefore": "2025-09-30",
  "limit": 5
}
```

For the Exa question, this would retrieve the relevant search-company round directly rather than sending all nine September rounds to the model. Keep dates/amounts/stages exact; fuzzy matching should not weaken these constraints.

Do not add live web search for a database answer already available. Web search is a separate scope and usually adds latency.

## 2. Company discovery with cross-entity filters

Extend `queryCompanies` or add a focused `discoverCompanies` tool with bounded nested filters:

```json
{
  "company": { "industry": "AI Inference", "maximumEmployees": 100 },
  "funding": { "announcedAfter": "2026-09-01", "minimumAmount": 10000000 },
  "jobs": { "workplaceType": "remote", "skills": ["Python"] },
  "people": { "role": "CTO" },
  "limit": 10
}
```

Compile each optional relation to parameterized SQL `EXISTS` predicates. Apply all conditions before counting, sorting and limiting. Return the final companies plus bounded supporting rounds/jobs/people, not intermediate candidate cards.

Define relationship semantics explicitly: all round-level conditions must match the same round, and all job-level conditions the same job. Otherwise a company can falsely qualify using different records for each condition.

Do not create an unrestricted recursive join language. Prefer a small set of composable schemas with documented semantics.

## 3. Smaller model-facing outputs

The captured successful funding tool output contained nine rounds and serialized to 16,424 compact JSON characters. An illustrative projection retaining name/slug, industry, stage, date, amount and source serialized to 2,534 characters, about 85% smaller.

This measures payload size, not latency. A general projection must retain investors when asked about investors, valuation when asked about valuation, and completeness metadata in all cases.

Use `toModelOutput` to send concise evidence to the model while preserving the richer original result for the UI. Pass the same tools into `convertToModelMessages` so follow-up turns use the same conversion. The current route does not pass them there. See [1].

## 4. Real fuzzy retrieval and bounded text operators

Use exact slug/name, then literal prefix, then indexed trigram candidates with a calibrated threshold. Return `matchKind` and the canonical matched entity. Never auto-navigate on an ambiguous fuzzy match.

For descriptions and job responsibilities, use full-text matching with quoted phrases, OR and exclusions. PostgreSQL `websearch_to_tsquery` provides this syntax; several structured tools already use full-text retrieval, so share and clarify it rather than duplicate it. See [6], [8].

Consider semantic/vector retrieval only for genuinely semantic questions, such as “companies improving GPU utilization.” It complements exact structured filters; it must not decide whether a round falls inside a date or amount range. Evaluate a lexical baseline before adding embedding infrastructure.

## 5. Strict Zod validation without repeating the Luna bug

Separate two concepts:

- **Runtime strictness:** `z.strictObject`, bounded strings/arrays, enums, calendar-valid dates, cross-field refinements and authorization checks.
- **Provider-constrained generation:** tool `strict: true`, which is provider-dependent and requires compatible schemas.

Keep explicit provider `strict: false` for the existing optional-field schemas. Make runtime schemas strict so an invented `industry` filter on the old funding tool fails instead of disappearing.

If provider strict mode is later desired, use a separate wire schema with required nullable optional filters, normalize null to omission in the application, and regression-test every supported protocol/model. Provider strict generation does not verify factual truth or authorization. See [1], [2].

Add field `.describe()` instructions, especially “omit unless explicitly requested,” inclusive date semantics, company location versus job location, exact stage matching, and unknown-value handling.

`outputSchema` is documented for type inference; do not assume it replaces runtime result validation. Explicitly parse important outputs with Zod before rendering or returning them. See [1].

## 6. AI SDK features worth using

| Feature | Locus application | Caveat |
| --- | --- | --- |
| `prepareStep`, `activeTools` | Keep a relevant tool subset per task/step; transition to answering after enough evidence | Avoid a separate routing LLM call; aggressive routing can hide needed tools and changing tool lists can affect caching |
| `toolChoice` | Force a known lookup tool only on high-confidence requests | Do not force funding tools for ambiguous/non-funding questions |
| Parallel tool calls | Retrieve independent profiles/comparisons together | Cannot parallelize a call that depends on another call's output |
| `toModelOutput` | Keep UI data rich and model context compact | Preserve evidence relevant to the question and apply on history conversion |
| Typed tool context | Keep authorized scope, asOf and server-owned query handles outside model arguments | Never treat model-supplied session IDs as authentication |
| `timeout` and abort propagation | Bound total/model-step/tool execution time | SDK cancellation alone does not guarantee a PostgreSQL statement stops |
| Execution/model lifecycle hooks | Measure model time versus database time, payload size, retries and step count | Avoid logging credentials or private prompt/result content |
| Lower reasoning effort | Benchmark simple structured lookup requests against more complex tasks | Model/gateway-specific support; compare quality before enabling globally |
| `repairToolCall` | Repair narrowly defined syntactic mistakes | Do not silently discard requested filters or repeatedly pay for another repair model |
| Async-iterable tool execution | Show preliminary progress/results for long retrieval | Primarily perceived responsiveness, not fewer model generations |
| `inputExamples` | Useful usage hints where provider supports them | Native support is documented for Anthropic, not our current OpenAI-compatible model set; use description examples for portable guidance |

References: [1]–[4]. Local SDK source confirmed the relevant hooks and timeout fields. Live documentation has some newer options not in the installed SDK; for example its configurable `toolSearch` factory is newer than the installed zero-argument factory.

## 7. Experimental code mode: powerful, but not the first fix

The documented `@ai-sdk/code-mode` lets a model write sandboxed JavaScript/TypeScript that orchestrates allowlisted tools, combines results and uses `Promise.all`. It can run dependent host-tool calls within one outer invocation, avoiding a model round trip between each operation. See [5].

It is not installed here. It is experimental, requires Node 22+, and uses isolated QuickJS. It exposes no direct host filesystem, Node globals or fetch; external capabilities come from the tools you provide. Host tools still run outside the sandbox and need their own validation/authorization.

Potential Locus uses: multi-company comparisons, custom grouping, aggregations over bounded records and multi-source evidence assembly. Do not expose raw SQL, filesystem or shell access. Limit runtime, memory, total tool calls, concurrency and returned bytes. Do not expose approval-dependent tools through it; the documented nested approval flow is unsupported.

Code orchestration does not fix incomplete input data: filtering the first 50 funding rounds in JavaScript still misses companies beyond that preview. Database-side composition comes first.

## 8. Tool search is probably unnecessary at this scale

`toolSearch` plus `deferLoading` loads tools on demand. Discovery becomes usable on the next model step, so it adds a step before retrieval. This is a context-saving feature for large tool catalogs, not an automatic latency win for our current 15 tools. Keep core discovery tools loaded; revisit when the catalog grows. See [4].

## 9. Additional useful capabilities beyond funding

1. **Aggregations:** count distinct companies, jobs or rounds; group by country, industry, stage or date bucket; return exact units and completeness. Compute in SQL, not from a result preview.
2. **Company comparisons:** return the same requested fields and sources for several verified companies in one batch.
3. **Evidence retrieval:** section/date filters, match-centered excerpts, source URLs, evidence dates and whether a claim is historical or current.
4. **Investor discovery:** companies backed by an investor, lead versus participant, stage/date/industry filters. Name resolution is separate from exact relation matching.
5. **Hiring-fit search:** experience-year ranges, authorization restrictions, freshness and salary. Distinguish unknown from eligibility.
6. **Pagination:** opaque keyset cursors tied to validated filters/sort/asOf, so “what else?” retrieves the next page rather than repeats the first one.
7. **Filter facets:** return industry/stage/location values and counts with search results to make follow-up refinement easier without a separate exploratory call.
8. **Recent-change summaries:** combine funding/activity/hiring changes over a user-specified window, with dated evidence and no invented change history.
9. **Live source verification:** a bounded public web-search/fetch tool only when requested or clearly labeled as external, with sources kept separate from stored Locus facts.

## 10. Regex and database security

Parameterized structured queries are an appropriate model capability. They are not equivalent to exposing a database connection or arbitrary SQL. Existing query builders parameterize values; no model-authored SQL execution path was found in this audit.

The remaining threats are data authorization/provenance, scraping and cost abuse, expensive queries, wildcard broadening, and prompt injection in retrieved text.

Raw SQL should not be added to the public chat. Even SELECT can read unintended tables, invoke functions, access secrets exposed by views, or consume substantial resources. A read-only role alone is not a complete security policy.

Raw regex is also not recommended initially. PostgreSQL explicitly warns hostile regex can consume arbitrary time/memory and recommends statement timeouts. Trigram patterns without extractable trigrams can become full-index scans. A result LIMIT does not bound the work needed before limiting. See [6], [7].

Safer public operators: exact, prefix, literal substring, phrase, any/all/excluded terms and fuzzy name matching. If patterns become necessary, offer a parsed safe subset over allowlisted fields, not arbitrary regex syntax; still enforce database deadlines and scan budgets.

Operational controls: read-only credentials scoped to public search views; row/column authorization where needed; message/body/tool-output limits; request/model/tool/database deadlines; per-user/IP rate limits; concurrency and token/cost budgets; source-fetch SSRF protections if fetching URLs; trusted tool-result provenance; no write tools in public research mode.

## Implementation order and evaluation

1. Fix current fallback/projection correctness; strict runtime inputs; descriptions and compact model outputs.
2. Add company filters to funding, then cross-entity discovery with complete pre-limit intersections.
3. Add direct funding/activity evidence widgets, cursor pagination, typed counts and aggregations.
4. Improve fuzzy retrieval, batch verification, and add indexes only after examining query plans.
5. Add optional web verification, then experiment with sandboxed code mode.

Evaluate across every configured model using simple lookup, multi-condition discovery, follow-ups, ambiguous names, typos, unknown fields, invalid dates, expensive patterns and malicious retrieved text. Track correctness, evidence completeness, tool errors, model steps, model/DB elapsed time, payload size and p50/p95 end-to-end latency. Set latency targets from those measurements rather than promising a speedup from API options alone.

## Sources

1. [AI SDK tool reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool) and [Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling).
2. [OpenAI provider](https://ai-sdk.dev/providers/ai-sdk-providers/openai).
3. [Loop Control](https://ai-sdk.dev/docs/agents/loop-control) and [streamText reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text).
4. [Tool Search](https://ai-sdk.dev/docs/ai-sdk-core/tool-search) and [toolSearch reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-search).
5. [Code Mode](https://ai-sdk.dev/docs/ai-sdk-core/code-mode).
6. [PostgreSQL pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html).
7. [PostgreSQL Pattern Matching security caution](https://www.postgresql.org/docs/current/functions-matching.html).
8. [PostgreSQL text-search query parsing](https://www.postgresql.org/docs/current/textsearch-controls.html).

Research transport: Ketch source reads and Context7 documentation lookup succeeded. Ketch proxied PostgreSQL search exhausted its bounded attempts; DonSeTch's first broad query returned no results, and a narrower query found the official PostgreSQL documentation.
