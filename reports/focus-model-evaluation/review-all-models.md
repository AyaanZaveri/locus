# Focus benchmark: all seven listed models

Nine identical questions per model, **63 production requests total**: the original
27 requests plus 36 requests for the other four models. This is one run per
question, not a statistical reliability estimate.

- [Questions and expected answers](questions-and-answers.md)
- [Original three models: actual responses](results.md)
- [Other four models: actual responses](results-remaining.md)
- [Original reviewed findings](review.md)
- Raw structured results: [first run](results.json), [remaining models](results-remaining.json)

## Reviewed scores

| Requested model | Pass | Partial | Fail | Median seconds | Total tool calls |
| --- | ---: | ---: | ---: | ---: | ---: |
| GPT-6 Luna | 9 | 0 | 0 | 7.4 | 10 |
| Meta Muse Spark 1.3 | 9 | 0 | 0 | 9.9 | 20 |
| Space Bunny | 9 | 0 | 0 | 14.2 | 13 |
| DeepSeek V4.1 Flash | 8 | 1 | 0 | 10.8 | 18 |
| MiMo V2.6 Flash | 7 | 1 | 1 | 15.6 | 16 |
| GLM-5.3 Flash | 6 | 1 | 2 | 13.3 | 15 |
| LongCat 2.5 Preview Free | 6 | 2 | 1 | 25.7 | 17 |

Times include network, tool execution and response generation. Failure durations
are included in the medians. Runs were separate waves, so load was not identical.

**Pass:** correct retrieved facts, material constraints and supporting evidence.
**Partial:** the core final answer is correct but contains an unsupported claim,
an explicitly forbidden extra search, or extra/misleading result-card batches.
**Fail:** no usable final answer or an incorrect core answer. This extends the
same evidence/status/constraint criteria used in the first review to the new
observable cases; strict automated oracle equality alone is not the score.

## Same nine cases on the four remaining models

| Case | GLM | DeepSeek | Space Bunny | LongCat |
| --- | --- | --- | --- | --- |
| Cursor semantic storage roles | Pass | Pass | Pass | Pass |
| Five roles across four companies | **Fail** | Pass | Pass | **Fail** |
| Global About/API discovery | **Partial** | Pass | Pass | **Partial** |
| Exa confirmed-open count | Pass | **Partial** | Pass | Pass |
| Exa unconfirmed infrastructure roles | Pass | Pass | Pass | **Partial** |
| Impossible location/salary intersection | Pass | Pass | Pass | Pass |
| Highest minimum annual USD salary, remote | **Fail** | Pass | Pass | Pass |
| Exa founders on OpenAI page | Pass | Pass | Pass | Pass |
| Search-company funding, September 2025 | Pass | Pass | Pass | Pass |

## Findings

### Space Bunny: strongest newly tested model

All nine completed with supported answers and correct filters. It respected the
five-role limit without preliminary company lookups, explicitly called the fifth
neighbor a weak storage fit, and preserved unknown hiring statuses.

Its company-discovery answer made a useful distinction: Tavily, Parallel and
Context.dev rank highest for the full conceptual intent, but their About excerpts
do not establish a literal **neural** architecture. It used a source-backed
`searchKnowledge("neural")` lookup to identify Exa as explicitly mentioning neural
retrieval, instead of asserting that all neighbors are neural APIs.

It also noticed a data-quality concern in the salary results: the Warehouse and
Logistics role shares an unusually high band with an infrastructure role and has
remote status despite a location string without remote wording. It retained the
recorded result, warned the user to verify it, and did not silently substitute a
lower-paying engineering role. The potential inconsistency is in the recorded
data; the benchmark did not independently fetch the employer's current posting.

### DeepSeek: correct answer, but violated a search-only constraint once

All nine streams completed. On Exa's confirmed-open count, it first correctly
queried `status: open` and got zero. Then it queried **openOrUnknown, limit 50**,
even though the user explicitly said to search only confirmed-open records.
That returned **50 unconfirmed job cards** alongside the correct final count of
zero. It did not relabel them open, but the extra retrieval/presentation violated
the request. Scored **partial**, not a false hiring claim.

The other eight answers preserved facts, filters, status, sources and ranking.

### GLM: two deadline-shaped failures and one unsupported ownership claim

- **Cross-company:** four preliminary company lookups, then `queryJobs(limit: 20)`
  instead of five. HTTP 200, stream ended after **60.2s**, no finish event and no
  final answer. Twenty records were retrieved, not a successful recommendation.
- **Salary ranking:** stream ended after **60.2s**, with no completed tool outputs
  and no final answer.
- **About discovery:** correct top three and complete coverage, but the answer
  added that Parallel and Context.dev were **"independent"**. Retrieved About
  evidence and funding stages did not establish current ownership independence.
  This unnecessary unsupported caveat is scored partial under the same rule that
  penalized MiMo's unsupported neural-API assertion in the original run.

The six other questions completed correctly. No explicit timeout error was
emitted on either failed stream, so a client must not treat HTTP 200 as success.

### LongCat: one deadline-shaped failure and two presentation problems

- **Cross-company:** used the correct five-record limit after four preliminary
  company lookups, but the stream ended after **60.2s** without a finish event or
  final text. Overfetching is not the only contributor to deadline risk.
- **About discovery:** first queried semantic candidates sorted by **name**,
  returning **Anthropic, Autumn AI and Baseten**. It then corrected to relevance,
  returning **Tavily, Parallel and Context.dev**. Final text was correct, but two
  company result batches were returned for a three-company request, with the
  first batch unrelated to the claimed top-three recommendation.
- **Exa unconfirmed roles:** requested **10 records**, narrated the correct three,
  but returned ten job cards. Status and evidence were correct; user-facing result
  limits were not.

The current client code creates a result segment for each completed query tool
output (`components/locus-chat.tsx`, `toLocusSegments`), so extra batches matter
even when the final paragraph is corrected. This review inspects those API card
payloads and client behavior; it does not claim browser screenshot verification.

## Shared retrieval limitation

Successful cross-company answers continue to surface Cohere's **Data Engineer,
Data Foundations** as the fifth vector neighbor. The excerpt does not strongly
support distributed storage; DeepSeek and Space Bunny both acknowledge that.
Exact vector ordering alone is not proof of five strong fits. Consider internal
candidate reranking and evidence-based rejection, without enlarging the visible
answer beyond the user's requested limit.

## Verification and limits

- All **36 unique model/question pairs** were exercised once against the site's
  production `/api/chat`, with the exact original questions and fixed oracle.
- **33/36** new streams completed; **3/36** ended near the route's 60-second
  maximum without final answers. Timing is consistent with the deadline, but no
  explicit timeout exception was exposed in the SSE.
- All **17 semantic calls** in this new wave reported complete coverage and
  reused query vectors. No new query embeddings were needed. One extra semantic
  call came from LongCat correcting its company sort order.
- All four models answered the impossible-filter, founders and funding-window
  cases correctly; there was no filter relaxation on the impossible case.
- No automatic retries, app-code changes or model-setting changes were made.
- Original run files remain intact. Raw requests, SSE and individual receipts are
  in the Git-ignored local run directory recorded in `results-remaining.json`.
- At most three model lanes ran concurrently, one request/model at a time. The
  fourth lane was queued. Fresh sessions avoid evidence from prior questions.
- Chat inference cost was not measured; a UI model label containing "free" is
  not treated as independently verified billing evidence.
- No visual-browser, follow-up-memory, free-form intent formulation, stress-load,
  disabled-provider or repeated-trial reliability test is included.

## Recommendation

**Keep GPT-6 Luna as default** on this evidence: it was accurate and fastest with
the fewest tool calls. **Space Bunny is the strongest newly tested alternative**
and showed particularly good source-grounding caution. Muse remains accurate but
tool-heavy. DeepSeek is promising after fixing forbidden extra searches.

Investigate deadline handling and pre-answer tool overhead for GLM, LongCat and
MiMo. Also prevent accidental extra result batches and enforce visible result
limits. These are findings and recommendations, not fixes applied by this task.
