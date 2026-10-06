import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  resumeDetailsSchema,
  resumeExtractionSchema,
} from "../lib/user-profile";

test("model output schema requires every field, including professional links", () => {
  const schema = z.toJSONSchema(resumeExtractionSchema, { io: "input" });
  const fields = Object.keys(schema.properties ?? {}).sort();
  assert.deepEqual([...(schema.required ?? [])].sort(), fields);
  for (const key of ["linkedin", "github", "portfolio"])
    assert.ok(schema.required?.includes(key));
  assert.equal(schema.additionalProperties, false);
});

test("legacy resume parsing still defaults absent professional links", () => {
  for (const key of ["linkedin", "github", "portfolio"] as const)
    assert.equal(resumeDetailsSchema.shape[key].parse(undefined), "");
});
