import assert from "node:assert/strict";
import { test } from "node:test";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { locusTools } from "../lib/ai/tools";

test("Responses tools explicitly preserve optional query filters", async () => {
  let requestBody:
    | {
        tools: Array<{
          name: string;
          strict?: boolean;
          parameters: { required?: string[] };
        }>;
      }
    | undefined;
  const provider = createOpenAI({
    apiKey: "test-only",
    fetch: (async (_url, init) => {
      requestBody = JSON.parse(String(init?.body));
      return Response.json({
        id: "test-response",
        object: "response",
        created_at: 0,
        model: "gpt-6-luna",
        output: [],
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      });
    }) as typeof fetch,
  });
  await generateText({
    model: provider.responses("gpt-6-luna"),
    prompt: "What search company raised in sep 2025?",
    tools: locusTools,
    maxRetries: 0,
  });

  assert.ok(requestBody);
  for (const tool of requestBody.tools) {
    assert.equal(
      tool.strict,
      false,
      `${tool.name} must opt out of Responses schema normalization`,
    );
  }
  const funding = requestBody.tools.find(
    (tool) => tool.name === "queryFunding",
  );
  assert.ok(funding);
  for (const field of ["companySlug", "stage", "investor", "minimumAmount"]) {
    assert.ok(
      !funding.parameters.required?.includes(field),
      `${field} is optional`,
    );
  }
  assert.ok(locusTools.queryFunding.inputSchema);
});
