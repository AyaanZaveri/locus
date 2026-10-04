# Embedding batch 1: completed

Verified October 4, 2026, 05:50 UTC. Batches 2 and 3 have not started.

## Outcome

| Metric | Result |
| --- | ---: |
| Company About records covered | 20 / 20 |
| Job records covered | 896 / 896 |
| Confirmed-open job records | 730 |
| Unknown-status job records | 166 |
| New unique document vectors | 907 |
| Duplicate documents reused | 9 |
| Successful document API requests | 13 |
| Gateway-reported document tokens | 970,087 |
| Gateway-reported document cost | $0.11641044 |
| New production smoke-test query cost | $0.00000132 |
| Provider warnings / retries / unresolved requests | 0 / 0 / 0 |

Vectors use Voyage 4 Large, document input type, 1,024 float dimensions, full
untruncated texts and Voyage-only routing. Each response was validated and saved
before import. No batch 2/3 vectors were generated and Exa was not regenerated.

The local official-tokenizer count was 970,994 tokens before a per-input safety
margin. The estimate including that margin was $0.12348504, within a $0.25 local
stop cap. Actual billed usage was lower by one token per input than the local
count; the reported cost above comes from Gateway receipts, not that estimate.

First provider request: 05:36:46 UTC. Last provider completion: 05:43:19 UTC.
Generation was intentionally paused in chunks for receipt and coverage checks.
Verification and production smoke tests followed.

## Verification

- SQL coverage checks confirm all 20 About texts and all 896 job descriptions
  match their current deterministic embedding text. This is record coverage,
  not a claim that every record is relevant to every query.
- Rerunning the live runner generated **zero new API requests** and reused all
  907 cached document vectors.
- Cached-query smoke tests across Baseten, Cohere and Cursor returned scored
  roles, description evidence and source links. Cohere roles retain unknown
  status. Company About retrieval for neural web-retrieval APIs ranks Tavily,
  Parallel and Firecrawl first within this batch.
- Impossible salary/location filters return no candidates and make no embedding
  request. Scoped semantic coverage is complete; global coverage is still partial.
- The live production Focus request for Cursor distributed-storage roles returned
  Software Engineer, Storage first (score approximately 0.567), followed by
  Engineering Manager, Infrastructure and Software Engineer, Pretraining.
  Its answer supported the strongest match with the role's data-layer, cache
  infrastructure and resilient-storage responsibilities and preserved open status.
- The model added a trailing period to the requested query text, making its first
  production query a distinct cache key. That generated one 11-token query vector
  at the separate $0.00000132 cost above. Repeating the actual tool query reused
  its vector (`queryCacheHit: true`) with unchanged results. Chat-model inference
  cost is separate from these embedding costs.
- Typecheck and **49 targeted tests** passed. These include planning limits,
  semantic and exact filters, caching, stale-text exclusion, replacement IDs,
  fallback behavior, counts, aliases and UI trace modes. The rollout was also
  exercised with a mocked Gateway before any paid generation.

## Current global coverage

Including Exa's previous pilot:

- **21 / 53 companies** have current About vectors.
- **948 / 3,980 open-or-unknown job records** have current vectors.
- Remaining: **32 companies and 3,032 job records**, assigned to batches 2 and 3.

The data is already available in production Focus through Neon; a redeployment
is not required to activate these vectors. Unsupported concepts can still have
nearest neighbors, so scores alone must not establish a match.

## Artifacts and repeatable checks

Sensitive/local vector payloads, receipts and production API traces remain in the
Git-ignored `.cache/embedding-rollouts/batch-01/` directory. Mock responses are
isolated in `mock-batch-01/` and are never imported into the database.

```sh
# Dry-run only: recheck cache coverage and estimate missing work.
npx tsx --env-file=.env.local scripts/run-embedding-batch.ts --batch batch-01 --dry-run

# Cached-query verification: the verifier disables its Gateway key to prevent
# accidental generation if a required query vector is absent.
npx tsx --env-file=.env.local scripts/verify-embedding-batch.ts batch-01
```

Paid generation uses an explicit `--run` switch and budget. Inflight request
markers block automatic retry after an ambiguous failure. Inspect Gateway billing
before clearing a marker; never blindly regenerate a timed-out batch. CLI request
pacing does not reserve the shared Gateway quota against other clients, so a
concurrent production caller can still cause a rate limit, which stops the runner.
