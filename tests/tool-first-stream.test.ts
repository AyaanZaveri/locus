import assert from "node:assert/strict";
import { test } from "node:test";
import type { UIMessageChunk } from "ai";
import { toolFirstStream } from "../lib/ai/tool-first-stream";

async function transform(chunks: UIMessageChunk[]) {
  const source = new ReadableStream<UIMessageChunk>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(chunk));
      controller.close();
    },
  });
  const reader = source.pipeThrough(toolFirstStream()).getReader();
  const output: UIMessageChunk[] = [];
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    output.push(next.value);
  }
  return output;
}
const preamble: UIMessageChunk[] = [
  { type: "text-start", id: "p" },
  { type: "text-delta", id: "p", delta: "Loading the cards." },
  { type: "text-end", id: "p" },
];
test("tool-first stream removes preamble but preserves tool events and subsequent findings", async () => {
  const rest: UIMessageChunk[] = [
    { type: "tool-input-start", toolCallId: "c", toolName: "queryCompanies" },
    {
      type: "tool-input-available",
      toolCallId: "c",
      toolName: "queryCompanies",
      input: { limit: 5 },
    },
    {
      type: "tool-output-available",
      toolCallId: "c",
      output: { companies: [] },
    },
    { type: "finish-step" },
    { type: "start-step" },
    // A provider may reuse the completed preamble's ID in a later step.
    { type: "text-start", id: "p" },
    { type: "text-delta", id: "p", delta: "43 total matches." },
    { type: "text-end", id: "p" },
  ];
  assert.deepEqual(await transform([...preamble, ...rest]), rest);
});
test("text-only answers, failures and streams without a finish chunk retain their text", async () => {
  for (const suffix of [
    [],
    [{ type: "finish-step" }],
    [{ type: "error", errorText: "Unavailable" }],
    [{ type: "abort" }],
  ] as UIMessageChunk[][]) {
    const chunks = [...preamble, ...suffix];
    assert.deepEqual(await transform(chunks), chunks);
  }
});
test("late text-end for a discarded preamble is not sent without its text-start", async () => {
  const call: UIMessageChunk = {
    type: "tool-input-available",
    toolCallId: "c",
    toolName: "presentLocusResults",
    input: {},
  };
  assert.deepEqual(
    await transform([...preamble.slice(0, 2), call, preamble[2]]),
    [call],
  );
});
