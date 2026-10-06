import assert from "node:assert/strict";
import test from "node:test";
import { LOCUS_MODELS } from "../lib/locus-models";
import { focusGenerationSettings } from "../lib/ai/focus-generation-settings";

test("Focus explicitly uses low reasoning for Luna, rather than the upstream medium default", () => {
  assert.deepEqual(focusGenerationSettings("gpt-6-luna"), {
    providerOptions: { openai: { reasoningEffort: "low" } },
  });
});

test("OpenAI-specific reasoning options are not forced on other Focus models", () => {
  for (const model of LOCUS_MODELS)
    if (model.id !== "gpt-6-luna")
      assert.deepEqual(focusGenerationSettings(model.id), {});
});
