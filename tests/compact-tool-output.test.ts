import assert from "node:assert/strict";
import { test } from "node:test";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  toUIMessageStream,
  tool,
  type UIMessage,
} from "ai";
import {
  MockLanguageModelV4,
  convertArrayToReadableStream,
  convertReadableStreamToArray,
} from "ai/test";
import { z } from "zod";

import {
  compactToolOutput,
  compactToolResult,
} from "../lib/ai/compact-tool-output";

const asset =
  "https://cdn.example.com/" + "long-asset-path/".repeat(30) + "logo.png";
const policy =
  "Date bounds are inclusive; future and partial dates are excluded. Counts are rounds, not companies.";
const rich = {
  asOf: "2026-10-04",
  filters: { funding: { announcedAfter: "2025-09-01" } },
  totalMatches: 3,
  hasMore: true,
  countUnit: "companies",
  policy: "Intersect before limiting; evidence is a preview.",
  presentation: {
    displayedCounts: { companies: 2 },
    visibleFields: { companies: ["name", "industry", "location"] },
    textPolicy: "Cards are the answer; add evidence and caveats.",
  },
  companies: ["exa", "other"].map((slug) => ({
    slug,
    name: slug,
    industry: "Web Search",
    location: "San Francisco",
    countryCode: "us",
    logo: asset,
    pageUrl: `/company/${slug}`,
    evidence: {
      funding: {
        asOf: "2026-10-04",
        filters: { announcedAfter: "2025-09-01", limit: 3 },
        datePolicy: policy,
        totalMatches: 4,
        hasMore: true,
        rounds: [
          {
            slug,
            name: slug,
            industry: "Web Search",
            location: "San Francisco",
            countryCode: "us",
            logo: asset,
            pageUrl: `/company/${slug}`,
            roundId: "series-b",
            stage: "Series B",
            announcedAt: "2025-09-03",
            amount: { amount: 85000000, display: "$85M", currency: "USD" },
            valuation: { amount: 700000000, display: "$700M", currency: "USD" },
            leadInvestors: [
              {
                name: "Benchmark",
                logo: asset,
                website: "https://benchmark.com",
              },
            ],
            investors: [
              { name: "NVentures", logo: asset, website: "https://nvidia.com" },
            ],
            sourceUrl: "https://exa.ai/blog/announcing-series-b",
          },
        ],
      },
      jobs: {
        asOf: "2026-10-04",
        filters: { workplaceType: "remote", status: "open" },
        datePolicy: "Remote is not worldwide eligibility.",
        totalMatches: 5,
        hasMore: true,
        totalCompanies: 1,
        jobs: [
          {
            companySlug: slug,
            companyName: slug,
            companyLogo: asset,
            countryCode: "us",
            title: "Engineer",
            location: "Remote - Canada; travel required",
            workplaceType: "remote",
            status: "open",
            skills: ["Python"],
            visaSponsorship: "unknown",
            requiresUsWorkAuthorization: false,
            salary: { minimum: null, currency: "USD" },
            url: "https://jobs.example.com/engineer",
          },
        ],
      },
      people: {
        policy:
          "Recorded roles are not independently verified current employment.",
        filters: { role: "CTO" },
        totalMatches: 1,
        hasMore: false,
        people: [
          {
            name: "Alice",
            role: "CTO",
            isFounder: null,
            image: asset,
            companySlug: slug,
            companyName: slug,
            companyIndustry: "Web Search",
            companyLocation: "San Francisco",
            sourceUrl: "https://example.com/alice",
            url: "https://linkedin.com/in/alice",
          },
        ],
      },
      activity: {
        policy: "A product event is not necessarily a launch.",
        totalMatches: 1,
        hasMore: false,
        activity: [
          {
            slug,
            name: slug,
            location: "San Francisco",
            type: "product",
            date: "2025-09-03",
            title: "Customer case study",
            excerpt: "Complete evidence " + "x".repeat(2000),
            sourceUrl: "https://example.com/event",
          },
        ],
      },
    },
  })),
};

// JSON comparison also verifies that undefined/Date normalization matches the
// SDK's default model-output serialization.
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

test("compact discovery preserves all answer facts, sources, counts, eligibility and preview metadata", () => {
  const value = plain(compactToolResult(rich));
  assert.equal(value.totalMatches, 3);
  assert.equal(value.hasMore, true);
  assert.equal(value.countUnit, "companies");
  assert.deepEqual(value.presentation, rich.presentation);
  assert.deepEqual(value.filters, rich.filters);
  assert.equal(value.evidenceContext.funding.datePolicy, policy);
  assert.deepEqual(
    value.evidenceContext.jobs.filters,
    rich.companies[0].evidence.jobs.filters,
  );
  for (let i = 0; i < value.companies.length; i++) {
    const company = value.companies[i];
    const evidence = company.evidence;
    const original = rich.companies[i].evidence;
    assert.equal(company.slug, rich.companies[i].slug);
    assert.equal(company.pageUrl, rich.companies[i].pageUrl);
    assert.equal(evidence.funding.totalMatches, 4);
    assert.equal(evidence.funding.hasMore, true);
    const round = evidence.funding.rounds[0];
    for (const key of [
      "amount",
      "valuation",
      "announcedAt",
      "stage",
      "roundId",
      "sourceUrl",
    ] as const)
      assert.deepEqual(round[key], original.funding.rounds[0][key]);
    assert.deepEqual(round.leadInvestors, [
      { name: "Benchmark", website: "https://benchmark.com" },
    ]);
    assert.deepEqual(round.investors, [
      { name: "NVentures", website: "https://nvidia.com" },
    ]);
    assert.equal("slug" in round, false);
    assert.equal("companySlug" in evidence.jobs.jobs[0], false);
    for (const key of [
      "title",
      "location",
      "workplaceType",
      "status",
      "skills",
      "visaSponsorship",
      "requiresUsWorkAuthorization",
      "salary",
      "url",
    ] as const)
      assert.deepEqual(evidence.jobs.jobs[0][key], original.jobs.jobs[0][key]);
    for (const key of [
      "name",
      "role",
      "isFounder",
      "sourceUrl",
      "url",
    ] as const)
      assert.deepEqual(
        evidence.people.people[0][key],
        original.people.people[0][key],
      );
    assert.equal(
      evidence.activity.activity[0].excerpt,
      original.activity.activity[0].excerpt,
    );
    assert.equal(
      evidence.activity.activity[0].sourceUrl,
      original.activity.activity[0].sourceUrl,
    );
  }
  assert.ok(JSON.stringify(value).length < JSON.stringify(rich).length * 0.65);
});

test("projection leaves the rich UI result untouched and is idempotent", () => {
  const before = structuredClone(rich);
  const value = compactToolResult(rich);
  assert.deepEqual(rich, before);
  assert.deepEqual(compactToolResult(value), value);
  assert.ok(!JSON.stringify(value).includes(asset));
});

test("candidate pools defer nested jobs while retaining company facts and unranked deduplication", () => {
  const output = structuredClone(rich) as any;
  output.presentation.mode = "candidatePool";
  output.companies[0].description = "Full company description";
  output.companies[0].rankingScore = 0.91;
  output.unrankedCompanies = [structuredClone(output.companies[1])];
  const original = structuredClone(output);
  const projected = plain(compactToolResult(output));
  assert.deepEqual(output, original);
  assert.equal(projected.companies[0].description, "Full company description");
  assert.equal(projected.companies[0].rankingScore, 0.91);
  assert.equal(projected.companies[0].evidence.jobs.jobDetailsDeferred, true);
  assert.equal("jobs" in projected.companies[0].evidence.jobs, false);
  assert.equal(
    projected.unrankedCompanies[0].evidence.jobs.jobDetailsDeferred,
    true,
  );
  assert.equal("jobs" in projected.unrankedCompanies[0].evidence.jobs, false);
  assert.equal(
    "companySlug" in projected.unrankedCompanies[0].evidence.people.people[0],
    false,
  );
  assert.deepEqual(
    projected.evidenceContext.jobs.filters,
    output.companies[0].evidence.jobs.filters,
  );
  assert.ok(JSON.stringify(projected).length < JSON.stringify(output).length);
});

test("normal company previews and queryJobs candidate records are retained", () => {
  const ordinary = plain(compactToolResult(rich));
  assert.equal(ordinary.companies[0].evidence.jobs.jobs.length, 1);
  const jobs = {
    presentation: { mode: "candidatePool" },
    jobs: [
      {
        description: "Full role",
        requirements: ["Python"],
        eligibility: "unknown",
      },
    ],
  };
  assert.deepEqual(compactToolResult(jobs), jobs);
});

test("different per-company policies/context and conflicting company fields are preserved", () => {
  const original = structuredClone(rich);
  original.companies[1].evidence.funding.datePolicy = "Different date policy";
  original.companies[0].evidence.funding.rounds[0].location =
    "Different source location";
  const value = plain(compactToolResult(original));
  assert.equal(value.evidenceContext.funding, undefined);
  assert.equal(value.companies[0].evidence.funding.datePolicy, policy);
  assert.equal(
    value.companies[1].evidence.funding.datePolicy,
    "Different date policy",
  );
  assert.equal(
    value.companies[0].evidence.funding.rounds[0].location,
    "Different source location",
  );
});

test("standalone search/profile/funding/array outputs keep identities, text and errors", () => {
  const output = {
    rounds: rich.companies[0].evidence.funding.rounds,
    description: "Full description",
    error: "No matches",
    unknown: null,
    ids: ["one", "two"],
    date: new Date("2025-09-03"),
  };
  const value = plain(compactToolResult(output));
  assert.equal(value.rounds[0].slug, "exa");
  assert.equal(value.rounds[0].name, "exa");
  assert.equal(value.description, output.description);
  assert.equal(value.error, output.error);
  assert.equal(value.unknown, null);
  assert.equal(value.date, "2025-09-03T00:00:00.000Z");
  assert.deepEqual(value.ids, output.ids);
  assert.deepEqual(
    compactToolResult([{ name: "Alice", image: asset, role: "CTO" }]),
    [{ name: "Alice", role: "CTO" }],
  );
  assert.equal(compactToolResult(undefined), null);
  assert.equal(
    compactToolResult("No matching passages"),
    "No matching passages",
  );
});

test("live SDK tool loop and history conversion compact model output, not UI output", async () => {
  const usage = {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
  };
  const model = new MockLanguageModelV4({
    doStream: [
      {
        stream: convertArrayToReadableStream([
          { type: "stream-start", warnings: [] },
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "queryCompanies",
            input: "{}",
          },
          {
            type: "finish",
            finishReason: { unified: "tool-calls", raw: undefined },
            usage,
          },
        ]),
      },
      {
        stream: convertArrayToReadableStream([
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "text-1" },
          { type: "text-delta", id: "text-1", delta: "Exa raised $85M." },
          { type: "text-end", id: "text-1" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: undefined },
            usage,
          },
        ]),
      },
    ],
  });
  const tools = {
    queryCompanies: tool({
      inputSchema: z.object({}),
      execute: async () => rich,
      toModelOutput: compactToolOutput,
    }),
  };
  const result = streamText({
    model,
    prompt: "Find funded search companies",
    tools,
    stopWhen: stepCountIs(2),
  });
  const chunks = await convertReadableStreamToArray(
    toUIMessageStream({ stream: result.stream }),
  );
  const uiResult = chunks.find(
    (chunk) => chunk.type === "tool-output-available",
  );
  assert.ok(uiResult && uiResult.type === "tool-output-available");
  assert.deepEqual(uiResult.output, rich);
  assert.equal(model.doStreamCalls.length, 2);
  const modelPrompt = model.doStreamCalls[1].prompt;
  const modelResult = modelPrompt
    .flatMap((message) => (message.role === "tool" ? message.content : []))
    .find((part) => part.type === "tool-result");
  assert.ok(modelResult && modelResult.type === "tool-result");
  assert.deepEqual(modelResult.output, compactToolOutput({ output: rich }));
  const history: UIMessage[] = [
    {
      id: "assistant-1",
      role: "assistant",
      parts: [
        {
          type: "tool-queryCompanies",
          toolCallId: "call-1",
          state: "output-available",
          input: {},
          output: rich,
        },
      ],
    },
  ];
  const converted = await convertToModelMessages(history, { tools });
  const historicalResult = converted
    .flatMap((message) => (message.role === "tool" ? message.content : []))
    .find((part) => part.type === "tool-result");
  assert.ok(historicalResult && historicalResult.type === "tool-result");
  assert.deepEqual(historicalResult.output, modelResult.output);
  assert.deepEqual(history[0].parts[0], {
    type: "tool-queryCompanies",
    toolCallId: "call-1",
    state: "output-available",
    input: {},
    output: rich,
  });
});
