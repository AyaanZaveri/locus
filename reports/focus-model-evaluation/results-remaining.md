# Focus production evaluation: 4 models

**Reviewed scores and findings:** [review-all-models.md](review-all-models.md).
Endpoint: `https://locusaz.vercel.app/api/chat`. Nine fresh-session questions per model, 36 requests total. At most three concurrent lanes, one request per model at a time. The API serves the site's Focus chat, including inline-card data; browser rendering was not tested.

Expected answers: [questions-and-answers.md](questions-and-answers.md). Full machine-readable evidence: [results-remaining.json](results-remaining.json). Raw SSE and requests are retained locally in `.cache/focus-model-evaluation/`.

## Automated checks (not a final quality score)

These compare transport, tool inputs, returned records and cache/coverage to the deterministic oracle. Flags may be legitimate alternative retrieval or evidence-based ordering, so they require review. A clean check alone does not prove narrative accuracy.

| Model | Clean checks | Flagged | Median seconds | Max seconds |
| --- | ---: | ---: | ---: | ---: |
| glm-5.3-flash | 7/9 | 2 | 13.3 | 60.2 |
| deepseek-v4.1-flash | 8/9 | 1 | 10.8 | 13.3 |
| space-bunny-free | 9/9 | 0 | 14.2 | 43.5 |
| longcat-2.5-preview-free | 7/9 | 2 | 25.7 | 60.2 |

## Semantic job relevance (`cursor-semantic`)

**Question:** At Cursor, return the three recorded roles most relevant to distributed storage and large-scale data infrastructure, including unconfirmed-status roles but not closed roles. Use exactly this semantic search intent: "Engineering roles building distributed data infrastructure and large-scale storage systems". Explain the strongest match with description evidence, give source links and recorded hiring status, and say whether semantic coverage is complete.

**Expected answer:**

- **Cursor — Software Engineer, Storage**; status: open; location: San Francisco, CA | New York, NY. [Source](https://cursor.com/careers/software-engineer-storage)
- **Cursor — Engineering Manager, Infrastructure**; status: open; location: San Francisco, CA | New York, NY. [Source](https://cursor.com/careers/engineering-manager-infrastructure)
- **Cursor — Software Engineer, Pretraining**; status: open; location: San Francisco, CA. [Source](https://cursor.com/careers/software-engineer-pretraining)
- Complete current-text coverage: 132/132 eligible records. These are candidates, not proven relevance matches.
- Storage is the strongest direct fit: its description covers owning databases/caches, a resilient partitioned multi-database topology, and scaling the data layer. The other neighbors require responsibility-level explanation rather than a blanket storage claim.

### glm-5.3-flash

Time: 17.3s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

Semantic coverage is complete: all 132 non-closed recorded roles at Cursor (132 eligible, 132 embedded, 0 unembedded) were ranked, so this search is exhaustive for the openOrUnknown set, not a partial vector slice. All three strongest matches carry recorded status "open"; none of the top three were unconfirmed/unknown-status roles.

The strongest match is **Software Engineer, Storage** (semantic score 0.563). Its own description backs the fit directly: "you'll own the data layer that underpins every product surface: the databases, caches, and the strategy for how teams provision, query, and scale their data stores," including "evolving our storage layer into a partitioned, resilient topology that keeps pace with SpaceXAI's rapid growth" and "owning cache infrastructure end-to-end: reliability, capacity planning." The record lists PostgreSQL and MySQL as skills. Source: https://cursor.com/careers/software-engineer-storage

Running second and third:
- **Engineering Manager, Infrastructure** (0.531, open, posted 2026-04-07): leads the team owning "cloud, networking, storage, and compute," with Kubernetes, PostgreSQL, and ClickHouse skills; [source](https://cursor.com/careers/engineering-manager-infrastructure).
- **Software Engineer, Pretraining** (0.509, open, posted 2026-08-24): builds "large-scale crawling, data platform, and pipeline infrastructure" that turns raw dumps into training-ready datasets; [source](https://cursor.com/careers/software-engineer-pretraining).

Scores are ranking signals, not proof of fit; the relevance evidence above is from the recorded descriptions.

**Tool calls:**
- `queryJobs` `{"companySlugs": ["cursor"], "semanticQuery": "Engineering roles building distributed data infrastructure and large-scale storage systems", "queryScope": "role", "status": "openOrUnknown", "sortBy": "relevance", "limit": 3}`

### deepseek-v4.1-flash

Time: 13.0s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

All three returned roles are recorded as confirmed open (none unconfirmed, none closed), and all are onsite in San Francisco/New York.

Strongest match: Software Engineer, Storage (semantic score 0.56, the top-ranked, posted 2026-06-28, https://cursor.com/careers/software-engineer-storage). The description says you'd "own the data layer that underpins every product surface: the databases, caches, and the strategy for how teams provision, query, and scale their data stores," and lists example projects such as "evolving our storage layer into a partitioned, resilient topology that keeps pace with SpaceXAI's rapid growth," "owning cache infrastructure end-to-end," and defining the "when to use what" strategy for data stores. That is direct storage/distributed-data work.

Second, Engineering Manager, Infrastructure, owns "the foundational cloud, networking, storage, and compute layer," including "data storage systems," Kubernetes/cluster foundations and "geo-deployment architecture," so it is storage-adjacent but a leadership role (https://cursor.com/careers/engineering-manager-infrastructure, posted 2026-04-07). Third, Software Engineer, Pretraining, builds "data systems behind our frontier coding models' initial training," spanning "large-scale crawling, data platform, and pipeline infrastructure" and "internet-scale data," which fits large-scale data infrastructure more than storage (https://cursor.com/careers/software-engineer-pretraining, posted 2026-08-24).

Coverage: semantic coverage is complete for this search. Of 132 jobs eligible under the filters, 132 are embedded (0 unembedded), so all filter-satisfying records were ranked. The 132 figure counts vector-covered candidates satisfying the exact filters, not the number of semantically relevant roles, and hasMoreCandidates is true because more than the three requested roles exist.

**Tool calls:**
- `queryJobs` `{"companySlugs": ["cursor"], "semanticQuery": "Engineering roles building distributed data infrastructure and large-scale storage systems", "queryScope": "role", "status": "openOrUnknown", "sortBy": "relevance", "limit": 3}`

### space-bunny-free

Time: 14.2s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

The strongest match is **Software Engineer, Storage**, which is also the top-ranked result. Its posting states you would "own the data layer that underpins every product surface: the databases, caches, and the strategy for how teams provision, query, and scale their data stores," with example projects including "evolving our storage layer into a partitioned, resilient topology" and "owning cache infrastructure end-to-end: reliability, capacity planning." Recorded skills are PostgreSQL and MySQL. Source: https://cursor.com/careers/software-engineer-storage

The other two:
- **Engineering Manager, Infrastructure** leads "the foundational cloud, networking, storage, and compute layer," including "data storage systems," Kubernetes, and geo-replicated deployment. Skills: AWS, Kubernetes, PostgreSQL, ClickHouse. https://cursor.com/careers/engineering-manager-infrastructure
- **Software Engineer, Pretraining** is the more distant fit; its data teams work on "large-scale crawling, data platform, and pipeline infrastructure" rather than storage systems, so treat it as a neighboring role rather than a direct match. https://cursor.com/careers/software-engineer-pretraining

All three are recorded as status **open** (none came back as unconfirmed), full-time, onsite, in San Francisco, CA and New York, NY except Pretraining, which is San Francisco only. Posted dates range from April 7 to August 24, 2026. No salary bounds are recorded for any of them.

Coverage is complete: all 132 Cursor roles are embedded, with none unembedded. The count of 132 is vector-covered candidates satisfying the exact filters, not a count of semantically relevant roles, and more candidates exist beyond these three, so this is a relevance ranking, not an exhaustive statement that only these roles touch storage.

**Tool calls:**
- `queryJobs` `{"companySlugs": ["cursor"], "semanticQuery": "Engineering roles building distributed data infrastructure and large-scale storage systems", "queryScope": "role", "status": "openOrUnknown", "sortBy": "relevance", "limit": 3}`

### longcat-2.5-preview-free

Time: 41.1s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

All three returned roles are confirmed open (none unconfirmed, none closed), and semantic coverage is complete: all 132 recorded Cursor roles were embedded and ranked (embeddedRecords 132, unembeddedRecords 0, completeCoverage true). The `hasMoreCandidates` flag only reflects the limit of 3, not incomplete coverage.

**Strongest match: Software Engineer, Storage** (semantic score 0.5627, status: open, posted 2026-06-28, San Francisco CA / New York NY, onsite, skills: PostgreSQL, MySQL). The description evidence is direct: "you'll own the data layer that underpins every product surface: the databases, caches, and the strategy for how teams provision, query, and scale their data stores," and "You'll design and execute the path to a robust, multi-database topology built for that growth." Example projects include "evolving our storage layer into a partitioned, resilient topology that keeps pace with SpaceXAI's rapid growth" and "Owning cache infrastructure end-to-end: reliability, capacity planning, and patterns that let product teams move fast without worrying about cache correctness." Source: https://cursor.com/careers/software-engineer-storage

**Engineering Manager, Infrastructure** (score 0.5311, status: open, posted 2026-04-07, San Francisco CA / New York NY, onsite, manager level, skills: AWS, Kubernetes, PostgreSQL, ClickHouse). Description: "you'll lead the team that owns the foundational cloud, networking, storage, and compute layer that every service runs on... data storage systems," including "Designing the geo-deployment architecture: building a replicable, robust process for deploying geo-replicated services across cloud regions and providers." Source: https://cursor.com/careers/engineering-manager-infrastructure

**Software Engineer, Pretraining** (score 0.5088, status: open, posted 2026-08-24, San Francisco CA, onsite). Description: "build the data systems behind our frontier coding models' initial training. You'll work on large-scale crawling, data platform, and pipeline infrastructure, turning raw dumps into the datasets our models train on." Source: https://cursor.com/careers/software-engineer-pretraining

Caveat: semantic scores are ranking signals, not proof of fit; the Pretraining role is adjacent (training data pipelines) rather than core storage infrastructure.

**Tool calls:**
- `queryJobs` `{"companySlugs": ["cursor"], "semanticQuery": "Engineering roles building distributed data infrastructure and large-scale storage systems", "queryScope": "role", "status": "openOrUnknown", "sortBy": "relevance", "limit": 3}`

## Cross-company ranking and scope (`cross-company`)

**Question:** Compare only Exa, Cursor, Baseten and Cohere for distributed storage and large-scale data infrastructure responsibilities. Return the five strongest recorded roles overall, not five per company; include unconfirmed-status roles but exclude closed roles. Use exactly this semantic search intent: "Engineering roles building distributed data infrastructure and large-scale storage systems". Give description evidence, source links, recorded statuses and coverage.

**Expected answer:**

- **Cohere — Software Engineer, Data Infrastructure**; status: unknown; 160,000–325,000 USD/year; location: New York, NY | San Francisco, CA | Canada | United States | Toronto, ON | Montréal, QC. [Source](https://jobs.ashbyhq.com/cohere/6aa3cb2b-ee8b-4c92-b505-3a7509f80d7f)
- **Exa — Software Engineer, Distributed Data Systems**; status: unknown; 180,000–350,000 USD/year; location: San Francisco, CA. [Source](https://jobs.ashbyhq.com/exa/5f10cc28-bcad-4ce4-8fa1-996a59c59e65)
- **Cursor — Software Engineer, Storage**; status: open; location: San Francisco, CA | New York, NY. [Source](https://cursor.com/careers/software-engineer-storage)
- **Cursor — Engineering Manager, Infrastructure**; status: open; location: San Francisco, CA | New York, NY. [Source](https://cursor.com/careers/engineering-manager-infrastructure)
- **Cohere — Data Engineer, Data Foundations**; status: unknown; 160,000–325,000 USD/year; location: New York, NY | Canada | United States. [Source](https://jobs.ashbyhq.com/cohere/9baccd88-c051-474f-bfe8-6867fca54cee)
- Complete current-text coverage: 427/427 eligible records. These are candidates, not proven relevance matches.
- Exa's Distributed Data Systems description covers lakehouse architectures, hundreds-of-petabytes data systems, and pipelines spanning web crawling, training and real-time search. Exa and Cohere statuses in these results are unknown/unconfirmed, not confirmed open.

### glm-5.3-flash

Time: 60.2s. HTTP 200. Automated check: FLAGGED.

**Actual final answer:**

*(No final text)*

**Tool calls:**
- `searchLocus` `{"query": "Exa", "types": ["companies"], "limit": 3}`
- `searchLocus` `{"query": "Cursor", "types": ["companies"], "limit": 3}`
- `searchLocus` `{"query": "Baseten", "types": ["companies"], "limit": 3}`
- `searchLocus` `{"query": "Cohere", "types": ["companies"], "limit": 3}`
- `queryJobs` `{"companySlugs": ["exa", "cursor", "baseten", "cohere"], "semanticQuery": "Engineering roles building distributed data infrastructure and large-scale storage systems", "queryScope": "role", "status": "openOrUnknown", "sortBy": "relevance", "limit": 20}`
- **Review flag:** Transport/stream/tool error
- **Review flag:** No final answer text
- **Review flag:** Returned jobs differ from deterministic oracle (review relevance/order/alternative tools)
- **Review flag:** Requested input differs: limit expected 5, got 20

### deepseek-v4.1-flash

Time: 13.3s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

Five roles ranked by the requested semantic intent across the four companies. Statuses come from the records: the two Cursor roles are **open**; the Cohere and Exa roles are **unknown** (recorded but unconfirmed as currently open, not verified openings).

Evidence from the descriptions:
- **Cohere, Software Engineer, Data Infrastructure** (score 0.650): "The Data Infrastructure team at Cohere is responsible for the storage and data movement layer underlying every model training run. We're building the unified storage layer that feeds our training workloads. It needs to serve petabytes of training data and model checkpoints fast enough to keep thousands of GPUs busy across several training clusters." (https://jobs.ashbyhq.com/cohere/6aa3cb2b-ee8b-4c92-b505-3a7509f80d7f)
- **Exa, Software Engineer, Distributed Data Systems** (0.626): "You'll architect and build the data infrastructure... designing systems that scale to hundreds of petabytes," with "large-scale distributed data processing pipelines" and "lakehouse architectures (Delta Lake, Iceberg, Hudi)." (https://jobs.ashbyhq.com/exa/5f10cc28-bcad-4ce4-8fa1-996a59c59e65)
- **Cursor, Software Engineer, Storage** (0.563): "you'll own the data layer that underpins every product surface: the databases, caches, and the strategy for how teams provision, query, and scale their data stores... the future of our storage architecture is one of the highest-leverage problems at the company." (https://cursor.com/careers/software-engineer-storage)
- **Cursor, Engineering Manager, Infrastructure** (0.531): leads "the foundational cloud, networking, storage, and compute layer," including "data storage systems," Kubernetes/cluster foundations and geo-deployment architecture. (https://cursor.com/careers/engineering-manager-infrastructure)
- **Cohere, Data Engineer, Data Foundations** (0.519): the weakest fit of the five. Despite the title, the excerpt describes Cohere's Analytics & Data Insights team ("tackle the kind of problems that don't have textbook answers yet... help enterprises understand what foundational AI actually means"), not distributed storage. (https://jobs.ashbyhq.com/cohere/9baccd88-c051-474f-bfe8-6867fca54cee)

Coverage and caveats: the ranking ran over 427 vector-covered job records satisfying the exact filters (company in the four slugs, status open or unknown); all 427 were embedded (completeCoverage true, 0 unembedded), so no matching records were hidden from ranking. Scores are ranking signals, not probabilities or proof of fit. Baseten has 101 recorded open/unknown roles but none placed in the top five for this intent. Closed roles were excluded by the status filter.

**Tool calls:**
- `searchLocus` `{"query": "Exa", "types": ["companies"], "limit": 3}`
- `searchLocus` `{"query": "Cursor", "types": ["companies"], "limit": 3}`
- `searchLocus` `{"query": "Baseten", "types": ["companies"], "limit": 3}`
- `searchLocus` `{"query": "Cohere", "types": ["companies"], "limit": 3}`
- `queryJobs` `{"companySlugs": ["exa", "cursor", "baseten", "cohere"], "semanticQuery": "Engineering roles building distributed data infrastructure and large-scale storage systems", "queryScope": "role", "status": "openOrUnknown", "sortBy": "relevance", "limit": 5}`

### space-bunny-free

Time: 43.5s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

Baseten did not place any role in the top five. The strongest recorded matches across the four companies:

**Cohere, Software Engineer, Data Infrastructure** (score 0.65, status unconfirmed, posted 2026-05-14, remote, $160K–$325K). The description says the team "is responsible for the storage and data movement layer underlying every model training run. We're building the unified storage layer that feeds our training workloads. It needs to serve petabytes of training data and model checkpoints fast enough to keep thousands of GPUs busy across several training clusters." Responsibilities include "Design, build, and operate the distributed storage system that feeds model training and evaluation" and running it "on Kubernetes clusters at petabyte scale." Source: https://jobs.ashbyhq.com/cohere/6aa3cb2b-ee8b-4c92-b505-3a7509f80d7f

**Exa, Software Engineer, Distributed Data Systems** (score 0.63, status unconfirmed, posted 2025-12-19, onsite San Francisco, $180K–$350K, visa sponsorship available). The posting says "you'll architect and build the data infrastructure that powers everything we do, from crawling billions of pages to training our embedding models to serving real-time search. You'll have enormous autonomy in designing systems that scale to hundreds of petabytes," and lists "Design a lakehouse architecture that handles 100+ PB of web crawl data" plus streaming pipelines "that process billions of documents per day." Requirements name lakehouse stacks (Delta Lake, Iceberg, Hudi), Kafka/Flink, and Ray/Spark/ClickHouse. Source: https://jobs.ashbyhq.com/exa/5f10cc28-bcad-4ce4-8fa1-996a59c59e65

**Cursor, Software Engineer, Storage** (score 0.56, status open, posted 2026-06-28, onsite SF/NY, no salary recorded). "As a Software Engineer on the Storage team at SpaceXAI, you'll own the data layer that underpins every product surface: the databases, caches, and the strategy for how teams provision, query, and scale their data stores," with projects including "evolving our storage layer into a partitioned, resilient topology" and "owning cache infrastructure end-to-end." Skills recorded: PostgreSQL, MySQL. Source: https://cursor.com/careers/software-engineer-storage

**Cursor, Engineering Manager, Infrastructure** (score 0.53, status open, posted 2026-04-07, onsite SF/NY, no salary recorded). "You'll lead the team that owns the foundational cloud, networking, storage, and compute layer that every service runs on: network foundations, container orchestration, edge and security infrastructure, data storage systems, and the compute runtimes that power production." Skills recorded: AWS, Kubernetes, PostgreSQL, ClickHouse. Source: https://cursor.com/careers/engineering-manager-infrastructure

**Cohere, Data Engineer, Data Foundations** (score 0.52, status unconfirmed, posted 2026-08-14, remote, 5+ years, $160K–$325K). The weakest fit of the five for this intent: the excerpt places it on an "Analytics & Data Insights team" focused on customer implementations and cross-functional analytics rather than storage systems. Source: https://jobs.ashbyhq.com/cohere/9baccd88-c051-474f-bfe8-6867fca54cee

Coverage and caveats:
- Search used your exact semantic intent with queryScope role, status openOrUnknown (closed roles excluded), sorted by relevance across Exa, Cursor, Baseten and Cohere.
- All 427 candidate records were embedded, so coverage is complete for the vector ranking (no unembedded records excluded). These427 are candidates satisfying the exact filters, not 427 relevant roles.
- hasMoreCandidates is true, so the five above are a ranked top slice, not the complete set of qualifying roles.
- The three Cohere and Exa roles are unconfirmed status, meaning the posting is recorded but not verified open. Only the two Cursor roles are confirmed open.
- Salary figures use recorded annual USD minimum and maximum, not offers.
- Remote on the Cohere roles is recorded and does not imply worldwide eligibility; locations are listed on the cards.

**Tool calls:**
- `queryJobs` `{"companySlugs": ["exa", "cursor", "baseten", "cohere"], "semanticQuery": "Engineering roles building distributed data infrastructure and large-scale storage systems", "queryScope": "role", "status": "openOrUnknown", "sortBy": "relevance", "limit": 5}`

### longcat-2.5-preview-free

Time: 60.2s. HTTP 200. Automated check: FLAGGED.

**Actual final answer:**

*(No final text)*

**Tool calls:**
- `searchLocus` `{"query": "Exa", "types": ["companies"], "limit": 3}`
- `searchLocus` `{"query": "Cohere", "types": ["companies"], "limit": 3}`
- `searchLocus` `{"query": "Baseten", "types": ["companies"], "limit": 3}`
- `searchLocus` `{"query": "Cursor", "types": ["companies"], "limit": 3}`
- `queryJobs` `{"companySlugs": ["exa", "cursor", "baseten", "cohere"], "semanticQuery": "Engineering roles building distributed data infrastructure and large-scale storage systems", "queryScope": "role", "status": "openOrUnknown", "sortBy": "relevance", "limit": 5}`
- **Review flag:** Transport/stream/tool error
- **Review flag:** No final answer text

## Global About discovery (`about-semantic`)

**Question:** Across the whole database, which three companies best fit neural web retrieval APIs for AI agents? Use exactly this semantic search intent: "Companies providing neural web retrieval APIs for AI agents". Search company About text, not jobs. Explain the fit with product evidence and sources, and state whether semantic coverage is complete.

**Expected answer:**

- **Tavily**: Tavily provides a real-time search, extraction, crawling, and mapping API purpose-built for AI agents and retrieval-augmented generation, returning structured, LLM-ready results with citations rather than links. Founded in late 2024 by Rotem Weiss, it sells to Fortune 500 enterprises and AI companies from New York and Tel Aviv. Nebius announced an agreement to acquire Tavily in February 2026 to add agentic search to its AI cloud platform; Tavily continues to operate as a brand and is still hiring. [Source](https://tavily.com)
- **Parallel**: Parallel Web Systems builds web infrastructure for AI agents, giving systems programmatic access to the open web through crawling, indexing, ranking, retrieval, and reasoning technologies. The company is building the infrastructure layer for AI systems that need accurate, real-time information from the web. [Source](https://parallel.ai)
- **Context.dev**: Context.dev is a web context API that gives software and AI agents live, structured access to the internet through a single REST API and official SDKs. Founded in 2025 by Yahia Bakour as Brand.dev, the company rebranded in March 2026 to reflect a broader platform that combines scraping and crawling into LLM-ready Markdown, schema-validated structured extraction, web search, brand and company intelligence, people enrichment, and website change monitoring. Backed by Y Combinator's Summer 2026 batch, it reports powering hundreds of companies including Mintlify, daily.dev, Klarna, and Rho, and is SOC 2 Type 1 certified. [Source](https://www.context.dev)
- Complete current-text About coverage: 53/53 companies. Product evidence, not scores alone, determines fit.

### glm-5.3-flash

Time: 6.9s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

All 53 embedded company records in the vector index were ranked (0 unembedded), so semantic coverage is complete across the database's About text; scores are ranking signals, not probabilities.

- **Tavily** (score 0.66) is the tightest match. Its About text says it "provides a real-time search, extraction, crawling, and mapping API purpose-built for AI agents and retrieval-augmented generation, returning structured, LLM-ready results with citations rather than links" ([tavily.com](https://tavily.com)). Its tagline, "Connect your AI agents to the web," names both the agent audience and the web-retrieval product directly.
- **Parallel** (score 0.62) describes itself as "web infrastructure for AI agents, giving systems programmatic access to the open web through crawling, indexing, ranking, retrieval, and reasoning technologies" ([parallel.ai](https://parallel.ai)), explicitly building the infrastructure layer for AI systems needing accurate, real-time web information.
- **Context.dev** (score 0.61) is "a web context API that gives software and AI agents live, structured access to the internet through a single REST API and official SDKs," combining scraping/crawling into LLM-ready Markdown, structured extraction, and web search ([context.dev](https://www.context.dev)).

Caveat: the excerpt for Tavily also notes Nebius agreed to acquire it in February 2026 (it continues operating); Parallel and Context.dev are independent, earlier-stage (Series B and Seed).

**Tool calls:**
- `queryCompanies` `{"semanticQuery": "Companies providing neural web retrieval APIs for AI agents", "sortBy": "relevance", "limit": 3}`

### deepseek-v4.1-flash

Time: 7.9s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

The three closest fits are Tavily, Parallel, and Context.dev, all in the Web Search industry. Semantic coverage was complete for this intent: all 53 eligible records were embedded and ranked, though the returned scores are ranking signals, not proof of relevance, and 53 is the number of vector-covered candidates, not of genuinely matching companies.

- Tavily (score 0.66): "a real-time search, extraction, crawling, and mapping API purpose-built for AI agents and retrieval-augmented generation, returning structured, LLM-ready results with citations rather than links." Source: https://tavily.com
- Parallel (0.62): "web infrastructure for AI agents, giving systems programmatic access to the open web through crawling, indexing, ranking, retrieval, and reasoning technologies." Source: https://parallel.ai
- Context.dev (0.61): "a web context API that gives software and AI agents live, structured access to the internet through a single REST API and official SDKs," combining "scraping and crawling into LLM-ready Markdown, schema-validated structured extraction, web search" and more. Source: https://www.context.dev

Tavily is the most literal match for "retrieval API for agents"; Parallel emphasizes the broader crawling/indexing/ranking infrastructure layer; Context.dev is a single-API web context/retrieval service with agent-focused SDKs.

**Tool calls:**
- `queryCompanies` `{"semanticQuery": "Companies providing neural web retrieval APIs for AI agents", "sortBy": "relevance", "limit": 3}`

### space-bunny-free

Time: 19.8s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

**Semantic coverage is complete**: all 53 database companies are embedded (53 embedded, 0 unembedded), so nothing was excluded from the vector ranking. That 53 is the count of vector-covered candidates with no exact filters applied, not a count of companies that are truly relevant. The top three by relevance were Tavily (0.664), Parallel (0.618), and Context.dev (0.612). Scores are ranking signals, not probabilities.

Fit, from each company's recorded About text:

- **Tavily** — "a real-time search, extraction, crawling, and mapping API purpose-built for AI agents and retrieval-augmented generation, returning structured, LLM-ready results with citations rather than links." Sells to Fortune 500 enterprises and AI companies; New York and Tel Aviv. Founded late 2024 by Rotem Weiss. Source: https://tavily.com
- **Parallel** — "builds web infrastructure for AI agents, giving systems programmatic access to the open web through crawling, indexing, ranking, retrieval, and reasoning technologies," positioning itself as the infrastructure layer for AI systems needing accurate, real-time web information. Source: https://parallel.ai
- **Context.dev** — "a web context API that gives software and AI agents live, structured access to the internet through a single REST API and official SDKs." The recorded entry notes a March 2026 rebrand from Brand.dev into scraping, LLM-ready Markdown, schema-validated extraction, web search, people enrichment, and change monitoring. YC Summer 2026, SOC 2 Type 1. Source: https://www.context.dev

One qualification on the word "neural": none of the three recorded About texts use the term. Exa's does ("its own web-scale index and neural retrieval models to give AI applications high-quality, real-time web search through an API," powering search for Cursor, Cognition, HubSpot, OpenRouter, and Monday.com, valued at $2.2B after its 2026 Series C, source https://exa.ai), but it placed outside the top three under this exact query. If "neural" is a hard requirement rather than a description of intent, Exa is the entry that meets it literally.

**Tool calls:**
- `queryCompanies` `{"semanticQuery": "Companies providing neural web retrieval APIs for AI agents", "sortBy": "relevance", "limit": 3}`
- `searchKnowledge` `{"query": "neural", "limit": 5}`

### longcat-2.5-preview-free

Time: 44.2s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

The three best-fitting companies for neural web retrieval APIs for AI agents, ranked by semantic relevance:

**1. Tavily** (score 0.664)
- **Industry:** Web Search | **Location:** New York, NY | **Stage:** Acquired by Nebius
- **Fit:** Tavily provides a real-time search, extraction, crawling, and mapping API purpose-built for AI agents and retrieval-augmented generation, returning structured, LLM-ready results with citations rather than links. Its tagline is literally "Connect your AI agents to the web."
- **Source:** [tavily.com](https://tavily.com)

**2. Parallel** (score 0.618)
- **Industry:** Web Search | **Location:** Palo Alto, CA | **Stage:** Series B
- **Fit:** Parallel Web Systems builds web infrastructure for AI agents, giving systems programmatic access to the open web through crawling, indexing, ranking, retrieval, and reasoning technologies. It describes itself as "Infrastructure for intelligence on the web."
- **Source:** [parallel.ai](https://parallel.ai)

**3. Context.dev** (score 0.612)
- **Industry:** Web Search | **Location:** San Francisco, CA | **Stage:** Seed
- **Fit:** Context.dev is a web context API that gives software and AI agents live, structured access to the internet through a single REST API and official SDKs. It combines scraping and crawling into LLM-ready Markdown, schema-validated structured extraction, web search, and brand/company intelligence.
- **Source:** [context.dev](https://www.context.dev)

**Semantic coverage:** Complete. All 53 eligible vector-covered records were embedded and ranked (0 unembedded). The search used the voyage/voyage-4-large model over company About text only. Semantic scores are ranking signals, not probabilities; the descriptions above are the substantive evidence.

**Tool calls:**
- `queryCompanies` `{"semanticQuery": "Companies providing neural web retrieval APIs for AI agents", "sortBy": "name", "limit": 3}`
- `queryCompanies` `{"semanticQuery": "Companies providing neural web retrieval APIs for AI agents", "sortBy": "relevance", "limit": 3}`

## No false hiring claims (`exa-confirmed`)

**Question:** How many Exa job records are confirmed open in Locus? Search only confirmed-open records. If none, say so; do not substitute unconfirmed roles or claim Exa is not hiring in the real world.

**Expected answer:**

- **No matching recorded jobs. Do not relax filters or infer real-world hiring status.**

### glm-5.3-flash

Time: 12.0s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

Zero confirmed-open Exa job records appear in Locus (status filter set strictly to "open"; 0 matches as of 2026-10-04). Locus has no record of a currently open Exa role; this says nothing about what Exa is actually hiring in the real world.

**Tool calls:**
- `searchLocus` `{"query": "Exa", "types": ["companies"], "limit": 3}`
- `queryJobs` `{"companySlugs": ["exa"], "queryScope": "role", "status": "open", "sortBy": "relevance", "limit": 50}`

### deepseek-v4.1-flash

Time: 10.9s. HTTP 200. Automated check: FLAGGED.

**Actual final answer:**

Zero. Under a confirmed-open filter (status: open), Locus returns 0 Exa job records.

For context, Locus does hold 52 recorded Exa job records, but every one carries status "unknown" (openOrUnknown; hasMore, so that set is not exhaustive). None is confirmed open, so none qualifies as an answer here.

**Tool calls:**
- `searchLocus` `{"query": "Exa", "types": ["companies"], "limit": 3}`
- `queryJobs` `{"companySlugs": ["exa"], "queryScope": "role", "status": "open", "sortBy": "relevance", "limit": 50}`
- `queryJobs` `{"companySlugs": ["exa"], "queryScope": "role", "status": "openOrUnknown", "sortBy": "relevance", "limit": 50}`
- **Review flag:** Returned jobs differ from deterministic oracle (review relevance/order/alternative tools)
- **Review flag:** Requested input differs: status expected 'open', got 'openOrUnknown'

### space-bunny-free

Time: 17.6s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

Locus records zero confirmed-open job postings for Exa (slug `exa`, Web Search, San Francisco) as of 2026-10-04.

That's the count of postings carrying a confirmed open status, not a statement about Exa's real-world hiring. I did not include any unconfirmed-status records, so if some roles exist in Locus without a verified open status, they're outside this count.

**Tool calls:**
- `searchLocus` `{"query": "Exa", "types": ["companies"], "limit": 5}`
- `queryJobs` `{"companySlugs": ["exa"], "queryScope": "role", "status": "open", "sortBy": "relevance", "limit": 1}`

### longcat-2.5-preview-free

Time: 8.3s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

There are **0 confirmed-open Exa job records** in Locus as of 2026-10-04. This reflects only what is recorded in the database; it does not indicate whether Exa is hiring in the real world.

**Tool calls:**
- `queryJobs` `{"companySlugs": ["exa"], "queryScope": "role", "status": "open", "sortBy": "relevance", "limit": 50}`

## Unknown hiring status (`exa-unconfirmed`)

**Question:** Find Exa's three recorded roles most relevant to distributed storage and data infrastructure. Include unconfirmed-status records and exclude closed records. Use exactly this semantic search intent: "Engineering roles building distributed data infrastructure and large-scale storage systems". Label each hiring status accurately, provide evidence and source links, and don't say an unconfirmed role is open.

**Expected answer:**

- **Exa — Software Engineer, Distributed Data Systems**; status: unknown; 180,000–350,000 USD/year; location: San Francisco, CA. [Source](https://jobs.ashbyhq.com/exa/5f10cc28-bcad-4ce4-8fa1-996a59c59e65)
- **Exa — Software Engineer, Knowledge Systems**; status: unknown; 180,000–350,000 USD/year; location: San Francisco, CA. [Source](https://jobs.ashbyhq.com/exa/1f90ebb9-0f74-4a52-822a-d0ea6acdef4f)
- **Exa — Software Engineer, Backend**; status: unknown; 180,000–350,000 USD/year; location: San Francisco, CA. [Source](https://jobs.ashbyhq.com/exa/41eb773d-9909-422c-b6b8-5bbdc407d318)
- Complete current-text coverage: 52/52 eligible records. These are candidates, not proven relevance matches.
- Exa's Distributed Data Systems description covers lakehouse architectures, hundreds-of-petabytes data systems, and pipelines spanning web crawling, training and real-time search. Exa and Cohere statuses in these results are unknown/unconfirmed, not confirmed open.

### glm-5.3-flash

Time: 32.2s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

The three top-ranked records use the intent exactly as given and rank over all 52 of Exa's embedded openOrUnknown records (complete coverage, unembedded records 0), so nothing was missed by vector ranking. Important status note: **all three are recorded as unknown status, meaning unconfirmed, not verified-open postings.**

Evidence per role, with sources:

- **Software Engineer, Distributed Data Systems** (Engineering, San Francisco): "You'll architect and build the data infrastructure that powers everything we do... designing systems that scale to hundreds of petabytes" and "Design a lakehouse architecture that handles 100+ PB of web crawl data." Source: https://jobs.ashbyhq.com/exa/5f10cc28-bcad-4ce4-8fa1-996a59c59e65
- **Software Engineer, Knowledge Systems** (Engineering, San Francisco): "experience building and maintaining complex distributed backend systems" and "You can build data pipelines that process petabytes of documents, metadata, and unstructured data." Source: https://jobs.ashbyhq.com/exa/1f90ebb9-0f74-4a52-822a-d0ea6acdef4f
- **Software Engineer, Backend** (Engineering, San Francisco): "build data processing pipelines that deal with millions of documents per day" and "Build a custom vector database that runs over a billion vectors in under 100ms." Source: https://jobs.ashbyhq.com/exa/41eb773d-9909-422c-b6b8-5bbdc407d318

Details not on the cards: all three list onsite work in San Francisco, visa sponsorship mentioned in the descriptions (e.g., STEM OPT, H1B, O1, E3), and a recorded salary range of $180,000–$350,000/year. Semantic scores (0.63, 0.48, 0.45) are ranking signals only, not proof of fit. Since none is confirmed open, verify current status directly via the Ashby links before applying.

**Tool calls:**
- `searchLocus` `{"query": "Exa", "types": ["companies"], "limit": 3}`
- `queryJobs` `{"companySlugs": ["exa"], "semanticQuery": "Engineering roles building distributed data infrastructure and large-scale storage systems", "queryScope": "role", "status": "openOrUnknown", "sortBy": "relevance", "limit": 3}`

### deepseek-v4.1-flash

Time: 11.1s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

All three are recorded with status unknown (unconfirmed), not confirmed open. Exa has 52 recorded roles; these are the top ranked for that intent, ranked by semantic relevance (all 52 records were embedded, so the ranking is complete over Exa's records).

1. Software Engineer, Distributed Data Systems (Engineering, San Francisco, onsite, full-time, $180k-$350k, visa sponsorship available) [source](https://jobs.ashbyhq.com/exa/5f10cc28-bcad-4ce4-8fa1-996a59c59e65)
Evidence: "architect and build the data infrastructure that powers everything we do... You'll have enormous autonomy in designing systems that scale to hundreds of petabytes." Requires "Deep understanding of lakehouse architectures (Delta Lake, Iceberg, Hudi)... Experience building and operating large-scale distributed data processing pipelines... streaming data systems (Kafka, Flink, or similar)." Bonus: "Lance or other vector-native storage formats."

2. Software Engineer, Knowledge Systems (Engineering, San Francisco, onsite, full-time, $180k-$350k, visa sponsorship available) [source](https://jobs.ashbyhq.com/exa/1f90ebb9-0f74-4a52-822a-d0ea6acdef4f)
Evidence: "experience building and maintaining complex distributed backend systems... build data pipelines that process petabytes of documents, metadata, and unstructured data... optimizing systems for correctness, reliability, and scale."

3. Software Engineer, Backend (Engineering, San Francisco, onsite, full-time, $180k-$350k, visa sponsorship available) [source](https://jobs.ashbyhq.com/exa/41eb773d-9909-422c-b6b8-5bbdc407d318)
Evidence: "build data processing pipelines that deal with millions of documents per day... Build a custom vector database that runs over a billion vectors in under 100ms."

Semantic scores are ranking signals only, not proof of relevance or open status.

**Tool calls:**
- `searchLocus` `{"query": "Exa", "types": ["companies"], "limit": 3}`
- `queryJobs` `{"companySlugs": ["exa"], "semanticQuery": "Engineering roles building distributed data infrastructure and large-scale storage systems", "queryScope": "role", "status": "openOrUnknown", "sortBy": "relevance", "limit": 3}`

### space-bunny-free

Time: 12.1s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

All three are recorded with status **unknown (unconfirmed), not confirmed open**. Closed postings were excluded.

**Exa has 52 recorded roles** in this search space (open + unconfirmed, vector-covered, complete coverage); the semantic ranking surfaced these three, and more candidates remain beyond the top three.

Evidence for relevance, from each posting's own description:

- **Software Engineer, Distributed Data Systems** (highest semantic score, 0.63): "Design a lakehouse architecture that handles 100+ PB of web crawl data," "Experience building and operating large-scale distributed data processing pipelines," bonus points for "Experience with Lance or other vector-native storage formats." Posted 2025-12-19, onsite San Francisco, $180k–$350k, visa sponsorship recorded as available.
- **Software Engineer, Knowledge Systems** (0.48): "You can build data pipelines that process petabytes of documents, metadata, and unstructured data" and "experience building and maintaining complex distributed backend systems." Posted 2026-06-14.
- **Software Engineer, Backend** (0.45): "Build data processing pipelines that deal with millions of documents per day" and "Build a custom vector database that runs over a billion vectors in under 100ms." Posted 2025-06-26.

All three list "Location: This is an in-person opportunity in San Francisco," so none is remote-eligible. Scores are ranking signals from the model, not proof of fit; the excerpts above are what substantiate the ranking. Apply to each posting directly, since status is unconfirmed.

**Tool calls:**
- `searchLocus` `{"query": "Exa", "types": ["companies"], "limit": 3}`
- `queryJobs` `{"companySlugs": ["exa"], "semanticQuery": "Engineering roles building distributed data infrastructure and large-scale storage systems", "queryScope": "role", "status": "openOrUnknown", "sortBy": "relevance", "limit": 3}`

### longcat-2.5-preview-free

Time: 48.7s. HTTP 200. Automated check: FLAGGED.

**Actual final answer:**

The three most relevant Exa roles for distributed storage and data infrastructure, ranked by semantic relevance across all 52 recorded Exa jobs (complete coverage, no unembedded records):

**1. Software Engineer, Distributed Data Systems** — San Francisco, CA
- **Hiring status: unconfirmed** (recorded as "unknown" in the database; not verified as open)
- **Evidence:** The role is explicitly about data infrastructure at scale: "architect and build the data infrastructure that powers everything we do—from crawling billions of pages to training our embedding models to serving real-time search," with systems "that scale to hundreds of petabytes." Requirements include lakehouse architectures (Delta Lake, Iceberg, Hudi), large-scale distributed data processing pipelines, streaming systems (Kafka, Flink), Ray/Spark/ClickHouse at production scale, and bonus experience with "Lance or other vector-native storage formats."
- **Source:** https://jobs.ashbyhq.com/exa/5f10cc28-bcad-4ce4-8fa1-996a59c59e65

**2. Software Engineer, Knowledge Systems** — San Francisco, CA
- **Hiring status: unconfirmed** (recorded as "unknown"; not verified as open)
- **Evidence:** Builds "complex distributed backend systems" and "data pipelines that process petabytes of documents, metadata, and unstructured data," with work spanning graph traversal, entity resolution, and data quality at scale.
- **Source:** https://jobs.ashbyhq.com/exa/1f90ebb9-0f74-4a52-822a-d0ea6acdef4f

**3. Software Engineer, Backend** — San Francisco, CA
- **Hiring status: unconfirmed** (recorded as "unknown"; not verified as open)
- **Evidence:** Focuses on "high throughput, low latency systems" and "data processing pipelines that deal with millions of documents per day," including building "a custom vector database that runs over a billion vectors in under 100ms."
- **Source:** https://jobs.ashbyhq.com/exa/41eb773d-9909-422c-b6b8-5bbdc407d318

All three roles carry an unconfirmed hiring status in the Locus database, so none should be treated as confirmed open positions. A Singapore-based Backend role and a Web Crawling role also scored in the top tier but were less directly focused on storage and data infrastructure.

**Tool calls:**
- `searchLocus` `{"query": "Exa", "types": ["companies"], "limit": 5}`
- `queryJobs` `{"companySlugs": ["exa"], "semanticQuery": "Engineering roles building distributed data infrastructure and large-scale storage systems", "queryScope": "role", "status": "openOrUnknown", "sortBy": "relevance", "limit": 10}`
- **Review flag:** Returned jobs differ from deterministic oracle (review relevance/order/alternative tools)
- **Review flag:** Requested input differs: limit expected 3, got 10

## Never relax exact constraints (`impossible-filters`)

**Question:** Find confirmed-open roles at Cursor with recorded location containing Mars and a recorded minimum annual USD salary of at least $1,000,000,000. Require both conditions on the same role. If none exist, say none; don't relax location, salary or status.

**Expected answer:**

- **No matching recorded jobs. Do not relax filters or infer real-world hiring status.**

### glm-5.3-flash

Time: 2.7s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

None. No confirmed-open Cursor roles match both conditions (recorded location containing "Mars" and a recorded minimum annual salary of at least $1,000,000,000); the filtered query returned 0 matches with status strictly limited to open.

**Tool calls:**
- `queryJobs` `{"companySlugs": ["cursor"], "queryScope": "role", "location": "Mars", "minimumSalary": 1000000000, "status": "open", "sortBy": "relevance", "limit": 50}`

### deepseek-v4.1-flash

Time: 3.9s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

None. Cursor has no confirmed-open roles that match both conditions on the same posting: location containing "Mars" and a recorded minimum annual USD salary of at least $1,000,000,000 ($1 billion). I did not relax location, salary, or status.

**Tool calls:**
- `queryJobs` `{"companySlugs": ["cursor"], "queryScope": "role", "location": "Mars", "minimumSalary": 1000000000, "status": "open", "sortBy": "relevance", "limit": 50}`

### space-bunny-free

Time: 5.9s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

None. Zero confirmed-open Cursor roles have both a recorded location containing "Mars" and a recorded minimum annual USD salary of $1 billion or more. The filters were applied to the same role, and neither location, salary, nor open status was relaxed.

**Tool calls:**
- `queryJobs` `{"companySlugs": ["cursor"], "queryScope": "role", "location": "Mars", "minimumSalary": 1000000000, "status": "open", "sortBy": "relevance", "limit": 10}`

### longcat-2.5-preview-free

Time: 11.3s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

None. No confirmed-open roles at Cursor have a recorded location containing "Mars" and a recorded minimum annual USD salary of at least $1,000,000,000 on the same role.

**Tool calls:**
- `queryJobs` `{"companySlugs": ["cursor"], "queryScope": "role", "location": "Mars", "minimumSalary": 1000000000, "status": "open", "sortBy": "relevance", "limit": 10}`

## Salary semantics and ranking (`salary-ranking`)

**Question:** Across the database, return the three highest-paying confirmed-open remote jobs with a recorded minimum annual USD salary of at least $200,000, ranked by that minimum salary. Include company, title, location restrictions, salary range, currency, period and source link. Exclude unknown salaries and non-USD or non-annual pay. Don't restrict this to Exa.

**Expected answer:**

- **Anthropic — Research Engineer, Universes**; status: open; 500,000–850,000 USD/year; location: Remote-Friendly (Travel Required) | San Francisco, CA | Seattle, WA | New York, NY. [Source](https://job-boards.greenhouse.io/anthropic/jobs/5061517008)
- **Anthropic — Staff+ Software Engineer, Data Infrastructure**; status: open; 405,000–485,000 USD/year; location: Remote-Friendly (Travel Required) | San Francisco, CA | Seattle, WA | New York, NY. [Source](https://job-boards.greenhouse.io/anthropic/jobs/5114768008)
- **Anthropic — Warehouse and Logistics Capability Manager**; status: open; 405,000–485,000 USD/year; location: San Francisco, CA | New York, NY. [Source](https://job-boards.greenhouse.io/anthropic/jobs/5416696008)
- 77 qualifying jobs across 7 companies; only the top three are requested. Preserve remote-friendly travel restrictions.
- These are recorded salary fields, not independently verified current compensation offers. The third result is not a software role; don't silently replace it with a lower-paying engineering role.

### glm-5.3-flash

Time: 60.2s. HTTP 200. Automated check: FLAGGED.

**Actual final answer:**

*(No final text)*

**Tool calls:**
- **Review flag:** Transport/stream/tool error
- **Review flag:** No final answer text
- **Review flag:** Expected query tool not used; inspect alternative retrieval

### deepseek-v4.1-flash

Time: 7.8s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

77 open remote roles across 7 companies meet the $200k USD annual minimum; here are the top 3 by minimum salary.

- Anthropic, Research Engineer, Universes: $500,000–$850,000 USD/year. Remote-friendly (travel required) plus San Francisco, Seattle, New York. Source: https://job-boards.greenhouse.io/anthropic/jobs/5061517008
- Anthropic, Staff+ Software Engineer, Data Infrastructure: $405,000–$485,000 USD/year. Remote-friendly (travel required) plus San Francisco, Seattle, New York. Source: https://job-boards.greenhouse.io/anthropic/jobs/5114768008
- Anthropic, Warehouse and Logistics Capability Manager: $405,000–$485,000 USD/year. San Francisco or New York. Source: https://job-boards.greenhouse.io/anthropic/jobs/5416696008

Rank 2 and 3 are tied at a $405,000 minimum, and other Anthropic roles may share that same minimum, so the third slot is not uniquely determined. All three list full-time employment, USD, per year. This is a salary-sorted preview (77 matches, hasMore), not the full set.

**Tool calls:**
- `queryJobs` `{"queryScope": "role", "workplaceType": "remote", "minimumSalary": 200000, "status": "open", "sortBy": "salary", "limit": 3}`

### space-bunny-free

Time: 9.3s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

Three highest-ranked of 77 matching roles across 7 companies (Anthropic, Figma, Modal, OpenAI, OpenRouter, Temporal, Vercel). Ranking is by recorded minimum annual USD salary; unknown salaries, non-USD and non-annual pay were excluded by the filter.

1. **Anthropic — Research Engineer, Universes** (AI Research & Engineering)
   $500,000–$850,000 USD/year · Remote-Friendly (Travel Required) | San Francisco, CA | Seattle, WA | New York, NY
   https://job-boards.greenhouse.io/anthropic/jobs/5061517008

2. **Anthropic — Staff+ Software Engineer, Data Infrastructure** (Software Engineering - Infrastructure, 10+ yrs)
   $405,000–$485,000 USD/year · Remote-Friendly (Travel Required) | San Francisco, CA | Seattle, WA | New York, NY
   https://job-boards.greenhouse.io/anthropic/jobs/5114768008

3. **Anthropic — Warehouse and Logistics Capability Manager** (Software Engineering - Infrastructure)
   $405,000–$485,000 USD/year · San Francisco, CA | New York, NY
   https://job-boards.greenhouse.io/anthropic/jobs/5416696008

Caveats:
- All three are US-anchored roles. "Remote-Friendly" here still names specific metro areas and requires travel, so it is not worldwide eligibility.
- The third result's title reads as an operations role carrying the same $405K–$485K band as the infrastructure engineering role, and its listed locations omit the "Remote-Friendly" wording despite a remote workplace type. That inconsistency in the source posting is worth verifying on the employer's board before relying on the number.
- 74 additional matches exist beyond these three.

**Tool calls:**
- `queryJobs` `{"queryScope": "role", "workplaceType": "remote", "minimumSalary": 200000, "status": "open", "sortBy": "salary", "limit": 3}`

### longcat-2.5-preview-free

Time: 19.9s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

Three highest-paying confirmed-open remote jobs with a recorded minimum annual USD salary of at least $200,000, ranked by minimum salary (77 total matches; showing top 3):

1. **Anthropic — Research Engineer, Universes**
   - Location restrictions: Remote-Friendly (Travel Required) | San Francisco, CA | Seattle, WA | New York, NY
   - Salary: $500,000 – $850,000 USD per year
   - Source: https://job-boards.greenhouse.io/anthropic/jobs/5061517008

2. **Anthropic — Staff+ Software Engineer, Data Infrastructure**
   - Location restrictions: Remote-Friendly (Travel Required) | San Francisco, CA | Seattle, WA | New York, NY
   - Salary: $405,000 – $485,000 USD per year
   - Source: https://job-boards.greenhouse.io/anthropic/jobs/5114768008

3. **Anthropic — Warehouse and Logistics Capability Manager**
   - Location restrictions: San Francisco, CA | New York, NY
   - Salary: $405,000 – $485,000 USD per year
   - Source: https://job-boards.greenhouse.io/anthropic/jobs/5416696008

All three are full-time, confirmed open, and recorded as remote with annual USD pay. Note that recorded remote status does not imply worldwide eligibility; the listed location/travel restrictions apply.

**Tool calls:**
- `queryJobs` `{"queryScope": "role", "workplaceType": "remote", "minimumSalary": 200000, "status": "open", "sortBy": "salary", "limit": 3}`

## People facts and page-scope isolation (`founders`)

**Question:** Who are Exa's recorded founders in Locus? List all their names and recorded roles with evidence/source links. Do not answer about OpenAI even though its page is open.

**Expected answer:**

- **Jeff Wang — Co-founder** at Exa. [Source](https://exa.ai/about)
- **Will Bryk — Co-founder & CEO** at Exa. [Source](https://exa.ai/about)

### glm-5.3-flash

Time: 13.3s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

Exa has 2 recorded founders in Locus:

- **Jeff Wang**, Co-founder (profile: https://www.linkedin.com/in/wangzjeff/)
- **Will Bryk**, Co-founder & CEO (profile: https://www.linkedin.com/in/william-bryk/)

Both are sourced from https://exa.ai/about. These are recorded profile fields, not independently verified present-day roles, and Locus's founder records for Exa are complete (2 of 2, no more pages).

**Tool calls:**
- `queryPeople` `{"companySlugs": ["exa"], "isFounder": true, "limit": 10}`
- `findCompanyPeople` `{"slug": "exa", "query": "founder", "limit": 10}`

### deepseek-v4.1-flash

Time: 10.8s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

Locus records exactly two founders for Exa (totalMatches: 2, no more): Jeff Wang, Co-founder, and Will Bryk, Co-founder & CEO. Roles come from recorded profile fields, not independently verified present-day employment.

Sources: both are attributed to Exa's team page, https://exa.ai/about, with LinkedIn profiles at https://www.linkedin.com/in/wangzjeff/ (Wang) and https://www.linkedin.com/in/william-bryk (Bryk).

**Tool calls:**
- `searchLocus` `{"query": "Exa", "types": ["companies"], "limit": 3}`
- `findCompanyPeople` `{"slug": "exa", "query": "founder", "limit": 12}`
- `queryPeople` `{"companySlugs": ["exa"], "isFounder": true, "limit": 50}`

### space-bunny-free

Time: 7.1s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

Locus records 2 founders for Exa (San Francisco, Web Search), both sourced to exa.ai/about: Jeff Wang (Co-founder) and Will Bryk (Co-founder & CEO). That's the complete set recorded, with no additional matches. Roles are recorded profile fields, not independently verified current employment.

**Tool calls:**
- `searchLocus` `{"query": "Exa", "types": ["companies"], "limit": 5}`
- `queryPeople` `{"companySlugs": ["exa"], "isFounder": true, "limit": 20}`

### longcat-2.5-preview-free

Time: 19.7s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

Exa has two recorded founders in Locus:

- **Jeff Wang** — Co-founder. Source: [exa.ai/about](https://exa.ai/about), [LinkedIn profile](https://www.linkedin.com/in/wangzjeff/)
- **Will Bryk** — Co-founder & CEO. Source: [exa.ai/about](https://exa.ai/about), [LinkedIn profile](https://www.linkedin.com/in/william-bryk)

Both are recorded with explicit founder flags at Exa (Web Search, San Francisco, California).

**Tool calls:**
- `searchLocus` `{"query": "Exa", "types": ["companies"], "limit": 3}`
- `queryPeople` `{"companySlugs": ["exa"], "isFounder": true, "limit": 20}`

## Funding dates and round-vs-total (`funding-window`)

**Question:** Which recorded funding rounds for search-industry companies were announced from September 1 through September 30, 2025, inclusive? Return all matching rounds with company, announcement date, round stage, round amount and source link. Distinguish round amounts from total funding. If no rounds match, don't substitute older dates.

**Expected answer:**

- **Exa — Series B**, announced **2025-09-03**, round amount **$85M USD**. [Source](https://exa.ai/blog/announcing-series-b)
- 1 matching recorded round(s); the round amount is not total funding.

### glm-5.3-flash

Time: 8.5s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

One recorded round matches search-industry companies with an announcement date in September 2025 (September 1-30, inclusive):

**Exa** (San Francisco, "Web Search" industry)
- Announced: 2025-09-03
- Stage: Series B
- Round amount: $85M (plus a $700M valuation recorded on the round) — this is the Series B round itself, not the company's total funding
- Lead investor: Benchmark; other investors include Lightspeed Venture Partners, Y Combinator, and NVentures
- Source: [exa.ai/blog/announcing-series-b](https://exa.ai/blog/announcing-series-b)

That is the only layer matching result (totalMatches = 1, hasMore = false), so the preview is exhaustive for this window. No older rounds were substituted.

**Tool calls:**
- `queryFunding` `{"announcedAfter": "2025-09-01", "announcedBefore": "2025-09-30", "industry": "search", "sortBy": "announcedAt", "limit": 50}`

### deepseek-v4.1-flash

Time: 7.5s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

One round in the Locus database matches for search-industry companies in that window.

Exa, Series B, announced 2025-09-03, $85M round amount (this is the round, not Exa's cumulative total funding), at a $700M valuation. Lead investor Benchmark, with Lightspeed Venture Partners, Y Combinator and NVentures participating. Source: https://exa.ai/blog/announcing-series-b

totalMatches is 1 and hasMore is false, so this is the complete set for September 1-30, 2025 inclusive.

**Tool calls:**
- `queryFunding` `{"announcedAfter": "2025-09-01", "announcedBefore": "2025-09-30", "industry": "search", "sortBy": "announcedAt", "limit": 50}`

### space-bunny-free

Time: 17.5s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

One round matches that window.

**Exa** (Web Search, San Francisco) announced a **Series B of $85M on September 3, 2025**, led by Benchmark, with Lightspeed Venture Partners, Y Combinator and NVentures participating. Source: exa.ai/blog/announcing-series-b

That $85M is the round amount for this single round, not a cumulative total. The company card shows name, industry, and location only. The reported $700M valuation came from the same round record; I did not pull Exa's total funding figure, so I can't state it.

**Tool calls:**
- `queryFunding` `{"announcedAfter": "2025-09-01", "announcedBefore": "2025-09-30", "industry": "search", "sortBy": "announcedAt", "limit": 50}`

### longcat-2.5-preview-free

Time: 25.7s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

One recorded funding round for a search-industry company was announced in September 2025 (September 1-30, inclusive), and it is the complete set (no additional matches):

**Exa** (Web Search, San Francisco, California)
- Announcement date: 2025-09-03
- Round stage: Series B
- Round amount: $85M USD
- Lead investor: Benchmark; participating investors: Lightspeed Venture Partners, Y Combinator, NVentures
- Valuation at the round: $700M
- Source: https://exa.ai/blog/announcing-series-b

Round amount vs. total funding: the $85M is only the Series B round amount, not Exa's total funding. Exa's recorded total funding is $357M, which also includes a $17M Series A (2024-07-16), a $5M Seed round, and a later $250M Series C announced 2026-05-20.

**Tool calls:**
- `queryFunding` `{"announcedAfter": "2025-09-01", "announcedBefore": "2025-09-30", "industry": "search", "sortBy": "announcedAt", "limit": 50}`
- `getCompanyProfile` `{"slug": "exa", "section": "funding"}`
