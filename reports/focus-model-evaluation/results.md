# Focus three-model production evaluation

**Reviewed scores and findings:** [review.md](review.md).
Endpoint: `https://locusaz.vercel.app/api/chat`. Nine fresh-session questions per model, 27 requests total. The API serves the site's Focus chat, including inline-card data; browser rendering was not tested.

Expected answers: [questions-and-answers.md](questions-and-answers.md). Full machine-readable evidence: [results.json](results.json). Raw SSE and request payloads are retained locally in `.cache/focus-model-evaluation/`.

## Automated checks (not a final quality score)

These compare transport, tool inputs, returned records and cache/coverage to the deterministic oracle. Flags may be legitimate alternative retrieval or evidence-based ordering, so they require review. A clean check alone does not prove narrative accuracy.

| Model | Clean checks | Flagged | Median seconds | Max seconds |
| --- | ---: | ---: | ---: | ---: |
| gpt-6-luna | 9/9 | 0 | 7.4 | 11.8 |
| muse-spark-1.3-contributor | 9/9 | 0 | 9.9 | 23.1 |
| mimo-v2.6-flash | 8/9 | 1 | 15.6 | 60.2 |

## Semantic job relevance (`cursor-semantic`)

**Question:** At Cursor, return the three recorded roles most relevant to distributed storage and large-scale data infrastructure, including unconfirmed-status roles but not closed roles. Use exactly this semantic search intent: "Engineering roles building distributed data infrastructure and large-scale storage systems". Explain the strongest match with description evidence, give source links and recorded hiring status, and say whether semantic coverage is complete.

**Expected answer:**

- **Cursor — Software Engineer, Storage**; status: open; location: San Francisco, CA | New York, NY. [Source](https://cursor.com/careers/software-engineer-storage)
- **Cursor — Engineering Manager, Infrastructure**; status: open; location: San Francisco, CA | New York, NY. [Source](https://cursor.com/careers/engineering-manager-infrastructure)
- **Cursor — Software Engineer, Pretraining**; status: open; location: San Francisco, CA. [Source](https://cursor.com/careers/software-engineer-pretraining)
- Complete current-text coverage: 132/132 eligible records. These are candidates, not proven relevance matches.
- Storage is the strongest direct fit: its description covers owning databases/caches, a resilient partitioned multi-database topology, and scaling the data layer. The other neighbors require responsibility-level explanation rather than a blanket storage claim.

### gpt-6-luna

Time: 8.3s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

The strongest match is **Software Engineer, Storage**. Its description says the role owns the databases, caches, and data-store scaling strategy, including a partitioned, resilient data topology and end-to-end cache infrastructure. [Source](https://cursor.com/careers/software-engineer-storage)

The three returned roles all have recorded status **open**:
- **Engineering Manager, Infrastructure**: description covers foundational storage systems and geo-replicated services. [Source](https://cursor.com/careers/engineering-manager-infrastructure)
- **Software Engineer, Pretraining**: description covers large-scale crawling, data platforms, and pipelines for training datasets. [Source](https://cursor.com/careers/software-engineer-pretraining)

Semantic coverage is **complete**: all 132 eligible recorded roles were embedded and ranked.

**Tool calls:**
- `queryJobs` `{"companySlugs": ["cursor"], "semanticQuery": "Engineering roles building distributed data infrastructure and large-scale storage systems", "queryScope": "role", "status": "openOrUnknown", "sortBy": "relevance", "limit": 3}`

### muse-spark-1.3-contributor

Time: 9.9s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

Strongest match is **Software Engineer, Storage** with semantic score 0.5626.

Description evidence for relevance to distributed storage:

> "you'll own the data layer that underpins every product surface: the databases, caches, and the strategy for how teams provision, query, and scale their data stores."
> "Designing the next-generation data architecture: evolving our storage layer into a partitioned, resilient topology that keeps pace with SpaceXAI's rapid growth."

Source links and recorded hiring status (filter was `openOrUnknown`, closed excluded):

1. Software Engineer, Storage - status: open - https://cursor.com/careers/software-engineer-storage
2. Engineering Manager, Infrastructure - status: open - https://cursor.com/careers/engineering-manager-infrastructure
3. Software Engineer, Pretraining - status: open - https://cursor.com/careers/software-engineer-pretraining

Semantic coverage is complete: 132 eligible records at Cursor, 132 embedded, 0 unembedded. Counts are vector-covered candidates satisfying exact filters, not proven semantic matches. Scores are ranking signals only.

**Tool calls:**
- `queryJobs` `{"companySlugs": ["cursor"], "semanticQuery": "Engineering roles building distributed data infrastructure and large-scale storage systems", "queryScope": "role", "status": "openOrUnknown", "sortBy": "relevance", "limit": 3}`

### mimo-v2.6-flash

Time: 18.0s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

The three highest-ranked Cursor roles for that intent are shown above. All three carry a recorded hiring status of **open** (not merely unconfirmed), and none are closed.

**Strongest match: Software Engineer, Storage** ([job posting](https://cursor.com/careers/software-engineer-storage)). Its description directly covers large-scale storage and data infrastructure: you would "own the data layer that underpins every product surface: the databases, caches, and the strategy for how teams provision, query, and scale their data stores," with example projects including "designing the next-generation data architecture: evolving our storage layer into a partitioned, resilient topology" and "owning cache infrastructure end-to-end." The posting frames this as one of the highest-leverage problems at the company, given millions of daily developers.

The other two, with their recorded posting links:

- **Engineering Manager, Infrastructure** ([posting](https://cursor.com/careers/engineering-manager-infrastructure)) owns "the foundational cloud, networking, storage, and compute layer," including data storage systems and geo-replicated service deployment.
- **Software Engineer, Pretraining** ([posting](https://cursor.com/careers/software-engineer-pretraining)) builds "large-scale crawling, data platform, and pipeline infrastructure" for frontier-model training data.

**Semantic coverage is complete for this query:** all 132 Cursor job records eligible under the `openOrUnknown` status filter were embedded and ranked (0 unembedded), so no records were hidden from vector ranking. Note that the counts reflect vector-covered candidates satisfying the exact filters, and scores are ranking signals rather than proof of fit; the match judgments above come from the quoted description excerpts. Results are a top-3 preview of those ranked candidates (132 candidates total, more available).

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

### gpt-6-luna

Time: 11.2s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

The five highest-ranked eligible roles from Exa, Cursor, Baseten, and Cohere are shown in the result cards. Status and supporting description evidence:

- **Cohere, Software Engineer, Data Infrastructure**: The description says the team is building a unified storage layer to serve petabytes of training data and checkpoints, and calls for designing and operating distributed storage across Kubernetes clusters. **Status: unknown (unconfirmed).** [Source](https://jobs.ashbyhq.com/cohere/6aa3cb2b-ee8b-4c92-b505-3a7509f80d7f)
- **Exa, Software Engineer, Distributed Data Systems**: The description cites large-scale distributed data-processing pipelines, streaming systems, and a lakehouse architecture for 100+ PB of web-crawl data. **Status: unknown (unconfirmed).** [Source](https://jobs.ashbyhq.com/exa/5f10cc28-bcad-4ce4-8fa1-996a59c59e65)
- **Cursor, Software Engineer, Storage**: The description covers a partitioned, resilient storage topology, databases and caches, and scaling data stores. **Status: open.** [Source](https://cursor.com/careers/software-engineer-storage)
- **Cursor, Engineering Manager, Infrastructure**: The description includes ownership of the foundational storage layer and data-storage systems. **Status: open.** [Source](https://cursor.com/careers/engineering-manager-infrastructure)
- **Cohere, Data Engineer, Data Foundations**: The returned description focuses on customer experiences and cross-functional analytics work; it provides little direct evidence of distributed storage or large-scale data infrastructure. **Status: unknown (unconfirmed).** [Source](https://jobs.ashbyhq.com/cohere/9baccd88-c051-474f-bfe8-6867fca54cee)

Coverage: all **427** eligible recorded roles in the semantic search set were embedded and ranked; coverage is complete. That is the candidate pool, not a count of semantically relevant matches. No Baseten role appeared in the five highest-ranked results.

**Tool calls:**
- `queryJobs` `{"companySlugs": ["exa", "cursor", "baseten", "cohere"], "semanticQuery": "Engineering roles building distributed data infrastructure and large-scale storage systems", "queryScope": "allContent", "status": "openOrUnknown", "sortBy": "relevance", "limit": 5}`

### muse-spark-1.3-contributor

Time: 23.1s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

I'll resolve the four company profiles to compare their data infrastructure roles.Ranking distributed storage roles at those four companies.Five strongest overall for the exact intent "Engineering roles building distributed data infrastructure and large-scale storage systems", ranked across Exa, Cursor, Baseten and Cohere. Status openOrUnknown only, closed excluded.

Coverage: semantic mode, 427 vector-covered candidates satisfying exact filters across all 4 companies. Baseten 101, Cohere 142, Cursor 132, Exa 52. Embedded 427 of 427, completeCoverage true. Scores are ranking signals only, not probabilities. hasMoreCandidates true, so lower ranked candidates exist beyond these five. Baseten had candidates but none ranked in overall top five.

1. Cohere, Software Engineer, Data Infrastructure. Recorded status unknown, treat as unconfirmed, not confirmed open. Score 0.6502. Location New York, NY / San Francisco, CA / Canada / United States / Toronto, ON / Montreal, QC. Remote. Source: https://jobs.ashbyhq.com/cohere/6aa3cb2b-ee8b-4c92-b505-3a7509f80d7f
Evidence: "Data Infrastructure team at Cohere is responsible for the storage and data movement layer underlying every model training run" and "building the unified storage layer that feeds our training workloads" plus "Design, build, and operate the distributed storage system that feeds model training and evaluation" and "Run this system multiple on Kubernetes clusters at petabyte scale."

2. Exa, Software Engineer, Distributed Data Systems. Recorded status unknown, unconfirmed. Score 0.6255. Location San Francisco, CA. Onsite. Source: https://jobs.ashbyhq.com/exa/5f10cc28-bcad-4ce4-8fa1-996a59c59e65
Evidence: "architect and build the data infrastructure that powers everything we do, from crawling billions of pages to training our embedding models to serving real-time search" plus "designing systems that scale to hundreds of petabytes" and "Experience building and operating large-scale distributed data processing pipelines" and "Design a lakehouse architecture that handles 100+ PB of web crawl data."

3. Cursor, Software Engineer, Storage. Recorded status open. Score 0.5626. Location San Francisco, CA / New York, NY. Onsite. Source: https://cursor.com/careers/software-engineer-storage
Evidence: "own the data layer that underpins every product surface: the databases, caches, and the strategy for how teams provision, query, and scale their data stores" plus "Designing the next-generation data architecture: evolving our storage layer into a partitioned, resilient topology" and "Owning cache infrastructure end to end."

4. Cursor, Engineering Manager, Infrastructure. Recorded status open. Score 0.5311. Location San Francisco, CA / New York, NY. Onsite. Source: https://cursor.com/careers/engineering-manager-infrastructure
Evidence: "lead the team that owns the foundational cloud, networking, storage, and compute layer that every service runs on" including "data storage systems" plus "Owning Kubernetes and cluster foundations" and "Designing the geo-deployment architecture: building a replicable, robust process for deploying geo-replicated services."

5. Cohere, Data Engineer, Data Foundations. Recorded status unknown, unconfirmed. Score 0.5188. Location New York, NY / Canada / United States. Remote. Source: https://jobs.ashbyhq.com/cohere/9baccd88-c051-474f-bfe8-6867fca54cee
Evidence weaker on storage: "We're building the foundational infrastructure that will define how the world thinks about and deploys AI" plus "As a Data Engineer, you will" focus on "new customer experiences built on one of the most advanced AI systems." No petabyte scale or distributed storage language in the returned excerpt, so fit is weaker than ranks 1 to 4 for this intent.


**Tool calls:**
- `searchLocus` `{"query": "Exa Cursor Baseten Cohere", "types": ["companies"], "limit": 12}`
- `searchLocus` `{"query": "Exa", "types": ["companies"], "limit": 3}`
- `searchLocus` `{"query": "Cursor", "types": ["companies"], "limit": 3}`
- `searchLocus` `{"query": "Cohere", "types": ["companies"], "limit": 3}`
- `searchLocus` `{"query": "Baseten", "types": ["companies"], "limit": 3}`
- `queryJobs` `{"companySlugs": ["exa", "cursor", "baseten", "cohere"], "semanticQuery": "Engineering roles building distributed data infrastructure and large-scale storage systems", "queryScope": "role", "status": "openOrUnknown", "sortBy": "relevance", "limit": 5}`

### mimo-v2.6-flash

Time: 60.2s. HTTP 200. Automated check: FLAGGED.

**Actual final answer:**

*(No final text)*

**Tool calls:**
- `searchLocus` `{"query": "Exa", "types": ["companies"], "limit": 3}`
- `searchLocus` `{"query": "Baseten", "types": ["companies"], "limit": 3}`
- `searchLocus` `{"query": "Cursor", "types": ["companies"], "limit": 3}`
- `searchLocus` `{"query": "Cohere", "types": ["companies"], "limit": 3}`
- `queryJobs` `{"companySlugs": ["exa", "cursor", "baseten", "cohere"], "semanticQuery": "Engineering roles building distributed data infrastructure and large-scale storage systems", "queryScope": "role", "status": "openOrUnknown", "sortBy": "relevance", "limit": 50}`
- **Review flag:** Transport/stream/tool error
- **Review flag:** No final answer text
- **Review flag:** Returned jobs differ from deterministic oracle (review relevance/order/alternative tools)
- **Review flag:** Requested input differs: limit expected 5, got 50

## Global About discovery (`about-semantic`)

**Question:** Across the whole database, which three companies best fit neural web retrieval APIs for AI agents? Use exactly this semantic search intent: "Companies providing neural web retrieval APIs for AI agents". Search company About text, not jobs. Explain the fit with product evidence and sources, and state whether semantic coverage is complete.

**Expected answer:**

- **Tavily**: Tavily provides a real-time search, extraction, crawling, and mapping API purpose-built for AI agents and retrieval-augmented generation, returning structured, LLM-ready results with citations rather than links. Founded in late 2024 by Rotem Weiss, it sells to Fortune 500 enterprises and AI companies from New York and Tel Aviv. Nebius announced an agreement to acquire Tavily in February 2026 to add agentic search to its AI cloud platform; Tavily continues to operate as a brand and is still hiring. [Source](https://tavily.com)
- **Parallel**: Parallel Web Systems builds web infrastructure for AI agents, giving systems programmatic access to the open web through crawling, indexing, ranking, retrieval, and reasoning technologies. The company is building the infrastructure layer for AI systems that need accurate, real-time information from the web. [Source](https://parallel.ai)
- **Context.dev**: Context.dev is a web context API that gives software and AI agents live, structured access to the internet through a single REST API and official SDKs. Founded in 2025 by Yahia Bakour as Brand.dev, the company rebranded in March 2026 to reflect a broader platform that combines scraping and crawling into LLM-ready Markdown, schema-validated structured extraction, web search, brand and company intelligence, people enrichment, and website change monitoring. Backed by Y Combinator's Summer 2026 batch, it reports powering hundreds of companies including Mintlify, daily.dev, Klarna, and Rho, and is SOC 2 Type 1 certified. [Source](https://www.context.dev)
- Complete current-text About coverage: 53/53 companies. Product evidence, not scores alone, determines fit.

### gpt-6-luna

Time: 7.4s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

- **Tavily**: Its description says it provides real-time search, extraction, crawling, and mapping APIs purpose-built for AI agents, with structured, LLM-ready results and citations. [Source](https://tavily.com)
- **Parallel**: It builds web infrastructure for AI agents, including crawling, indexing, ranking, retrieval, and reasoning for real-time web information access. [Source](https://parallel.ai)
- **Context.dev**: Its web context API gives AI agents live, structured internet access through one REST API, including web search, crawling, and structured extraction. [Source](https://www.context.dev)

Semantic coverage is complete: all 53 eligible company records were embedded and ranked. These are the top three results, not a claim that only three companies are relevant.

**Tool calls:**
- `queryCompanies` `{"semanticQuery": "Companies providing neural web retrieval APIs for AI agents", "sortBy": "relevance", "limit": 3}`

### muse-spark-1.3-contributor

Time: 14.9s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

Top semantic matches identified. Gathering product evidence to explain each fit.Best fits for "Companies providing neural web retrieval APIs for AI agents", ranked by About-text semantic relevance:

**1. Tavily** (score 0.66)
Fit: "provides a real-time search, extraction, crawling, and mapping API purpose-built for AI agents and retrieval-augmented generation, returning structured, LLM-ready results with citations rather than links."
Source: https://tavily.com

**2. Parallel** (score 0.62)
Fit: "builds web infrastructure for AI agents, giving systems programmatic access to the open web through crawling, indexing, ranking, retrieval, and reasoning technologies."
Source: https://parallel.ai

**3. Context.dev** (score 0.61)
Fit: "web context API that gives software and AI agents live, structured access to the internet through a single REST API and official SDKs" combining "scraping and crawling into LLM-ready Markdown, schema-validated structured extraction, web search."
Source: https://www.context.dev

Coverage: complete. Semantic retrieval ranked 53 eligible records, with 53 embedded and 0 unembedded (completeCoverage: true). Counts are vector-covered candidates, not proven matches, and scores are ranking signals only. 53 total candidates with more beyond these top 3.

**Tool calls:**
- `queryCompanies` `{"semanticQuery": "Companies providing neural web retrieval APIs for AI agents", "sortBy": "relevance", "limit": 3}`
- `getCompanyProfile` `{"slug": "tavily", "section": "overview"}`
- `getCompanyProfile` `{"slug": "context-dev", "section": "overview"}`
- `getCompanyProfile` `{"slug": "parallel", "section": "overview"}`

### mimo-v2.6-flash

Time: 15.3s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

Top three matches from semantic ranking over company About text (query: "Companies providing neural web retrieval APIs for AI agents"):

- **Tavily** (score 0.664) — the strongest fit: its About text describes "a real-time search, extraction, crawling, and mapping API purpose-built for AI agents and retrieval-augmented generation, returning structured, LLM-ready results with citations rather than links." That is a neural retrieval API explicitly aimed at agents. Source: [tavily.com](https://tavily.com). Note: Nebius announced an agreement to acquire it in February 2026; it operates as a brand and is still hiring.
- **Parallel** (score 0.618) — described as building "web infrastructure for AI agents, giving systems programmatic access to the open web through crawling, indexing, ranking, retrieval, and reasoning technologies," i.e., the infrastructure layer for AI systems needing real-time web information. Source: [parallel.ai](https://parallel.ai).
- **Context.dev** (score 0.612) — "a web context API that gives software and AI agents live, structured access to the internet through a single REST API," combining scraping, crawling, web search, and LLM-ready Markdown output. Source: [context.dev](https://www.context.dev).

**Semantic coverage:** complete. 53 of 53 company records were embedded and ranked, with 0 unembedded records, so this ranking spans the full database rather than a partial subset. Scores are ranking signals, not proof of relevance; the fit claims above come from each company's description excerpt.

**Tool calls:**
- `queryCompanies` `{"semanticQuery": "Companies providing neural web retrieval APIs for AI agents", "sortBy": "relevance", "limit": 3}`

## No false hiring claims (`exa-confirmed`)

**Question:** How many Exa job records are confirmed open in Locus? Search only confirmed-open records. If none, say so; do not substitute unconfirmed roles or claim Exa is not hiring in the real world.

**Expected answer:**

- **No matching recorded jobs. Do not relax filters or infer real-world hiring status.**

### gpt-6-luna

Time: 6.0s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

Locus has **0 confirmed-open Exa job records**. This does not establish whether Exa is hiring outside Locus.

**Tool calls:**
- `queryJobs` `{"companySlugs": ["exa"], "queryScope": "role", "status": "open", "sortBy": "relevance", "limit": 50}`

### muse-spark-1.3-contributor

Time: 8.8s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

I'll pull Exa's confirmed-open job count from Locus.Locus contains 0 confirmed-open job records for Exa.

**Tool calls:**
- `searchLocus` `{"query": "Exa", "types": ["companies"], "limit": 3}`
- `queryJobs` `{"companySlugs": ["exa"], "queryScope": "role", "status": "open", "sortBy": "relevance", "limit": 50}`

### mimo-v2.6-flash

Time: 11.4s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

No confirmed-open Exa job records exist in Locus as of 2026-10-04: the confirmed-open search returned 0 matching records. This reflects only what's recorded in Locus (with confirmed status), not a claim about real-world hiring; unconfirmed roles were not substituted.

**Tool calls:**
- `searchLocus` `{"query": "Exa", "types": ["companies"], "limit": 3}`
- `queryJobs` `{"companySlugs": ["exa"], "queryScope": "role", "status": "open", "sortBy": "relevance", "limit": 50}`

## Unknown hiring status (`exa-unconfirmed`)

**Question:** Find Exa's three recorded roles most relevant to distributed storage and data infrastructure. Include unconfirmed-status records and exclude closed records. Use exactly this semantic search intent: "Engineering roles building distributed data infrastructure and large-scale storage systems". Label each hiring status accurately, provide evidence and source links, and don't say an unconfirmed role is open.

**Expected answer:**

- **Exa — Software Engineer, Distributed Data Systems**; status: unknown; 180,000–350,000 USD/year; location: San Francisco, CA. [Source](https://jobs.ashbyhq.com/exa/5f10cc28-bcad-4ce4-8fa1-996a59c59e65)
- **Exa — Software Engineer, Knowledge Systems**; status: unknown; 180,000–350,000 USD/year; location: San Francisco, CA. [Source](https://jobs.ashbyhq.com/exa/1f90ebb9-0f74-4a52-822a-d0ea6acdef4f)
- **Exa — Software Engineer, Backend**; status: unknown; 180,000–350,000 USD/year; location: San Francisco, CA. [Source](https://jobs.ashbyhq.com/exa/41eb773d-9909-422c-b6b8-5bbdc407d318)
- Complete current-text coverage: 52/52 eligible records. These are candidates, not proven relevance matches.
- Exa's Distributed Data Systems description covers lakehouse architectures, hundreds-of-petabytes data systems, and pipelines spanning web crawling, training and real-time search. Exa and Cohere statuses in these results are unknown/unconfirmed, not confirmed open.

### gpt-6-luna

Time: 5.6s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

All three records have **unconfirmed status** in Locus. The database does not confirm them as open; closed records were excluded.

- **Software Engineer, Distributed Data Systems:** The description discusses building data infrastructure for web crawling, model training, and real-time search, including systems scaling to hundreds of petabytes. [Job source](https://jobs.ashbyhq.com/exa/5f10cc28-bcad-4ce4-8fa1-996a59c59e65)
- **Software Engineer, Knowledge Systems:** The description calls for experience with complex distributed backend systems and data pipelines processing petabytes of documents. [Job source](https://jobs.ashbyhq.com/exa/1f90ebb9-0f74-4a52-822a-d0ea6acdef4f)
- **Software Engineer, Backend:** The description mentions high-throughput, low-latency systems, large-scale data pipelines, and building a custom vector database. [Job source](https://jobs.ashbyhq.com/exa/41eb773d-9909-422c-b6b8-5bbdc407d318)

**Tool calls:**
- `queryJobs` `{"companySlugs": ["exa"], "semanticQuery": "Engineering roles building distributed data infrastructure and large-scale storage systems", "queryScope": "role", "status": "openOrUnknown", "sortBy": "relevance", "limit": 3}`

### muse-spark-1.3-contributor

Time: 13.9s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

I'll run a semantic search for Exa's infrastructure roles using your exact criteria.Ranked using semantic intent: "Engineering roles building distributed data infrastructure and large-scale storage systems"

Filter: Exa only, status `openOrUnknown`, closed records excluded. Ranked 52 vector-covered candidates satisfying exact filters with complete coverage. Scores are ranking signals only, not proof of relevance.

1. **Software Engineer, Distributed Data Systems** - San Francisco, CA
Hiring status: unconfirmed, recorded status: unknown. Not confirmed open.
Evidence: "architect and build the data infrastructure that powers everything we do, from crawling billions of pages to training our embedding models" and "designing systems that scale to hundreds of petabytes" and "Design a lakehouse architecture that handles 100+ PB of web crawl data"
Semantic score: 0.6255
Source: https://jobs.ashbyhq.com/exa/5f10cc28-bcad-4ce4-8fa1-996a59c59e65

2. **Software Engineer, Knowledge Systems** - San Francisco, CA
Hiring status: unconfirmed, recorded status: unknown. Not confirmed open.
Evidence: "You have experience building and maintaining complex distributed backend systems" and "You can build data pipelines that process petabytes of documents, metadata, and unstructured data"
Semantic score: 0.4831
Source: https://jobs.ashbyhq.com/exa/1f90ebb9-0f74-4a52-822a-d0ea6acdef4f

3. **Software Engineer, Backend** - San Francisco, CA
Hiring status: unconfirmed, recorded status: unknown. Not confirmed open.
Evidence: "design super high performant vector databases to retrieve over it" and "Build a custom vector database that runs over a billion vectors in under 100ms" and "You can build data processing pipelines that deal with millions of documents per day"
Semantic score: 0.4520
Source: https://jobs.ashbyhq.com/exa/41eb773d-9909-422c-b6b8-5bbdc407d318


**Tool calls:**
- `searchLocus` `{"query": "Exa", "types": ["companies"], "limit": 3}`
- `queryJobs` `{"companySlugs": ["exa"], "semanticQuery": "Engineering roles building distributed data infrastructure and large-scale storage systems", "queryScope": "role", "status": "openOrUnknown", "sortBy": "relevance", "limit": 3}`

### mimo-v2.6-flash

Time: 21.4s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

All three top-ranked Exa records under that exact intent have **unconfirmed status** (recorded as "unknown", not verified open); closed records were excluded via the open-or-unknown filter. Ranking covered all 52 eligible Exa records (complete coverage).

1. **Software Engineer, Distributed Data Systems** (Engineering, San Francisco, onsite) — status: **unconfirmed**. Evidence: seeks "Deep understanding of lakehouse architectures (Delta Lake, Iceberg, Hudi)" and "building and operating large-scale distributed data processing pipelines," with a project to "Design a lakehouse architecture that handles 100+ PB of web crawl data." Posted 2025-12-19. [Source](https://jobs.ashbyhq.com/exa/5f10cc28-bcad-4ce4-8fa1-996a59c59e65)

2. **Software Engineer, Knowledge Systems** (Engineering, San Francisco, onsite) — status: **unconfirmed**. Evidence: "experience building and maintaining complex distributed backend systems" and "data pipelines that process petabytes of documents, metadata, and unstructured data." Posted 2026-06-14. [Source](https://jobs.ashbyhq.com/exa/1f90ebb9-0f74-4a52-822a-d0ea6acdef4f)

3. **Software Engineer, Backend** (Engineering, San Francisco, onsite) — status: **unconfirmed**. Evidence: "high throughput, low latency systems" and "data processing pipelines that deal with millions of documents per day," including a project to "Build a custom vector database that runs over a billion vectors in under 100ms." Posted 2025-06-26. [Source](https://jobs.ashbyhq.com/exa/41eb773d-9909-422c-b6b8-5bbdc407d318)

These statuses reflect what Locus has recorded as of 2026-10-04; an unconfirmed record may since have been filled or closed at the source.

**Tool calls:**
- `searchLocus` `{"query": "Exa", "types": ["companies"], "limit": 3}`
- `queryJobs` `{"companySlugs": ["exa"], "semanticQuery": "Engineering roles building distributed data infrastructure and large-scale storage systems", "queryScope": "role", "status": "openOrUnknown", "sortBy": "relevance", "limit": 3}`

## Never relax exact constraints (`impossible-filters`)

**Question:** Find confirmed-open roles at Cursor with recorded location containing Mars and a recorded minimum annual USD salary of at least $1,000,000,000. Require both conditions on the same role. If none exist, say none; don't relax location, salary or status.

**Expected answer:**

- **No matching recorded jobs. Do not relax filters or infer real-world hiring status.**

### gpt-6-luna

Time: 4.4s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

None. No confirmed-open Cursor role has both a recorded location containing “Mars” and a recorded minimum annual USD salary of at least $1,000,000,000.

**Tool calls:**
- `queryJobs` `{"companySlugs": ["cursor"], "queryScope": "role", "location": "Mars", "minimumSalary": 1000000000, "status": "open", "sortBy": "relevance", "limit": 50}`

### muse-spark-1.3-contributor

Time: 6.8s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

None. No confirmed-open roles at Cursor have both a recorded location containing Mars and a recorded minimum annual USD salary of at least $1,000,000,000.

**Tool calls:**
- `queryJobs` `{"companySlugs": ["cursor"], "queryScope": "role", "location": "Mars", "minimumSalary": 1000000000, "status": "open", "sortBy": "relevance", "limit": 10}`

### mimo-v2.6-flash

Time: 8.2s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

None. No confirmed-open Cursor role matches both conditions: a recorded location containing "Mars" and a recorded minimum annual USD salary of at least $1,000,000,000.

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

### gpt-6-luna

Time: 8.8s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

Salary details for the three highest minimums (all recorded as annual USD):

- Research Engineer, Universes: **$500,000–$850,000 USD/year**. [Source](https://job-boards.greenhouse.io/anthropic/jobs/5061517008)
- Staff+ Software Engineer, Data Infrastructure: **$405,000–$485,000 USD/year**. [Source](https://job-boards.greenhouse.io/anthropic/jobs/5114768008)
- Warehouse and Logistics Capability Manager: **$405,000–$485,000 USD/year**. [Source](https://job-boards.greenhouse.io/anthropic/jobs/5416696008)

The locations and remote/travel restrictions are shown on the job cards.

**Tool calls:**
- `queryJobs` `{"queryScope": "role", "workplaceType": "remote", "minimumSalary": 200000, "status": "open", "sortBy": "salary", "limit": 3}`

### muse-spark-1.3-contributor

Time: 17.2s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

77 confirmed-open remote matches across 7 companies. Top 3 ranked by recorded minimum annual USD salary:

1. Anthropic, Research Engineer, Universes
Location restrictions: Remote-Friendly (Travel Required) | San Francisco, CA | Seattle, WA | New York, NY
Salary: 500,000 to 850,000, currency USD, period year
Source: https://job-boards.greenhouse.io/anthropic/jobs/5061517008

2. Anthropic, Staff+ Software Engineer, Data Infrastructure
Location restrictions: Remote-Friendly (Travel Required) | San Francisco, CA | Seattle, WA | New York, NY
Salary: 405,000 to 485,000, currency USD, period year
Source: https://job-boards.greenhouse.io/anthropic/jobs/5114768008

3. Anthropic, Warehouse and Logistics Capability Manager
Location restrictions: San Francisco, CA | New York, NY
Salary: 405,000 to 485,000, currency USD, period year
Source: https://job-boards.greenhouse.io/anthropic/jobs/5416696008

**Tool calls:**
- `queryJobs` `{"queryScope": "role", "workplaceType": "remote", "minimumSalary": 200000, "status": "open", "sortBy": "salary", "limit": 3}`

### mimo-v2.6-flash

Time: 17.3s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

Three highest-paying confirmed-open remote roles with a recorded minimum of at least $200,000/year (of 77 matching jobs across 7 companies; sorted by minimum salary):

1. **Research Engineer, Universes** — Anthropic
   - Location: Remote-friendly (travel required); also San Francisco, Seattle, New York
   - Salary: $500,000–$850,000 USD/year
   - Source: [Greenhouse posting](https://job-boards.greenhouse.io/anthropic/jobs/5061517008)

2. **Staff+ Software Engineer, Data Infrastructure** — Anthropic
   - Location: Remote-friendly (travel required); also San Francisco, Seattle, New York
   - Salary: $405,000–$485,000 USD/year
   - Source: [Greenhouse posting](https://job-boards.greenhouse.io/anthropic/jobs/5114768008)

3. **Warehouse and Logistics Capability Manager** — Anthropic
   - Location: San Francisco, CA | New York, NY (recorded as remote workplace type)
   - Salary: $405,000–$485,000 USD/year
   - Source: [Greenhouse posting](https://job-boards.greenhouse.io/anthropic/jobs/5416696008)

Notes: All three are full-time, confirmed open, and paid in USD per year; unknown, non-USD, and non-annual salaries are excluded. Remote status here doesn't imply worldwide eligibility, so the location restrictions above still apply. Jobs 2 and 3 are tied on minimum salary.

**Tool calls:**
- `queryJobs` `{"queryScope": "role", "workplaceType": "remote", "minimumSalary": 200000, "status": "open", "sortBy": "salary", "limit": 3}`

## People facts and page-scope isolation (`founders`)

**Question:** Who are Exa's recorded founders in Locus? List all their names and recorded roles with evidence/source links. Do not answer about OpenAI even though its page is open.

**Expected answer:**

- **Jeff Wang — Co-founder** at Exa. [Source](https://exa.ai/about)
- **Will Bryk — Co-founder & CEO** at Exa. [Source](https://exa.ai/about)

### gpt-6-luna

Time: 11.8s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

Both recorded founder profiles cite [Exa’s About page](https://exa.ai/about) as their source. The profiles link to [Jeff Wang’s LinkedIn](https://www.linkedin.com/in/wangzjeff/) and [Will Bryk’s LinkedIn](https://www.linkedin.com/in/william-bryk).

**Tool calls:**
- `searchLocus` `{"query": "Exa", "types": ["companies"], "limit": 3}`
- `queryPeople` `{"companySlugs": ["exa"], "isFounder": true, "limit": 50}`

### muse-spark-1.3-contributor

Time: 7.8s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

I found Exa and will pull its recorded founders with roles and sources.Locus records 2 founders for Exa:

* **Jeff Wang** - Co-founder
  * Recorded source: https://exa.ai/about
  * Profile: https://www.linkedin.com/in/wangzjeff/

* **Will Bryk** - Co-founder & CEO
  * Recorded source: https://exa.ai/about
  * Profile: https://www.linkedin.com/in/william-bryk


**Tool calls:**
- `searchLocus` `{"query": "Exa", "types": ["companies"], "limit": 3}`
- `queryPeople` `{"companySlugs": ["exa"], "isFounder": true, "limit": 10}`

### mimo-v2.6-flash

Time: 15.6s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

Exa has 2 recorded founders in Locus (source for both: [exa.ai/about](https://exa.ai/about)):

- **Will Bryk** — Co-founder & CEO ([LinkedIn](https://www.linkedin.com/in/william-bryk))
- **Jeff Wang** — Co-founder ([LinkedIn](https://www.linkedin.com/in/wangzjeff/))

Roles are recorded profile fields, not independently verified present-day employment. No other founder-flagged people are recorded for Exa (totalMatches = 2).

**Tool calls:**
- `searchLocus` `{"query": "Exa", "types": ["companies"], "limit": 3}`
- `queryPeople` `{"companySlugs": ["exa"], "isFounder": true, "limit": 10}`

## Funding dates and round-vs-total (`funding-window`)

**Question:** Which recorded funding rounds for search-industry companies were announced from September 1 through September 30, 2025, inclusive? Return all matching rounds with company, announcement date, round stage, round amount and source link. Distinguish round amounts from total funding. If no rounds match, don't substitute older dates.

**Expected answer:**

- **Exa — Series B**, announced **2025-09-03**, round amount **$85M USD**. [Source](https://exa.ai/blog/announcing-series-b)
- 1 matching recorded round(s); the round amount is not total funding.

### gpt-6-luna

Time: 5.2s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

One matching recorded round: **Exa** announced a **Series B** on **September 3, 2025**, for **$85 million**. That is the round amount, not Exa’s total funding. [Source](https://exa.ai/blog/announcing-series-b)

**Tool calls:**
- `queryFunding` `{"announcedAfter": "2025-09-01", "announcedBefore": "2025-09-30", "industry": "search", "sortBy": "announcedAt", "limit": 50}`

### muse-spark-1.3-contributor

Time: 5.2s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

1 recorded round matches September 1-30, 2025 for search-industry companies:

* **Company:** Exa
* **Announcement date:** 2025-09-03
* **Round stage:** Series B
* **Round amount:** $85M
* **Source:** https://exa.ai/blog/announcing-series-b

This $85M is the amount for this Series B round, not total funding.

totalMatches: 1, hasMore: false. Describes what is recorded in Locus, not an exhaustive live funding feed.

**Tool calls:**
- `queryFunding` `{"announcedAfter": "2025-09-01", "announcedBefore": "2025-09-30", "industry": "search", "sortBy": "announcedAt", "limit": 50}`

### mimo-v2.6-flash

Time: 8.9s. HTTP 200. Automated check: CLEAN.

**Actual final answer:**

One recorded round matches the September 1–30, 2025 window (inclusive); no older rounds are substituted.

- **Exa** (Web Search, San Francisco) — announced **2025-09-03**, **Series B**, round amount **$85M USD** (valuation $700M), led by Benchmark; other investors include Lightspeed Venture Partners, Y Combinator, and NVentures. [Source](https://exa.ai/blog/announcing-series-b)

The $85M figure is the announced Series B round amount for that date, not Exa's cumulative total funding. This is the full set recorded in Locus for search-industry companies in that window (1 of 1; no more pages).

**Tool calls:**
- `queryFunding` `{"announcedAfter": "2025-09-01", "announcedBefore": "2025-09-30", "industry": "search", "sortBy": "announcedAt", "limit": 50}`
