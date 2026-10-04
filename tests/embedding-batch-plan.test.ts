import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BATCH_INPUT_LIMIT,
  BATCH_TOKEN_LIMIT,
  TOKEN_MARGIN_PER_INPUT,
  planEmbeddingRequests,
  type EmbeddingDocument,
} from "@/lib/ai/embedding-batch-plan";

const doc = (key: string, recipe = "job", tokens = 10): EmbeddingDocument => ({
  key,
  recipe,
  text: `text-${key}`,
  tokens,
});

test("groups recipes, preserves ordering, and deduplicates identical keys", () => {
  const a = doc("a");
  const input = [a, doc("b"), a, doc("c", "company")];
  assert.deepEqual(planEmbeddingRequests(input), [
    [a, doc("b")],
    [doc("c", "company")],
  ]);
});

test("splits batches at input and conservative token limits", () => {
  const byCount = planEmbeddingRequests(
    Array.from({ length: BATCH_INPUT_LIMIT + 1 }, (_, i) => doc(String(i))),
  );
  assert.deepEqual(
    byCount.map((batch) => batch.length),
    [BATCH_INPUT_LIMIT, 1],
  );

  const byTokens = planEmbeddingRequests([
    doc("a", "job", 20_000),
    doc("b", "job", 20_000),
    doc("c", "job", 20_000),
    doc("d", "job", 20_000),
  ]);
  assert.deepEqual(
    byTokens.map((batch) => batch.map(({ key }) => key)),
    [["a", "b", "c", "d"]],
  );
  for (const batch of byTokens) {
    assert.ok(
      batch.reduce(
        (sum, item) => sum + item.tokens + TOKEN_MARGIN_PER_INPUT,
        0,
      ) <= BATCH_TOKEN_LIMIT,
    );
  }
});

test("rejects conflicting duplicate keys and invalid/oversized counts", () => {
  assert.throws(
    () => planEmbeddingRequests([doc("x"), { ...doc("x"), text: "different" }]),
    /Conflicting/,
  );
  for (const tokens of [0, -1, 1.5, Number.POSITIVE_INFINITY, Number.NaN]) {
    assert.throws(
      () => planEmbeddingRequests([doc("x", "job", tokens)]),
      /Invalid/,
    );
  }
  assert.throws(
    () => planEmbeddingRequests([doc("x", "job", 32_000)]),
    /exceeds/,
  );
});
