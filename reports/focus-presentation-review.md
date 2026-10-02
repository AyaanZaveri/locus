# Focus tool-calling and presentation review

## Changes

- Consolidated the presentation contract into `lib/ai/presentation-prompt.ts`: six general rules and three decision examples, rather than phrase-by-phrase fixes. Presentation guidance decreased from 2,772 to 2,283 characters (before the additional tool-first protocol at the end of the system prompt).
- Query, search and presentation outputs now describe the inline cards, displayed counts and visible fields. Funding and activity counts distinguish records from unique company cards.
- Presentation sorting, deduplication and a global display limit run in code after database verification. Input order preserves evidence/ranking order; alphabetical order uses verified labels.
- "Show cards" no longer competes with navigation instructions.
- The stream enforces tool-first presentation without matching user phrases: first-step text is buffered and omitted when a tool call follows. Tool traces remain visible. Text-only answers, error-only answers and findings after tool results are preserved.

## Headless Bladebro testing against the dev server

Tested `http://localhost:3000/company/exa` with Muse and the real stored database. Requests used paraphrases rather than copying the prompt examples. Tool inputs/results and response text were captured from the browser's chat stream, and the rendered card order was inspected.

| Final-version browser case | Result | Calls | Duration |
| --- | --- | --- | --- |
| Redisplay three prior companies alphabetically, widgets only | Aalo Atomics, Anthropic, Autumn AI; no prose | 1 presentation | 10.543 s |
| Pick the first five companies alphabetically | Correct five cards; only the 43-match count/sort qualification in prose | 1 company query | 5.094 s |
| Filter by a nonexistent industry | Zero cards, honest no-match explanation, filter preserved | 1 company query | 7.802 s |
| Redisplay the earlier five in Z–A order after the no-match turn | Beltic, Baseten, Autumn AI, Anthropic, Aalo Atomics; no prose | 1 presentation | 17.342 s |

Earlier browser tests also verified the September 2025 date window and top three funding amounts: Anthropic, Mistral AI, Groq. Reordering those three produced the correct alphabetical widgets.

## Iteration findings

1. Prompt-only revisions improved tool selection, but Muse repeatedly announced that it would render cards, even for "cards only." Tightening the examples did not reliably eliminate the preamble. The stream guard makes this UI rule deterministic instead of adding more examples.
2. The first live evaluator falsely marked a correct funding follow-up as a failure: it demanded date filters on a presentation call even though the prior turn already supplied the complete eight-round set and its amounts. The evaluator now accepts reuse of complete verified evidence and separately tests an incomplete two-round preview that must be requeried before ranking the whole month.

## Reproducible evaluations

Final run: **9/9 passed**, with one targeted tool call per turn. Median end-to-end response time was **9.204 seconds** (range **4.888–14.787 seconds**). These timings are observations from one run, not evidence of a speed improvement. All **34 deterministic/database tests**, typecheck and the production build passed.

Run `npm run eval:focus-presentation` with the dev server running. It makes real model requests and writes `reports/focus-presentation-eval.json` with per-turn tool inputs, card identities/order, text, errors and latency. Use `FOCUS_EVAL_URL` to point it at a different local server.

The nine-turn suite covers ordinary listing, narrowing, ascending/descending reordering, explicit redisplay, no matches, complete funding evidence and incomplete-preview funding ranking. Each case checks one targeted call, exact widgets, relevant date constraints and no prose for cards-only requests. Funding prose may attach amounts, dates and sources to names because those facts are absent from the company widgets.

Deterministic tests cover sort/deduplication/global limits, rendering metadata, preserved evidence order, preamble suppression, text-only responses, errors and text-chunk lifecycle integrity.

## Limits

This is a small live behavioral smoke suite, not a statistically meaningful reliability or model-speed benchmark. Expected identities reflect the current stored database, not independently verified external facts. Token usage is not exposed by this endpoint, so no token-saving claim is made. The stream guard controls presentation, not generation cost: Muse can still generate an omitted preamble. Post-tool text still relies on the model to add only useful information. Mixed entity groups render companies, then people, then jobs; sorting is within each group and limits apply across that display order. Text-only first-step answers are buffered until the step finishes.

## Design references

- [OpenAI function-calling guidance](https://developers.openai.com/api/docs/guides/function-calling): clear contracts, code for deterministic work, focused examples and evaluation.
- [Anthropic tool-design guidance](https://www.anthropic.com/engineering/writing-tools-for-agents): meaningful compact outputs, realistic evaluations, and allowing multiple valid solution strategies.
