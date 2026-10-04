# Embedding rollout batches

Database snapshot: October 4, 2026. **All three batches are complete and verified.**
Including Exa, current coverage is **53 company profiles and 3,980 jobs**.
Machine-readable manifest: `reports/embedding-batches.json`.

Exa is already embedded and excluded. The planned rollout scope is **52 company About
profiles and 3,928 jobs**, including 398 jobs with unknown status. All descriptions
are present. These are rollout groups, not individual embedding API requests.

| Batch | Companies | Jobs | Confirmed open | Unknown status |
| --- | ---: | ---: | ---: | ---: |
| 1 (complete) | 20 | 896 | 730 | 166 |
| 2 (complete) | 20 | 1,513 | 1,281 | 232 |
| 3 (complete) | 12 | 1,519 | 1,519 | 0 |
| Total | 52 | 3,928 | 3,530 | 398 |

## Batch 1: representative first rollout

Covers all ten recorded industry categories with a smaller workload.

| Company | Slug | Jobs |
| --- | --- | ---: |
| Cursor | cursor | 132 |
| Baseten | baseten | 101 |
| Supabase | supabase | 59 |
| Modal | modal | 34 |
| OpenRouter | openrouter | 26 |
| Parallel | parallel | 24 |
| Firecrawl | firecrawl | 31 |
| Tavily | tavily | 11 |
| Cohere | cohere | 142 |
| Kalshi | kalshi | 41 |
| Clay | clay | 59 |
| Heidi | heidi-health | 79 |
| Harmonic | harmonic | 10 |
| Browserbase | browserbase | 7 |
| Mintlify | mintlify | 17 |
| Linear | linear | 30 |
| Railway | railway | 8 |
| Neon | neon | 1 |
| Groq | groq | 6 |
| Together AI | together | 78 |

## Batch 2: expanded employer coverage

Keep Anthropic and OpenAI in separate rollouts to spread the largest workloads.

| Company | Slug | Jobs |
| --- | --- | ---: |
| Anthropic | anthropic | 611 |
| ElevenLabs | elevenlabs | 226 |
| Figma | figma | 162 |
| Vercel | vercel | 84 |
| Notion | notion | 137 |
| Shopify | shopify | 107 |
| LangChain | langchain | 101 |
| Beltic | beltic | 2 |
| Browser Use | browser-use | 5 |
| Convex | convex | 13 |
| Halluminate | halluminate | 9 |
| Interfaze | interfaze | 2 |
| Kanu AI | kanu | 1 |
| Kernel | kernel | 8 |
| LlamaIndex | llamaindex | 8 |
| Ollama | ollama | 8 |
| Photon | photon | 0 |
| TypeSafe AI | typesafe-ai | 6 |
| Vooma | vooma | 11 |
| Weave | weave | 12 |

## Batch 3: remaining coverage

Twelve companies but a similar job workload to batch 2.

| Company | Slug | Jobs |
| --- | --- | ---: |
| OpenAI | openai | 816 |
| Mistral AI | mistral-ai | 199 |
| Perplexity AI, Inc. | perplexity | 127 |
| Fireworks AI | fireworks | 79 |
| Lovable | lovable | 77 |
| Replit | replit | 72 |
| Coder | coder | 28 |
| Temporal | temporal | 65 |
| Wealthsimple | wealthsimple | 48 |
| Framer | framer | 8 |
| Autumn AI | autumn-ai | 0 |
| Context.dev | context-dev | 0 |

## Execution gates

1. Re-read current records and existing cache coverage; these counts can change.
2. Measure complete deterministic embedding texts with the Voyage tokenizer and
   report actual estimated cost before spending. Description bytes are not tokens.
3. Reuse compatible cached vectors, split new inputs within provider limits, pace
   API calls and persist each completed batch for resumability.
4. Import and check retrieval, exact filters, unknown statuses, partial coverage
   and query-cache reuse before starting the next rollout.

Photon, Autumn AI and Context.dev receive About vectors despite having no recorded
jobs. Creating the initial lists made no embedding requests. All three batches were
then explicitly authorized, executed and verified; see
`reports/embedding-batch-01-results.md`, `reports/embedding-batch-02-results.md`
and `reports/embedding-batch-03-results.md`.
No further paid backfill is authorized
by this manifest alone.
