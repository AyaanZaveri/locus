import assert from "node:assert/strict";
import { test } from "node:test";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { locusTools } from "../lib/ai/tools";
import { compactToolOutput } from "../lib/ai/compact-tool-output";
import { search } from "../lib/search";

test("queryJobs is the only company job retrieval tool offered to the model", () => {
  assert.ok("queryJobs" in locusTools);
  assert.equal("listCompanyJobs" in locusTools, false);
  assert.equal(typeof locusTools.queryJobs.description, "string");
  assert.match(String(locusTools.queryJobs.description), /single job retrieval tool/);
});

test(
  "semantic tools preserve evidence/count meaning; disabled service falls back without relaxing filters",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const options = {
      toolCallId: "semantic-regression",
      messages: [],
      context: {},
    };
    const input = {
      companySlugs: ["exa"],
      semanticQuery:
        "Engineering roles building distributed data infrastructure and large-scale storage systems",
      queryScope: "role" as const,
      status: "openOrUnknown" as const,
      sortBy: "relevance" as const,
      limit: 3,
    };
    const result = await locusTools.queryJobs.execute!(input, options);
    assert.ok("retrieval" in result);
    assert.equal(result.retrieval.mode, "semantic");
    assert.equal("totalMatches" in result, false);
    assert.ok("totalCandidates" in result);
    assert.equal(result.totalCandidates, 52);
    assert.equal(
      result.jobs[0].title,
      "Software Engineer, Distributed Data Systems",
    );
    assert.equal(result.jobs[0].status, "unknown");
    assert.ok("descriptionExcerpt" in result.jobs[0]);
    assert.equal("embedding" in result.jobs[0], false);
    const global = await locusTools.queryJobs.execute!(
      { ...input, companySlugs: undefined, limit: 1 },
      options,
    );
    assert.ok("retrieval" in global);
    assert.equal(global.retrieval.mode, "semantic");
    assert.ok("completeCoverage" in global.retrieval);
    assert.ok("unembeddedRecords" in global.retrieval);
    assert.equal(
      global.retrieval.completeCoverage,
      global.retrieval.unembeddedRecords === 0,
    );
    assert.equal(global.jobs.length, 1);
    const about = await locusTools.queryCompanies.execute!(
      {
        companySlugs: ["exa"],
        semanticQuery:
          "Companies providing neural web retrieval APIs for AI agents",
        sortBy: "relevance",
        limit: 1,
      },
      options,
    );
    assert.ok("retrieval" in about);
    assert.equal(about.retrieval.mode, "semantic");
    assert.equal(about.companies[0].slug, "exa");
    assert.ok("descriptionExcerpt" in about.companies[0]);
    const previous = process.env.LOCUS_SEMANTIC_SEARCH;
    process.env.LOCUS_SEMANTIC_SEARCH = "off";
    try {
      const fallback = await locusTools.queryJobs.execute!(
        { ...input, query: "engineer", location: "Mars", minimumSalary: 1e9 },
        options,
      );
      assert.ok("retrieval" in fallback);
      assert.equal(fallback.retrieval.mode, "lexical-fallback");
      assert.equal(fallback.jobs.length, 0);
      assert.equal(fallback.filters.location, "Mars");
      assert.equal(fallback.filters.minimumSalary, 1e9);
      const company = await locusTools.queryCompanies.execute!(
        {
          companySlugs: ["exa"],
          semanticQuery:
            "Companies providing neural web retrieval APIs for AI agents",
          countryCode: "ZZ",
          sortBy: "name",
          limit: 3,
        },
        options,
      );
      assert.ok("retrieval" in company);
      assert.equal(company.retrieval.mode, "lexical-fallback");
      assert.equal(company.companies.length, 0);
    } finally {
      if (previous === undefined) delete process.env.LOCUS_SEMANTIC_SEARCH;
      else process.env.LOCUS_SEMANTIC_SEARCH = previous;
    }
  },
);

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
