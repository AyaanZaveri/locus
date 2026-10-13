import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_LOCUS_MODEL,
  LOCUS_MODELS,
  LOCUS_MODEL_PROVIDERS,
  isLocusModelId,
} from "./locus-models";

test("only the ten supported models are selectable, with Luna as default", () => {
  assert.equal(DEFAULT_LOCUS_MODEL, "gpt-6-luna");
  assert.equal(LOCUS_MODELS.length, 10);
  assert.equal(new Set(LOCUS_MODELS.map((model) => model.id)).size, 10);
  for (const model of LOCUS_MODELS)
    assert.equal(isLocusModelId(model.id), true);
  for (const invalid of [
    null,
    undefined,
    {},
    "",
    "gpt-5.6-luna",
    "glm-3.5-flash",
    "step-5-preview",
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
    7,
  );
});

test("Cat Jam Free shares the OpenCode provider section with Space Bunny", () => {
  const providers = LOCUS_MODEL_PROVIDERS.filter(
    (provider) => provider.lab === "OpenCode",
  );
  assert.equal(providers.length, 1);
  assert.deepEqual(
    providers[0].models.map((model) => model.id),
    ["space-bunny-free", "cat-jam-free"],
  );
  const catJam = providers[0].models[1];
  assert.equal(catJam.label, "Cat Jam Free");
  assert.equal(catJam.protocol, "chat");
  assert.equal(catJam.logo, providers[0].models[0].logo);
  assert.equal(
    LOCUS_MODEL_PROVIDERS.flatMap((provider) => provider.models).length,
    LOCUS_MODELS.length,
  );
});
