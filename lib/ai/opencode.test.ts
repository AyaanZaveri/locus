// Run with: node --conditions=react-server --import tsx --test lib/ai/opencode.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { getLocusModel } from "./opencode";
import { LOCUS_MODELS } from "../locus-models";

test("every selectable model sends the correct ID, protocol and session header", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENCODE_GO_API_KEY;
  process.env.OPENCODE_GO_API_KEY = "test-key-not-a-credential";
  try {
    for (const option of LOCUS_MODELS) {
      let captured:
        | { url: string; headers: Headers; body: Record<string, unknown> }
        | undefined;
      globalThis.fetch = Object.assign(
        async (
          input: Parameters<typeof fetch>[0],
          init?: Parameters<typeof fetch>[1],
        ) => {
          captured = {
            url: String(input),
            headers: new Headers(init?.headers),
            body: JSON.parse(String(init?.body)),
          };
          throw new Error("mock transport: no network request");
        },
        { preconnect: originalFetch.preconnect },
      );
      await assert.rejects(
        async () =>
          await getLocusModel("test-session", option.id).doGenerate({
            prompt: [
              { role: "user", content: [{ type: "text", text: "hello" }] },
            ],
          }),
      );
      assert.ok(captured, option.id);
      assert.equal(
        captured.url,
        `https://opencode.ai/zen/go/v1/${option.protocol === "responses" ? "responses" : "chat/completions"}`,
      );
      assert.equal(captured.body.model, option.id);
      assert.equal(captured.headers.get("x-opencode-session"), "test-session");
      assert.equal(
        captured.headers.get("authorization"),
        "Bearer test-key-not-a-credential",
      );
    }
    assert.equal(getLocusModel("test-session").modelId, "gpt-6-luna");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENCODE_GO_API_KEY;
    else process.env.OPENCODE_GO_API_KEY = originalKey;
  }
});
