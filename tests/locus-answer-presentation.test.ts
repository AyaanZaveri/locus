import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Prompt-contract checks, not a substitute for model-output evaluations.
test("Focus is told that cards answer list requests without duplicate prose", () => {
  const route = readFileSync("app/api/chat/route.ts", "utf8");
  assert.match(
    route,
    /Result widgets are part of your answer, not hidden tool output/,
  );
  assert.match(
    route,
    /Do NOT repeat those entities or visible fields in prose, bullets, numbered lists/,
  );
  assert.match(route, /43 companies match this period; showing 5/);
  assert.match(route, /stop after\s+the tool results without a prose summary/);
  assert.match(route, /For zero results or failed queries/);
  assert.match(
    route,
    /Inline result cards count as concrete details and as the answer/,
  );
});

test("presentation tool does not encourage redisplaying automatic result cards", () => {
  const tools = readFileSync("lib/ai/tools.ts", "utf8");
  assert.match(
    tools,
    /do not redundantly redisplay the same results from another tool in the CURRENT turn/,
  );
  assert.match(
    tools,
    /Accompanying prose must add new evidence or qualifications/,
  );
});

test("explicit reorder and top-N follow-ups request fresh widgets, including five companies", () => {
  const route = readFileSync("app/api/chat/route.ts", "utf8");
  assert.match(route, /You MAY reuse entities from earlier turns/);
  assert.match(route, /sort those\s+alphabetically/);
  assert.match(route, /top 3 of those 8 rounds/);
  assert.match(route, /amount descending with limit 3/);
  assert.match(
    route,
    /restriction does NOT apply to cards in earlier conversation turns/,
  );
  const tools = readFileSync("lib/ai/tools.ts", "utf8");
  assert.match(tools, /Input arrays determine display order/);
  assert.match(tools, /companySlugs: z\.array\(companySlugSchema\)\.max\(50\)/);
});
