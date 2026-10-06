import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";

const endpoint = new URL(
  "/api/chat",
  process.env.FOCUS_EVAL_URL ?? "http://localhost:3000",
).toString();
const args = process.argv.slice(2);
function option(name: string, fallback: string) {
  const i = args.indexOf(name);
  return i < 0 ? fallback : (args[i + 1] ?? fallback);
}
const model = option("--model", "gpt-6-luna");
const runs = Number(option("--runs", "1"));
const outputPath = option("--output", "reports/focus-routing-eval.json");
const caseIndex = args.indexOf("--case");
const selected = caseIndex < 0 ? undefined : option("--case", "").split(",");
assert(Number.isInteger(runs) && runs > 0, "--runs must be a positive integer");

const scenarios = [
  {
    name: "funded-project",
    prompt:
      "Find me a role at a company that recently raised and is similar to my locus project",
  },
  { name: "named-inventory", prompt: "List 3 recorded roles at HiringCafe." },
  {
    name: "structured-jobs",
    prompt:
      "Show the 3 highest-paid confirmed open remote software engineer roles with annual USD minimum salary at least $150000.",
  },
  {
    name: "conceptual-company",
    prompt:
      "Which companies build tools for discovering startups and connecting founder, funding and hiring information?",
  },
];
const background =
  "I am an early-career full-stack engineer building user-facing AI products with TypeScript, React and Next.js. My project Locus is a startup intelligence platform connecting startup funding, hiring, jobs and people, with semantic search and vectors.";
const asObject = (v: unknown): Record<string, any> =>
  v && typeof v === "object" ? (v as Record<string, any>) : {};

async function main() {
  const cases = selected
    ? scenarios.filter((s) => selected.includes(s.name))
    : scenarios;
  assert(cases.length > 0, "No matching --case names");
  const results: Record<string, unknown>[] = [];
  for (let run = 1; run <= runs; run++)
    for (const scenario of cases) {
      const started = performance.now();
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: model,
          sessionId: `focus-routing-${crypto.randomUUID()}`,
          pagePath: "/companies",
          messages: [
            {
              id: crypto.randomUUID(),
              role: "user",
              parts: [{ type: "text", text: background }],
            },
            {
              id: crypto.randomUUID(),
              role: "user",
              parts: [{ type: "text", text: scenario.prompt }],
            },
          ],
        }),
        signal: AbortSignal.timeout(120_000),
      });
      assert(response.ok, `HTTP ${response.status}`);
      const chunks = (await response.text()).split(/\r?\n/).flatMap((line) => {
        if (!line.startsWith("data:")) return [];
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") return [];
        try {
          return [JSON.parse(data) as Record<string, any>];
        } catch {
          return [];
        }
      });
      const calls = chunks.filter((c) => c.type === "tool-input-available");
      const outputsFor = (toolName: string) =>
        chunks
          .filter(
            (c) =>
              c.type === "tool-output-available" &&
              calls.some(
                (call) =>
                  call.toolCallId === c.toolCallId &&
                  call.toolName === toolName,
              ),
          )
          .map((c) => asObject(c.output));
      const companyCalls = calls.filter((c) => c.toolName === "queryCompanies");
      const jobCalls = calls.filter((c) => c.toolName === "queryJobs");
      const companyInputs = companyCalls.map((c) => asObject(c.input));
      const jobInputs = jobCalls.map((c) => asObject(c.input));
      const errors: string[] = [];
      const check = (condition: boolean, message: string) => {
        if (!condition) errors.push(message);
      };
      check(
        !chunks.some((c) =>
          ["error", "tool-output-error", "tool-input-error"].includes(c.type),
        ),
        "Stream/tool error",
      );
      check(
        chunks.some((c) => c.type === "finish"),
        "Stream did not finish",
      );
      let semanticQualityScore: number | null = null;
      let selectedSlugs: string[] = [];
      if (scenario.name === "funded-project") {
        check(
          companyCalls.length >= 1 && jobCalls.length >= 1,
          "Expected company discovery then jobs lookup",
        );
        check(
          companyInputs.some(
            (i) =>
              i.resultMode === "candidates" &&
              Boolean(i.semanticQuery) &&
              i.funding?.announcedAfter &&
              i.funding?.announcedBefore,
          ),
          "Expected semantic candidate discovery with nested funding date bounds",
        );
        check(
          companyInputs.every(
            (i) =>
              !i.query &&
              !i.industry &&
              !i.jobs?.query &&
              !i.jobs?.title &&
              !i.jobs?.skills,
          ),
          "No inferred lexical company or hiring filters from profile",
        );
        check(
          jobInputs.every(
            (i) => i.resultMode === "candidates" && Number(i.limit) >= 15,
          ),
          "Expected candidate job pool with limit >= 15",
        );
        const companyResult = outputsFor("queryCompanies")[0];
        const discovered = [
          ...(companyResult?.companies ?? []),
          ...(companyResult?.unrankedCompanies ?? []),
        ];
        const slugs = [
          ...new Set(
            discovered
              .map((c: any) => c.slug)
              .filter((s: unknown): s is string => typeof s === "string"),
          ),
        ];
        selectedSlugs = slugs;
        check(
          slugs.length > 0 &&
            jobInputs.every(
              (i) =>
                Array.isArray(i.companySlugs) &&
                i.companySlugs.length > 0 &&
                i.companySlugs.every((s: string) => slugs.includes(s)),
            ),
          "Jobs candidate query must use only confirmed discovered company slugs",
        );
        const fundingRounds = discovered.flatMap(
          (c: any) => c.evidence?.funding?.rounds ?? [],
        );
        const dateBoundedRounds = fundingRounds.filter((r: any) => {
          const date = String(
            r.announcedAt ?? r.announced_at ?? r.date ?? "",
          ).slice(0, 10);
          const fundingInput = companyInputs.find((i) => i.funding)?.funding;
          return (
            date &&
            (!fundingInput?.announcedAfter ||
              date >= fundingInput.announcedAfter) &&
            (!fundingInput?.announcedBefore ||
              date <= fundingInput.announcedBefore)
          );
        });
        check(
          dateBoundedRounds.length > 0,
          "No fundedCompanies evidence round within requested date bounds",
        );
        check(
          calls[0]?.toolName === "queryCompanies",
          "Company discovery must precede job lookup",
        );
        const candidates = outputsFor("queryJobs").flatMap((o) => o.jobs ?? []);
        const selectedJobs = outputsFor("presentLocusResults").flatMap(
          (o) => o.jobs ?? [],
        );
        selectedSlugs = selectedJobs.map((j: any) => String(j.companySlug));
        check(selectedJobs.length === 1, "Expected exactly one presented role");
        check(
          selectedJobs.every((j: any) =>
            candidates.some(
              (c: any) =>
                c.title === j.title &&
                c.location === j.location &&
                c.companySlug === j.companySlug,
            ),
          ),
          "Presented role must exactly match a retrieved candidate",
        );
        check(
          selectedJobs.every((j: any) =>
            discovered.some(
              (c: any) =>
                c.slug === j.companySlug &&
                c.evidence?.funding?.rounds.some((r: any) =>
                  dateBoundedRounds.includes(r),
                ),
            ),
          ),
          "Published role must retain qualifying funding evidence",
        );
        check(
          slugs.includes("hiringcafe"),
          "Known eligible HiringCafe disappeared from company evidence",
        );
        // Dataset-specific regression hit, not a universal measure of semantic quality.
        semanticQualityScore = selectedSlugs.includes("hiringcafe") ? 1 : 0;
      } else if (scenario.name === "named-inventory") {
        check(
          calls.some(
            (c) =>
              c.toolName === "searchLocus" &&
              c.input.types?.includes("companies"),
          ) &&
            jobCalls.length >= 1 &&
            companyCalls.length === 0,
          "Expected named employer resolution then jobs query, not conceptual company discovery",
        );
        check(
          jobInputs.some(
            (i) =>
              i.resultMode !== "candidates" &&
              Number(i.limit) === 3 &&
              !i.semanticQuery &&
              !i.query &&
              !i.title &&
              !i.skills,
          ),
          "Expected inline nonsemantic jobs query with limit 3",
        );
        check(
          !calls.some((c) => /presentLocusResults/i.test(c.toolName)),
          "Avoid redundant presentation for inline results",
        );
      } else if (scenario.name === "structured-jobs") {
        check(
          jobCalls.length >= 1 && companyCalls.length === 0,
          "Expected queryJobs only",
        );
        check(
          jobInputs.some(
            (i) =>
              Number(i.limit) === 3 &&
              i.status === "open" &&
              i.workplaceType === "remote" &&
              i.minimumSalary >= 150000 &&
              i.sortBy === "salary" &&
              /software engineer/i.test(i.query ?? "") &&
              !i.semanticQuery,
          ),
          "Missing structured lexical/open/remote/salary filters",
        );
      } else {
        check(
          companyCalls.length >= 1 && jobCalls.length === 0,
          "Expected queryCompanies without jobs lookup",
        );
        check(
          companyInputs.some(
            (i) => Boolean(i.semanticQuery) && !i.query && !i.industry,
          ),
          "Expected semanticQuery without inferred lexical/industry filter",
        );
      }
      results.push({
        run,
        case: scenario.name,
        passed: errors.length === 0,
        errors,
        elapsedMs: Math.round(performance.now() - started),
        toolNames: calls.map((c) => c.toolName),
        callCount: calls.length,
        flags: {
          companySemanticQuery: companyInputs.some((i) =>
            Boolean(i.semanticQuery),
          ),
          companyFundingDateBounds: companyInputs.some((i) =>
            Boolean(i.funding?.announcedAfter && i.funding?.announcedBefore),
          ),
          jobsSemanticQuery: jobInputs.some((i) => Boolean(i.semanticQuery)),
          jobsHardLexicalFilters: jobInputs.some((i) =>
            Boolean(i.query || i.title || i.skills),
          ),
          jobsResultModes: jobInputs.map((i) => i.resultMode ?? "inline"),
          jobsLimits: jobInputs.map((i) => i.limit ?? null),
          selectedSlugs,
          semanticQualityScore,
        },
      });
      console.log(
        `${errors.length ? "FAIL" : "PASS"} ${scenario.name} (${Math.round(performance.now() - started)}ms)`,
      );
    }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        endpoint,
        model,
        runs,
        passed: results.filter((r) => r.passed).length,
        total: results.length,
        cases: results,
      },
      null,
      2,
    ) + "\n",
  );
  if (results.some((r) => !r.passed)) process.exitCode = 1;
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
