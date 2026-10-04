import { mkdir, writeFile } from "node:fs/promises";
import { locusTools } from "../lib/ai/tools";

const infra =
  "Engineering roles building distributed data infrastructure and large-scale storage systems";
const about = "Companies providing neural web retrieval APIs for AI agents";
const tests = [
  {
    id: "cursor-semantic",
    category: "Semantic job relevance",
    pagePath: "/company/cursor",
    question: `At Cursor, return the three recorded roles most relevant to distributed storage and large-scale data infrastructure, including unconfirmed-status roles but not closed roles. Use exactly this semantic search intent: "${infra}". Explain the strongest match with description evidence, give source links and recorded hiring status, and say whether semantic coverage is complete.`,
    tool: "queryJobs",
    input: {
      companySlugs: ["cursor"],
      semanticQuery: infra,
      status: "openOrUnknown",
      sortBy: "relevance",
      limit: 3,
    },
  },
  {
    id: "cross-company",
    category: "Cross-company ranking and scope",
    pagePath: "/company/openai",
    question: `Compare only Exa, Cursor, Baseten and Cohere for distributed storage and large-scale data infrastructure responsibilities. Return the five strongest recorded roles overall, not five per company; include unconfirmed-status roles but exclude closed roles. Use exactly this semantic search intent: "${infra}". Give description evidence, source links, recorded statuses and coverage.`,
    tool: "queryJobs",
    input: {
      companySlugs: ["exa", "cursor", "baseten", "cohere"],
      semanticQuery: infra,
      status: "openOrUnknown",
      sortBy: "relevance",
      limit: 5,
    },
  },
  {
    id: "about-semantic",
    category: "Global About discovery",
    pagePath: "/company/openai",
    question: `Across the whole database, which three companies best fit neural web retrieval APIs for AI agents? Use exactly this semantic search intent: "${about}". Search company About text, not jobs. Explain the fit with product evidence and sources, and state whether semantic coverage is complete.`,
    tool: "queryCompanies",
    input: { semanticQuery: about, sortBy: "relevance", limit: 3 },
  },
  {
    id: "exa-confirmed",
    category: "No false hiring claims",
    pagePath: "/company/exa",
    question:
      "How many Exa job records are confirmed open in Locus? Search only confirmed-open records. If none, say so; do not substitute unconfirmed roles or claim Exa is not hiring in the real world.",
    tool: "queryJobs",
    input: { companySlugs: ["exa"], status: "open", limit: 3 },
  },
  {
    id: "exa-unconfirmed",
    category: "Unknown hiring status",
    pagePath: "/company/exa",
    question: `Find Exa's three recorded roles most relevant to distributed storage and data infrastructure. Include unconfirmed-status records and exclude closed records. Use exactly this semantic search intent: "${infra}". Label each hiring status accurately, provide evidence and source links, and don't say an unconfirmed role is open.`,
    tool: "queryJobs",
    input: {
      companySlugs: ["exa"],
      semanticQuery: infra,
      status: "openOrUnknown",
      sortBy: "relevance",
      limit: 3,
    },
  },
  {
    id: "impossible-filters",
    category: "Never relax exact constraints",
    pagePath: "/company/cursor",
    question:
      "Find confirmed-open roles at Cursor with recorded location containing Mars and a recorded minimum annual USD salary of at least $1,000,000,000. Require both conditions on the same role. If none exist, say none; don't relax location, salary or status.",
    tool: "queryJobs",
    input: {
      companySlugs: ["cursor"],
      status: "open",
      location: "Mars",
      minimumSalary: 1000000000,
      limit: 3,
    },
  },
  {
    id: "salary-ranking",
    category: "Salary semantics and ranking",
    pagePath: "/company/exa",
    question:
      "Across the database, return the three highest-paying confirmed-open remote jobs with a recorded minimum annual USD salary of at least $200,000, ranked by that minimum salary. Include company, title, location restrictions, salary range, currency, period and source link. Exclude unknown salaries and non-USD or non-annual pay. Don't restrict this to Exa.",
    tool: "queryJobs",
    input: {
      status: "open",
      workplaceType: "remote",
      minimumSalary: 200000,
      sortBy: "salary",
      limit: 3,
    },
  },
  {
    id: "founders",
    category: "People facts and page-scope isolation",
    pagePath: "/company/openai",
    question:
      "Who are Exa's recorded founders in Locus? List all their names and recorded roles with evidence/source links. Do not answer about OpenAI even though its page is open.",
    tool: "queryPeople",
    input: { companySlugs: ["exa"], isFounder: true, limit: 50 },
  },
  {
    id: "funding-window",
    category: "Funding dates and round-vs-total",
    pagePath: "/company/cursor",
    question:
      "Which recorded funding rounds for search-industry companies were announced from September 1 through September 30, 2025, inclusive? Return all matching rounds with company, announcement date, round stage, round amount and source link. Distinguish round amounts from total funding. If no rounds match, don't substitute older dates.",
    tool: "queryFunding",
    input: {
      industry: "search",
      announcedAfter: "2025-09-01",
      announcedBefore: "2025-09-30",
      sortBy: "announcedAt",
      limit: 50,
    },
  },
];

async function main() {
  // Oracle uses database tools without inference. Cached semantic queries only.
  delete process.env.AI_GATEWAY_API_KEY;
  await mkdir("reports/focus-model-evaluation", { recursive: true });
  const records = [];
  for (const test of tests) {
    const tool = locusTools[
      test.tool as keyof typeof locusTools
    ] as unknown as {
      execute: (input: unknown, options: unknown) => Promise<unknown>;
    };
    const expected = await tool.execute(test.input, {
      toolCallId: `oracle-${test.id}`,
      messages: [],
    });
    records.push({ ...test, expected });
    console.log(JSON.stringify({ id: test.id, expected }));
  }
  await writeFile(
    "reports/focus-model-evaluation/questions-and-expected.json",
    JSON.stringify(
      {
        preparedAt: new Date().toISOString(),
        method:
          "Direct database tools; semantic vectors from existing cache; no model answers used as oracle.",
        tests: records,
      },
      null,
      2,
    ),
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
