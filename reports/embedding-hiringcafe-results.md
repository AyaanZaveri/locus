# HiringCafe embeddings: completed

October 5, 2026. Company slug: `hiringcafe`.

| Metric | Result |
| --- | ---: |
| About profiles covered | 1 / 1 |
| Job records covered | 8 / 8 |
| Recorded-open jobs | 8 |
| New unique document vectors | 9 |
| Successful document API requests | 2 |
| Gateway-reported tokens | 5,178 |
| Gateway-reported document cost | $0.00062136 |
| Extra query embedding cost for verification | $0 |
| Warnings / retries / unresolved requests | 0 / 0 / 0 |

The local official tokenizer counted 5,187 tokens; the estimate with per-input
safety margins was $0.00069156. Generation stayed within its $0.01 cap and ran
from 19:03:29 to 19:03:45 UTC, including intentional request pacing.

The same Voyage 4 Large configuration is used: document input type, 1,024 float
dimensions, complete untruncated texts, Voyage-only routing, content-addressed
cache and no automatic retries. Existing company embeddings were not regenerated.

## Verification

- SQL checks confirm exact current-text coverage: 1/1 About profile and 8/8 jobs.
- A repeated live runner invocation generated **zero additional API requests**.
- Cached-query retrieval ranked **Founding Backend / Infra Engineer** first,
  followed by ML Engineer - Inference & Model Deployment and Founding Machine
  Learning / AI Search Engineer. All statuses remain recorded open.
- Production Focus returned the same three roles with complete coverage and a
  cache hit. It cited the backend role's scalable infrastructure and real-time
  crawler responsibilities, while explicitly stating that these do not establish
  distributed-storage experience. Source links were preserved.
- About retrieval was checked against the stored profile vector. Impossible
  exact salary/location filters returned no candidates or paid query generation.
- Typecheck and **14 targeted tests** passed.

The vectors are already available in production through Neon; no redeployment is
required. The production smoke test reused a cached query vector. Chat inference
cost is separate and is not included above.

## Global snapshot

The database changed since the October 4 rollout. At this verification snapshot,
current-text coverage is **54/55 company About profiles** and **3,902/3,907 eligible
open-or-unknown jobs**. HiringCafe itself is complete. One other About profile and
five other jobs lack current vectors; no broader backfill was performed here.

Vector payloads, receipts and production SSE remain in the Git-ignored
`.cache/embedding-rollouts/hiringcafe-2026-10-05/` directory. The independent
manifest preserves the original completed three-batch rollout history.

```sh
npx tsx --env-file=.env.local scripts/run-embedding-batch.ts \
  --manifest reports/embedding-hiringcafe.json --batch hiringcafe-2026-10-05 --dry-run

npx tsx --env-file=.env.local scripts/verify-embedding-batch.ts \
  hiringcafe-2026-10-05 --manifest reports/embedding-hiringcafe.json
```

Unrelated existing UI/package changes were not modified. Runner and verifier now
accept an optional manifest path; their original manifest remains the default.
