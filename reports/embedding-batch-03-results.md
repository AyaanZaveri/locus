# Embedding batch 3: completed

Verified October 4, 2026, 15:38 UTC. All three rollout batches are complete.

| Metric | Result |
| --- | ---: |
| Company About records covered | 12 / 12 |
| Job records covered (all recorded open) | 1,519 / 1,519 |
| New unique document vectors | 1,516 |
| Duplicate documents reused | 15 |
| Successful document API requests | 22 |
| Gateway-reported document tokens | 1,740,965 |
| Gateway-reported document cost | $0.20891580 |
| Additional verification query embedding cost | $0 |
| Provider warnings / retries / unresolved requests | 0 / 0 / 0 |

Generation ran from 15:24:17 to 15:35:02 UTC: **10 minutes 45 seconds**, including
monitoring pauses and imports. Verification finished around 15:38 UTC.

The official local tokenizer counted 1,742,481 tokens. The cost estimate including
a per-input safety margin was $0.22074060; actual reported cost stayed below the
$0.25 stop cap. Vectors use Voyage 4 Large, document input type, 1,024 float
dimensions, full untruncated texts and Voyage-only routing. Receipts confirm one
provider attempt per request. Existing pilot and earlier rollout vectors were not
regenerated.

## Verification

- Current-text coverage is complete for batch 3 and globally: **53/53 company
  About profiles and 3,980/3,980 open-or-unknown job records**. This is coverage
  of the current database snapshot, not proof of relevance or future freshness.
- The live runner was invoked again and reused all 1,516 vectors with **zero new
  API requests**.
- Cached-query checks covered OpenAI, Mistral AI and Replit. OpenAI surfaced
  Personal AGI/Post Training and Training research roles; Mistral surfaced Machine
  Learning and Forge research roles; Replit surfaced Compute Platform, Growth
  Infrastructure and Staff Infrastructure roles. Results retain recorded status,
  description evidence and source links.
- A production Focus request for Replit used semantic retrieval with all 72
  eligible roles covered and a cached query vector. Senior Software Engineer,
  Compute Platform ranked first (approximately 0.522). Focus cited its distributed
  systems and global deployment responsibilities while explicitly noting that its
  description does not establish a large-scale-storage focus. All three results
  retained recorded open status and source links.
- Impossible exact salary/location filters return no candidates without query
  embedding generation. Verification disables its Gateway key to avoid paid
  generation if a required cached query is absent.
- Typecheck and **49 targeted tests** passed. Tests now calculate global coverage
  truthfully rather than assuming the database is partially embedded. A synthetic
  changed-text fixture still proves incomplete coverage (51/52 eligible Exa jobs)
  is detected without changing database records.

## Completed rollout

All three batches together cost **$0.55319028** in document embedding charges,
excluding the earlier Exa pilot, query embeddings and chat-model inference.
Recorded unknown hiring statuses remain unknown. New or edited document text will
need new vectors; the existing exact-current-text joins exclude stale vectors.
Similarity scores remain ranking signals, not probabilities or proof of fit.

Vectors are already available to production Focus through Neon; no redeployment
is required for these data changes. Source/script/test changes remain local until
committed and pushed.

Full receipts, vector payloads, coverage reports and production API traces remain
in the Git-ignored `.cache/embedding-rollouts/batch-03/` directory.

```sh
npx tsx --env-file=.env.local scripts/run-embedding-batch.ts --batch batch-03 --dry-run
npx tsx --env-file=.env.local scripts/verify-embedding-batch.ts batch-03
```
