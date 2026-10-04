# Embedding batch 2: completed

Verified October 4, 2026, 15:13 UTC. Batch 3 has not started.

| Metric | Result |
| --- | ---: |
| Company About records covered | 20 / 20 |
| Job records covered | 1,513 / 1,513 |
| Confirmed-open job records | 1,281 |
| Unknown-status job records | 232 |
| New unique document vectors | 1,525 |
| Duplicate documents reused | 8 |
| Successful document API requests | 24 |
| Gateway-reported document tokens | 1,898,867 |
| Gateway-reported document cost | $0.22786404 |
| Additional verification query embedding cost | $0 |
| Provider warnings / retries / unresolved requests | 0 / 0 / 0 |

The local tokenizer estimate, including a safety margin, was $0.23975904. The
paid run stayed below its $0.25 cap. It used Voyage 4 Large, 1,024 float dimensions,
full texts, document input type and Voyage-only routing. Saved response receipts
confirm exactly one provider attempt per request. Previous Exa and batch 1 vectors
were not regenerated.

Generation ran from 15:00:26 to 15:09:44 UTC: **9 minutes 18 seconds**, including
monitoring pauses and database imports. Verification finished around 15:13 UTC.
Photon received its About vector despite having no recorded jobs.

## Verification

- Exact current-text coverage is 20/20 companies and 1,513/1,513 jobs. Coverage
  counts records, not semantic relevance matches.
- A repeated live runner invocation reused all 1,525 cached vectors and made
  **zero additional embedding requests**.
- Cached-query checks tested Anthropic, ElevenLabs and Vercel. Anthropic surfaced
  ML/RL and Knowledge Team research roles. ElevenLabs surfaced Research Engineer,
  Inference and Data Infrastructure roles while retaining unknown hiring status.
  Vercel surfaced Data Platform, Compute and Agentic Infrastructure roles.
- Impossible salary/location filters return no candidates without embedding a
  query. The standalone verifier disables its Gateway key to prevent accidental
  paid query generation if a required cached vector is absent.
- Live production Focus selected semantic search at Vercel, reported complete
  coverage of 84 eligible roles and reused the cached query vector. Vector ranking
  placed Data Platform first, followed by Compute and Agentic Infrastructure.
  Focus selected Compute as the strongest storage fit based on description
  evidence about the Persistence team's ownership of storage/state across regions,
  and included the source URL and recorded open status. This evidence-based choice
  is distinct from claiming the highest vector score is definitive proof of fit.
- Typecheck and **49 targeted tests** passed. No provider warnings, retries,
  fallback providers or unresolved inflight requests remain.

## Global coverage and remaining work

Including Exa and batch 1:

- **41 / 53 company About profiles** are covered.
- **2,461 / 3,980 open-or-unknown job records** are covered.
- Remaining in batch 3: **12 companies and 1,519 job records**.

These vectors are already usable in production Focus through Neon. No redeployment
is required for new database vectors. Global coverage remains partial and must be
disclosed. Similarity scores are ranking signals, not probabilities or proof.

Receipts, full vector payloads, coverage reports and production API traces remain
in the Git-ignored `.cache/embedding-rollouts/batch-02/` directory. Chat-model
inference costs are separate from document embedding costs.

```sh
npx tsx --env-file=.env.local scripts/run-embedding-batch.ts --batch batch-02 --dry-run
npx tsx --env-file=.env.local scripts/verify-embedding-batch.ts batch-02
```
