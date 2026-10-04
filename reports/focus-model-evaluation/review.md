# Focus production evaluation: reviewed results

October 4, 2026. **9 questions × 3 models = 27 first-turn production requests.**

- [Questions and expected answers](questions-and-answers.md)
- [Every actual answer and tool call](results.md)
- [Full response evidence](results.json)

## Results

| Requested model | Pass | Partial | Fail | Median end-to-end time |
| --- | ---: | ---: | ---: | ---: |
| GPT-6 Luna | 9 | 0 | 0 | 7.4s |
| Meta Muse Spark 1.3 | 9 | 0 | 0 | 9.9s |
| MiMo V2.6 Flash | 7 | 1 | 1 | 15.6s |

| Question | GPT-6 Luna | Muse Spark 1.3 | MiMo V2.6 Flash |
| --- | --- | --- | --- |
| Cursor semantic storage-role search | Pass | Pass | Pass |
| Five roles across Exa/Cursor/Baseten/Cohere | Pass, weak-neighbor caveat | Pass, weak-neighbor caveat | **Fail: no final answer** |
| Global company About/API discovery | Pass | Pass | **Partial: unsupported neural-API assertion** |
| Exa confirmed-open count | Pass | Pass | Pass |
| Exa unconfirmed infrastructure roles | Pass | Pass | Pass |
| Impossible location and salary intersection | Pass | Pass | Pass |
| Highest minimum salary, remote, annual USD | Pass | Pass | Pass |
| Exa founders while on OpenAI's page | Pass | Pass | Pass |
| Search-company funding in September 2025 | Pass | Pass | Pass |

Pass means the returned records/card data and narrative satisfy the material
constraints, use database evidence, preserve status and supply sources. Partial
means the core answer is correct but contains an unsupported assertion. Fail
means the request never delivers a usable final answer or materially violates
the requirements. These are reviewed judgments, not just oracle equality checks.

The site deliberately uses inline cards for identities, roles and locations.
GPT's founder answer supplies sources while names/roles are in its two returned
person cards; its salary answer supplies pay while company/location restrictions
are in the returned job cards. Those are not scored as missing facts. Browser
rendering itself was not checked.

## Important findings

### 1. MiMo overfetched and failed the cross-company request

The prompt asks for **five overall**. MiMo resolved four companies and called
`queryJobs` with **limit 50**, returning 50 vector-ranked records. Its stream then
ended after **60.2 seconds**, with HTTP 200 but **no finish event and no final
answer text**. The production route has a 60-second maximum duration; the timing
is consistent with that deadline, though no explicit timeout error was emitted.
Do not interpret HTTP 200 alone as a successful streamed response.

No automatic retry was made. Raw failure trace:
`mimo-v2.6-flash--cross-company.sse` in the local run directory referenced by
`results.json`.

### 2. MiMo overstated the company About evidence

It correctly retrieved Tavily, Parallel and Context.dev and disclosed 53/53
coverage. But it described Tavily as **"a neural retrieval API explicitly aimed
at agents."** The returned About excerpt establishes search/extraction APIs for
agents and RAG, **not a verified neural retrieval architecture**. Product fit is
supported; that stronger technical claim is not established by the retrieved
evidence. GPT and Muse avoided that extra assertion.

### 3. The fifth cross-company nearest neighbor is weak

The vector baseline returns Cohere's **Data Engineer, Data Foundations** fifth.
Its available excerpt concerns customer experiences, analytics and cross-functional
work, without strong distributed-storage evidence. GPT and Muse explicitly
flagged this weakness instead of inventing a storage match. Their answers pass
the factual/safety checks, but retrieval quality at rank five remains a limitation:
these are five nearest neighbors, not five independently proven strong fits.

Consider a larger internal candidate pool followed by evidence-based reranking
and rejection of unsupported neighbors, while keeping the visible result limit
at five. Returning fewer supported fits is preferable to padding recommendations.

### 4. All models preserved the hard filters and hiring-status distinctions

- Exa confirmed-open count: **0**, without substituting unknown-status records.
- Exa infrastructure-role search: all three returned statuses remain
  **unknown/unconfirmed**, never relabeled open.
- Cursor + Mars + minimum annual USD salary of $1B: **no records**, without
  dropping either constraint.
- Remote, confirmed-open, minimum annual USD salary at least $200K: correct
  three-record ranking, including the non-engineering Warehouse and Logistics
  Capability Manager rather than silently curating a lower-paying software role.
- Exa founders: **Jeff Wang** and **Will Bryk**, not OpenAI people despite the
  current page context.
- Funding window: **Exa, Series B, September 3, 2025, $85M round amount**, not
  total funding or an older substituted round.

### 5. GPT was the most efficient on this suite

GPT made **10 total tool calls**, Muse **20**, and MiMo **16**. Muse's cross-company
answer used five preliminary company lookups before the combined query; GPT went
directly to the query. Muse also refetched three company overview profiles whose
About excerpts were already available. These did not cause incorrect answers but
added latency and inference work.

## Scope and limitations

This is one run per question/model, not a statistical reliability benchmark.
Several semantic prompts deliberately specify a cached canonical intent, so the
suite tests retrieval use and answer quality more than free-form query formulation.
No follow-up-memory, disabled-provider, changing-data, concurrency-load or mobile
rendering test is included. All semantic query calls reused cached vectors; this
test needed no new query embeddings. Chat inference was paid separately and its
cost was not measured by this harness.

Requests went to the live site's `/api/chat`, using the configured IDs
`gpt-6-luna`, `muse-spark-1.3-contributor`, and `mimo-v2.6-flash`. Three lanes ran
concurrently, at most one request/model at a time, with fresh sessions and no
automatic retries. Times include network, tools and final text generation, not
time to first token. Expected answers were prepared directly from current
database tools before the production runs, not inferred from another model.

**Recommendation:** keep GPT-6 Luna as the default based on this sample. Muse is
a sound alternative but overuses tools. Investigate MiMo's limit adherence and
stream deadline handling before treating it as equally reliable for multi-company
questions. No application code was changed by this evaluation.
