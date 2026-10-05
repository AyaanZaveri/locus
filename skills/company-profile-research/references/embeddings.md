# Post-import embeddings for Locus Focus

Read this after any company-profile import or before planning an affected-company
refresh. Embedding completion is part of the full company-profile workflow, not
an optional follow-up. A research-only/JSON-only/no-write request does **not**
authorize this paid/database phase.

## Contract and scope

Read these files from the Autumn repository root before running:

- `lib/ai/embedding-config.ts`: canonical text builders, recipes, keys, vector validation.
- `lib/ai/embedding-batch-plan.ts`: input limits, token margins and price estimate.
- `scripts/prepare-company-embeddings.ts`: scoped snapshot manifest from stored rows.
- `scripts/run-embedding-batch.ts`: dry-run, cached generation, receipts and imports.
- `scripts/verify-embedding-batch.ts`: current-text coverage and cached-query checks.

The fixed configuration is `voyage/voyage-4-large`, **1,024 float dimensions**, with
`inputType: document`, Voyage-only Gateway routing, no truncation and no automatic
retries. Reuse `companyEmbeddingText`, `jobEmbeddingText` and `embeddingKey` rather
than duplicating or summarizing their recipes. Text headers matter: editing a
title, team, skills, company name, industry, tagline or body can invalidate a key.
Do not modify recipes/model/dimensions to make a cache hit or a failing input pass.

Embed one target company's saved About profile and **all normalized job documents
in the snapshot**, including unknown-status or closed records when present.
This does not relabel hiring status or make closed roles eligible for normal
search. People, funding, images, activity and query embeddings are outside this
document phase. A company with zero jobs still gets its About vector.

Generate only **after** the validated profile is imported. The importer can
replace job IDs even when descriptions are unchanged; the content cache survives,
but entity links must be restored. Exact current-text joins, not vector existence
or company/job IDs alone, determine freshness. Do not change the profile schema,
hand-edit normalized facts, or put vector arrays/receipts inside `company.json`.

## 1. Prepare a company-scoped snapshot (no paid calls)

Run from the Autumn checkout with its configured `.env.local`. Never print or
commit `DATABASE_URL`, `AI_GATEWAY_API_KEY`, tokens or request headers. Use a fresh
filename for this attempt under the Git-ignored `.cache/` directory:

```sh
npx tsx --env-file=.env.local scripts/prepare-company-embeddings.ts \
  --company VERIFIED_SLUG \
  --output .cache/embedding-rollouts/manifests/VERIFIED_SLUG-ATTEMPT.json
```

Use the canonical slug read back from Neon, not the company display name or a
guessed alias. The helper reads persisted rows, rejects missing complete text,
and prints the manifest path and **batchId**. Copy that returned ID exactly into
subsequent commands. The ID fingerprints deterministic texts, including duplicate
records/counts, so reruns of the same content reuse the same receipts while changed
text starts a distinct snapshot. The output uses exclusive creation; do not
overwrite a prior manifest or a completed historical rollout.

This manifest builder does not research, import, embed or modify database records.
If a stored description is absent because the source could not be retrieved,
preserve that uncertainty and report a blocked embedding phase; don't fabricate
replacement text or quietly omit the record. Respect requested company scope.

## 2. Dry-run and check the spending gate

```sh
npx tsx --env-file=.env.local scripts/run-embedding-batch.ts \
  --manifest .cache/embedding-rollouts/manifests/VERIFIED_SLUG-ATTEMPT.json \
  --batch RETURNED_BATCH_ID --budget-usd 0.25 --dry-run
```

Review actual company/job counts and statuses, unique/missing/reused vectors,
full-text official-tokenizer count, largest input, API request count, prior spend
and estimated remaining cost. Raw description bytes are not token counts. The
runner allows no truncated/oversized input: its planner caps inputs with a safety
margin, groups by document recipe and limits each provider request to 128 inputs
and 90,000 planned tokens (below Voyage's 1,000 inputs / 120,000 token limits).

The default authorization for a full company-profile workflow is a **$0.25 total
cap for this scoped snapshot**, not $0.25 per API request. Honor a smaller cap
explicitly set by the user. If prior spend plus conservative remaining estimate
exceeds the cap, stop and ask before raising it; do not silently split the same
work across IDs to evade the cap. Do not alter descriptions, truncate them, switch
providers or lower dimensions to evade cost/input limits.

Dry-run can write local planning artifacts but sends no embedding request or DB
write. It is not the completion step: a zero-missing-vector dry-run still does not
restore entity links removed by import.

## 3. Generate missing vectors and relink cached documents

For an authorized full workflow within its cap:

```sh
npx tsx --env-file=.env.local scripts/run-embedding-batch.ts \
  --manifest .cache/embedding-rollouts/manifests/VERIFIED_SLUG-ATTEMPT.json \
  --batch RETURNED_BATCH_ID --budget-usd 0.25 --run
```

This explicit live mode also imports/relinks cached vectors when there are zero
missing documents; unchanged imports should make **zero provider calls**. Do not
regenerate unchanged Exa or any other company's vectors. Exa is excluded from the
old three-batch manifest, but a source-backed scoped Exa refresh is allowed through
the same cache safeguards.

Monitor each request's count, tokens, actual Gateway receipt cost, warnings and
provider attempts. The runner uses one provider call at a time, 15-second request
spacing, saved responses before DB writes, exclusive run locks and durable
inflight markers. Local pacing does not reserve shared provider capacity against
other clients. Inspect Gateway spending controls as well; project budgets do not
necessarily cap API-key requests. Do not retry on rate limits or ambiguous timeouts.

If an invocation is deliberately bounded with `--max-new-requests N`, read its
`remainingUniqueVectors`/`complete` result: a zero exit code can mean a paused,
incomplete rollout. Resume only the same unchanged manifest and batch ID. A
successful generation summary is provisional until independent verification.

## 4. Verify current-text coverage and useful retrieval

```sh
npx tsx --env-file=.env.local scripts/verify-embedding-batch.ts \
  RETURNED_BATCH_ID \
  --manifest .cache/embedding-rollouts/manifests/VERIFIED_SLUG-ATTEMPT.json
```

The verifier checks exact-current-text About coverage, all-status job document
coverage, eligible open-or-unknown job coverage, company-scoped cached-query retrieval, source links, description
evidence and an impossible exact-filter case. For a zero-job company, About
coverage must still pass and job coverage is **0/0**, not an embedding failure.

The runner snapshots all job statuses; this verifier's search denominator is
only date-eligible open/unknown roles. If closed or future-dated jobs exist, the
manifest's all-status count may differ. The verifier separately audits all document
keys in `allJobDocumentCoverage`; report both denominators. Do not drop records,
invent dates or change hiring status to satisfy an assertion. Coverage is a record count, never a relevance-match
count or proof that a company is currently hiring.

The verifier disables its Gateway key and uses existing canonical query vectors,
so it cannot silently spend money when a query is absent. If a required query
vector isn't cached, distinguish that smoke-test prerequisite from document
coverage: confirm current-text SQL coverage, report the skipped smoke test and
obtain authorization before generating a pilot query. Query vectors use their
own `inputType: query`/recipe; don't mix them with document generation.

Review retrieved descriptions rather than just scores. A nearest neighbor can
be a weak fit; do not claim explicit storage/neural-search responsibilities that
the excerpt does not support. Preserve unknown/open/closed status and source URLs.
An optional production `/api/chat` test should scope the target company, request
a small result limit, and check semantic mode, coverage, final stream completion
and cache reuse. Any new query or chat inference cost is separate from document
cost. A database vector import needs no app redeployment.

Finally rerun the same live command after completion and check that it sends
**zero new provider requests**. Keep receipts, vectors, payloads and SSE under
`.cache/embedding-rollouts/RETURNED_BATCH_ID/`, not Git; a small manifest/status
report without credentials or vectors may be committed when requested.

## Failure and completion rules

- **Inventory/text changed:** stop, inspect the persisted changes and prepare a
  new snapshot; preserve prior receipts/cache. Never reuse an old count on faith.
- **Missing text:** retain source uncertainty; report import success separately
  from incomplete embedding coverage. A summary/title is not a substitute body.
- **Ambiguous provider failure:** keep `.inflight` markers and saved responses;
  inspect Gateway billing before any manual recovery. Do not blindly delete a
  lock, clear a marker, change batch ID or rerun with automatic retries. A stale
  lock must be checked against the owning process before release.
- **Provider warnings or invalid/mismatched vectors:** stop and inspect the saved
  response. Do not import mocked, wrong-model, wrong-dimension or invalid vectors.
- **DB import failed after generation:** recover from validated saved vectors;
  do not pay to regenerate a successful response.
- **Incomplete coverage:** do not declare the full skill complete. State exactly
  which phase succeeded, which records remain and the blocking action needed.
- **Scope:** global gaps may be disclosed but are not authorization to embed
  other companies or change app behavior.

In the completion ledger (separate from the single profile JSON), include target
slug, snapshot/batch ID, About and job counts, hiring-status breakdown, new and
reused unique vectors, actual document tokens/cost, verification/cache-hit status,
any separate query/chat charges and unresolved/skipped steps. Document completion
requires full current-text coverage and truthful evidence, not merely a successful
profile import or paid API response.
