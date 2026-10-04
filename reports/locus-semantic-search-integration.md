# Focus semantic retrieval: Exa pilot

Implemented October 4, 2026. No remaining-company/job backfill has been run.

## Retrieval choice

Focus opts into semantic/vector search with `queryJobs.semanticQuery` or
`queryCompanies.semanticQuery`. Omit it for names, aliases, exact skills and
structured-only discovery. Existing conversation evidence can answer follow-ups
without retrieval. Combining semanticQuery with query applies the latter as an
additional lexical constraint; semantic concepts should not be duplicated in
title/skills unless explicitly requested. Nested company job filters remain
lexical/structured, not semantic.

All exact filters apply before vector ranking and limiting. Status still defaults
to confirmed open; recorded-role discovery can explicitly request openOrUnknown.
Exa's 52 imported roles have unknown status and must not be described as open.

Results include scores, description excerpts, source URLs, scoped coverage and
cache-hit metadata. Semantic counts are `totalCandidates/hasMoreCandidates`, not
counts of relevant matches. Nearest neighbors require evidence review, especially
for unsupported concepts. Unembedded records are excluded from vector ranking
but remain available to ordinary tools. Incomplete coverage must be disclosed.

## Database and paid-call safety

- Migration `0003_embedding_cache` enables pgvector and creates a durable
  content-addressed vector cache, entity references and query reservations.
- Voyage 4 Large, 1,024-dimensional float vectors; document/query input types,
  explicit Voyage-only routing, no truncation or automatic retries.
- Cached documents join against the current deterministic embedding text, not
  replacement job IDs. Changed content cannot reuse a stale vector; unchanged
  imports can reuse the durable cache even after references cascade away.
- Query vectors are cached by exact text/configuration. Repeating the same query
  reuses its vector; paraphrasing creates a different cache key.
- A persistent reservation precedes each new query request. Unique keys prevent
  cross-process duplicates; 200 fixed daily slots bound new paid calls. A shared
  recent-reservation guard observes the five-request/minute free-tier limit.
  Concurrent slot races fail closed rather than sending an extra paid request.
- Failed or ambiguous reservations remain blocked. Inspect Gateway billing before
  manually releasing one; do not blindly delete failed reservations.
- `LOCUS_SEMANTIC_SEARCH=off` disables semantic retrieval. Missing coverage,
  provider errors, blocked reservations or exhausted budgets use a disclosed
  lexical fallback without dropping exact filters or silently retrying synonyms.
- These are local call limits, not a Gateway dollar cap; configure API-key/team
  spend limits before expanding production traffic.
- Exact cosine ranking is used. No HNSW index or bulk generation was added.

## Import and verification

Run `npm run db:migrate`, then:

```sh
npx tsx --env-file=.env.local scripts/import-exa-embeddings.ts
npx tsx --env-file=.env.local scripts/import-exa-embeddings.ts --apply
```

The importer validates the entire local canary cache before writing, imports one
company, 52 jobs and seven existing query vectors, and makes zero provider calls.
Rerunning the importer is safe. The local `.cache` files are ignored by Git.

The real `/api/chat` request asked for three recorded Exa roles focused on
distributed storage and large-scale data infrastructure. Focus chose queryJobs
with semanticQuery and openOrUnknown. Results, in order:

1. Software Engineer, Distributed Data Systems (0.6021)
2. Software Engineer, Knowledge Systems (0.4735)
3. Software Engineer, Backend (0.4472)

The answer cited the strongest role's lakehouse, distributed processing and
streaming responsibilities and explicitly qualified hiring status. The new query
embedding used 31 tokens with Gateway-reported cost $0.00000372. Repeated requests
used the same vector with queryCacheHit true. Chat-model inference is separate
from that embedding cost. Raw API traces remain in the ignored canary directory.

Global open-or-unknown coverage at verification was 52 embedded of 3,980 eligible
jobs. A performance regression from repeated extraction of large company JSON
profiles was fixed by materializing tiny company metadata once per company:
measured global coverage fell from approximately 55 seconds to 0.54 seconds.

Regression coverage exercises strict schemas, SQL parameterization, zero-cost
mock provider paths, cache/concurrent-request reuse, reservation failures,
vector validation, exact filters, company About retrieval, partial coverage,
stale-content exclusion, replacement IDs and explicit fallback. Typecheck and
42 targeted tests passed before committing and pushing this integration.
