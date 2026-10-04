# Focus test questions and expected answers

Database snapshot: 2026-10-04T15:43:07.666Z. Expected answers use direct database tools, not model inference.

Semantic ordering below is the deterministic vector baseline for the exact quoted query, not a declaration that all returned neighbors are equally relevant. A supported evidence-based choice may differ. Unknown status must not be described as confirmed open.

## 1. Semantic job relevance (`cursor-semantic`)

**Question:** At Cursor, return the three recorded roles most relevant to distributed storage and large-scale data infrastructure, including unconfirmed-status roles but not closed roles. Use exactly this semantic search intent: "Engineering roles building distributed data infrastructure and large-scale storage systems". Explain the strongest match with description evidence, give source links and recorded hiring status, and say whether semantic coverage is complete.

**Expected answer:**

- **Cursor — Software Engineer, Storage**; status: open; location: San Francisco, CA | New York, NY. [Source](https://cursor.com/careers/software-engineer-storage)
- **Cursor — Engineering Manager, Infrastructure**; status: open; location: San Francisco, CA | New York, NY. [Source](https://cursor.com/careers/engineering-manager-infrastructure)
- **Cursor — Software Engineer, Pretraining**; status: open; location: San Francisco, CA. [Source](https://cursor.com/careers/software-engineer-pretraining)
- Complete current-text coverage: 132/132 eligible records. These are candidates, not proven relevance matches.
- Storage is the strongest direct fit: its description covers owning databases/caches, a resilient partitioned multi-database topology, and scaling the data layer. The other neighbors require responsibility-level explanation rather than a blanket storage claim.

## 2. Cross-company ranking and scope (`cross-company`)

**Question:** Compare only Exa, Cursor, Baseten and Cohere for distributed storage and large-scale data infrastructure responsibilities. Return the five strongest recorded roles overall, not five per company; include unconfirmed-status roles but exclude closed roles. Use exactly this semantic search intent: "Engineering roles building distributed data infrastructure and large-scale storage systems". Give description evidence, source links, recorded statuses and coverage.

**Expected answer:**

- **Cohere — Software Engineer, Data Infrastructure**; status: unknown; 160,000–325,000 USD/year; location: New York, NY | San Francisco, CA | Canada | United States | Toronto, ON | Montréal, QC. [Source](https://jobs.ashbyhq.com/cohere/6aa3cb2b-ee8b-4c92-b505-3a7509f80d7f)
- **Exa — Software Engineer, Distributed Data Systems**; status: unknown; 180,000–350,000 USD/year; location: San Francisco, CA. [Source](https://jobs.ashbyhq.com/exa/5f10cc28-bcad-4ce4-8fa1-996a59c59e65)
- **Cursor — Software Engineer, Storage**; status: open; location: San Francisco, CA | New York, NY. [Source](https://cursor.com/careers/software-engineer-storage)
- **Cursor — Engineering Manager, Infrastructure**; status: open; location: San Francisco, CA | New York, NY. [Source](https://cursor.com/careers/engineering-manager-infrastructure)
- **Cohere — Data Engineer, Data Foundations**; status: unknown; 160,000–325,000 USD/year; location: New York, NY | Canada | United States. [Source](https://jobs.ashbyhq.com/cohere/9baccd88-c051-474f-bfe8-6867fca54cee)
- Complete current-text coverage: 427/427 eligible records. These are candidates, not proven relevance matches.
- Exa's Distributed Data Systems description covers lakehouse architectures, hundreds-of-petabytes data systems, and pipelines spanning web crawling, training and real-time search. Exa and Cohere statuses in these results are unknown/unconfirmed, not confirmed open.

## 3. Global About discovery (`about-semantic`)

**Question:** Across the whole database, which three companies best fit neural web retrieval APIs for AI agents? Use exactly this semantic search intent: "Companies providing neural web retrieval APIs for AI agents". Search company About text, not jobs. Explain the fit with product evidence and sources, and state whether semantic coverage is complete.

**Expected answer:**

- **Tavily**: Tavily provides a real-time search, extraction, crawling, and mapping API purpose-built for AI agents and retrieval-augmented generation, returning structured, LLM-ready results with citations rather than links. Founded in late 2024 by Rotem Weiss, it sells to Fortune 500 enterprises and AI companies from New York and Tel Aviv. Nebius announced an agreement to acquire Tavily in February 2026 to add agentic search to its AI cloud platform; Tavily continues to operate as a brand and is still hiring. [Source](https://tavily.com)
- **Parallel**: Parallel Web Systems builds web infrastructure for AI agents, giving systems programmatic access to the open web through crawling, indexing, ranking, retrieval, and reasoning technologies. The company is building the infrastructure layer for AI systems that need accurate, real-time information from the web. [Source](https://parallel.ai)
- **Context.dev**: Context.dev is a web context API that gives software and AI agents live, structured access to the internet through a single REST API and official SDKs. Founded in 2025 by Yahia Bakour as Brand.dev, the company rebranded in March 2026 to reflect a broader platform that combines scraping and crawling into LLM-ready Markdown, schema-validated structured extraction, web search, brand and company intelligence, people enrichment, and website change monitoring. Backed by Y Combinator's Summer 2026 batch, it reports powering hundreds of companies including Mintlify, daily.dev, Klarna, and Rho, and is SOC 2 Type 1 certified. [Source](https://www.context.dev)
- Complete current-text About coverage: 53/53 companies. Product evidence, not scores alone, determines fit.

## 4. No false hiring claims (`exa-confirmed`)

**Question:** How many Exa job records are confirmed open in Locus? Search only confirmed-open records. If none, say so; do not substitute unconfirmed roles or claim Exa is not hiring in the real world.

**Expected answer:**

- **No matching recorded jobs. Do not relax filters or infer real-world hiring status.**

## 5. Unknown hiring status (`exa-unconfirmed`)

**Question:** Find Exa's three recorded roles most relevant to distributed storage and data infrastructure. Include unconfirmed-status records and exclude closed records. Use exactly this semantic search intent: "Engineering roles building distributed data infrastructure and large-scale storage systems". Label each hiring status accurately, provide evidence and source links, and don't say an unconfirmed role is open.

**Expected answer:**

- **Exa — Software Engineer, Distributed Data Systems**; status: unknown; 180,000–350,000 USD/year; location: San Francisco, CA. [Source](https://jobs.ashbyhq.com/exa/5f10cc28-bcad-4ce4-8fa1-996a59c59e65)
- **Exa — Software Engineer, Knowledge Systems**; status: unknown; 180,000–350,000 USD/year; location: San Francisco, CA. [Source](https://jobs.ashbyhq.com/exa/1f90ebb9-0f74-4a52-822a-d0ea6acdef4f)
- **Exa — Software Engineer, Backend**; status: unknown; 180,000–350,000 USD/year; location: San Francisco, CA. [Source](https://jobs.ashbyhq.com/exa/41eb773d-9909-422c-b6b8-5bbdc407d318)
- Complete current-text coverage: 52/52 eligible records. These are candidates, not proven relevance matches.
- Exa's Distributed Data Systems description covers lakehouse architectures, hundreds-of-petabytes data systems, and pipelines spanning web crawling, training and real-time search. Exa and Cohere statuses in these results are unknown/unconfirmed, not confirmed open.

## 6. Never relax exact constraints (`impossible-filters`)

**Question:** Find confirmed-open roles at Cursor with recorded location containing Mars and a recorded minimum annual USD salary of at least $1,000,000,000. Require both conditions on the same role. If none exist, say none; don't relax location, salary or status.

**Expected answer:**

- **No matching recorded jobs. Do not relax filters or infer real-world hiring status.**

## 7. Salary semantics and ranking (`salary-ranking`)

**Question:** Across the database, return the three highest-paying confirmed-open remote jobs with a recorded minimum annual USD salary of at least $200,000, ranked by that minimum salary. Include company, title, location restrictions, salary range, currency, period and source link. Exclude unknown salaries and non-USD or non-annual pay. Don't restrict this to Exa.

**Expected answer:**

- **Anthropic — Research Engineer, Universes**; status: open; 500,000–850,000 USD/year; location: Remote-Friendly (Travel Required) | San Francisco, CA | Seattle, WA | New York, NY. [Source](https://job-boards.greenhouse.io/anthropic/jobs/5061517008)
- **Anthropic — Staff+ Software Engineer, Data Infrastructure**; status: open; 405,000–485,000 USD/year; location: Remote-Friendly (Travel Required) | San Francisco, CA | Seattle, WA | New York, NY. [Source](https://job-boards.greenhouse.io/anthropic/jobs/5114768008)
- **Anthropic — Warehouse and Logistics Capability Manager**; status: open; 405,000–485,000 USD/year; location: San Francisco, CA | New York, NY. [Source](https://job-boards.greenhouse.io/anthropic/jobs/5416696008)
- 77 qualifying jobs across 7 companies; only the top three are requested. Preserve remote-friendly travel restrictions.
- These are recorded salary fields, not independently verified current compensation offers. The third result is not a software role; don't silently replace it with a lower-paying engineering role.

## 8. People facts and page-scope isolation (`founders`)

**Question:** Who are Exa's recorded founders in Locus? List all their names and recorded roles with evidence/source links. Do not answer about OpenAI even though its page is open.

**Expected answer:**

- **Jeff Wang — Co-founder** at Exa. [Source](https://exa.ai/about)
- **Will Bryk — Co-founder & CEO** at Exa. [Source](https://exa.ai/about)

## 9. Funding dates and round-vs-total (`funding-window`)

**Question:** Which recorded funding rounds for search-industry companies were announced from September 1 through September 30, 2025, inclusive? Return all matching rounds with company, announcement date, round stage, round amount and source link. Distinguish round amounts from total funding. If no rounds match, don't substitute older dates.

**Expected answer:**

- **Exa — Series B**, announced **2025-09-03**, round amount **$85M USD**. [Source](https://exa.ai/blog/announcing-series-b)
- 1 matching recorded round(s); the round amount is not total funding.
