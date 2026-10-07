import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_LOCUS_MODEL,
  LOCUS_MODELS,
  isLocusModelId,
} from "./locus-models";

test("only the eight supported models are selectable, with Luna as default", () => {
  assert.equal(DEFAULT_LOCUS_MODEL, "gpt-6-luna");
  assert.equal(LOCUS_MODELS.length, 8);
  assert.equal(new Set(LOCUS_MODELS.map((model) => model.id)).size, 8);
  for (const model of LOCUS_MODELS)
    assert.equal(isLocusModelId(model.id), true);
  for (const invalid of [
    null,
    undefined,
    {},
    "",
    "gpt-5.6-luna",
    "glm-3.5-flash",
  ]) {
    assert.equal(isLocusModelId(invalid), false);
  }
});

test("Luna and Muse use Responses; the remaining models use Chat Completions", () => {
  assert.deepEqual(
    LOCUS_MODELS.filter((model) => model.protocol === "responses").map(
      (model) => model.id,
    ),
    ["gpt-6-luna", "muse-spark-1.3-contributor"],
  );
  assert.equal(
    LOCUS_MODELS.filter((model) => model.protocol === "chat").length,
    5,
  );
});
