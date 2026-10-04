import assert from "node:assert/strict";
import { test } from "node:test";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { locusTools } from "../lib/ai/tools";
import { compactToolOutput } from "../lib/ai/compact-tool-output";
import { search } from "../lib/search";

test(
  "live search respects entity scope and never retries isolated words",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const jobsOnly = await search("evelenlabs", { types: ["jobs"] });
    assert.deepEqual(jobsOnly.companies, []);
    assert.deepEqual(jobsOnly.people, []);
    const peopleOnly = await search("", { types: ["people"] });
    assert.deepEqual(peopleOnly, { companies: [], people: [], jobs: [] });
    const execute = locusTools.searchLocus.execute!;
    const options = { toolCallId: "test-search", messages: [], context: {} };
    const result = await execute(
      { query: "evelenlabs", types: ["companies"], limit: 3 },
      options,
    );
    assert.ok("companies" in result);
    assert.equal(result.companies[0].slug, "elevenlabs");
    assert.equal(result.companies[0].matchType, "fuzzy-name");
    assert.deepEqual(result.jobs, []);
    assert.deepEqual(result.people, []);
    const constrained = await execute(
      { query: "evelenlabs hiring on Mars", types: ["companies"], limit: 3 },
      options,
    );
    assert.ok("companies" in constrained);
    assert.deepEqual(constrained.companies, []);
    const alias = await execute(
      { query: "ZEIT", types: ["companies"], limit: 3 },
      options,
    );
    assert.ok("companies" in alias);
    assert.equal(alias.companies[0].slug, "vercel");
    assert.equal(alias.companies[0].matchType, "alias-exact");
    assert.equal(
      alias.companies[0].matchedAlias?.sourceUrl,
      "https://vercel.com/blog/zeit-is-now-vercel",
    );
    const person = await execute(
      { query: "Aidan Gmoez", types: ["people"], limit: 3 },
      options,
    );
    assert.ok("people" in person);
    assert.equal(person.people[0].name, "Aidan Gomez");
    assert.equal(person.people[0].matchType, "fuzzy-name");
    assert.deepEqual(person.companies, []);
    assert.deepEqual(person.jobs, []);
  },
);

test("every Locus tool uses the model-only compact output projection", () => {
  for (const [name, tool] of Object.entries(locusTools)) {
    assert.equal(tool.toModelOutput, compactToolOutput, name);
  }
});

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
  for (const field of [
    "companySlug",
    "companySlugs",
    "industry",
    "location",
    "countryCode",
    "stage",
    "investor",
    "minimumAmount",
  ]) {
    assert.ok(
      !funding.parameters.required?.includes(field),
      `${field} is optional`,
    );
  }
  assert.ok(locusTools.queryFunding.inputSchema);
  const discovery = requestBody.tools.find(
    (tool) => tool.name === "queryCompanies",
  );
  assert.ok(discovery);
  for (const field of ["funding", "jobs", "people", "activity"]) {
    assert.ok(
      !discovery.parameters.required?.includes(field),
      `${field} remains optional`,
    );
  }
});
