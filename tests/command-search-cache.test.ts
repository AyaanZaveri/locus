import assert from "node:assert/strict";
import { test } from "node:test";
import { CommandSearchCache } from "../lib/command-search-cache";

test("repeat queries are immediate, isolated and expire", () => {
  let now = 0;
  const cache = new CommandSearchCache<string>(() => now, 60_000);
  cache.set("Cursor", "cursor-results");
  assert.equal(cache.get("Cursor"), "cursor-results");
  assert.equal(cache.get("Exa"), undefined);
  now = 59_999;
  assert.equal(cache.get("Cursor"), "cursor-results");
  now = 60_000;
  assert.equal(cache.get("Cursor"), undefined);
});

test("cache is bounded and refreshing an entry does not evict it", () => {
  const cache = new CommandSearchCache<number>(() => 0, 60_000, 2);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("a", 3);
  cache.set("c", 4);
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("a"), 3);
  assert.equal(cache.get("c"), 4);
});
