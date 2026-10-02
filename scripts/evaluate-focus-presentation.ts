import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { readUIMessageStream, type UIMessage, type UIMessageChunk } from "ai";

// Live behavioral evaluations, separate from deterministic unit tests.
// Runs real model calls through the dev server; no API key is written to reports.
const baseUrl = process.env.FOCUS_EVAL_URL ?? "http://localhost:3000";
type Output = {
  companies?: { name: string }[];
  rounds?: { name: string }[];
  totalMatches?: number;
  filters?: Record<string, unknown>;
  presentation?: { displayedCounts: { companies: number } };
};
type Case = {
  prompt: string;
  names: string[];
  cardsOnly?: boolean;
  funding?: boolean;
  empty?: boolean;
};
const scenarios: Case[][] = [
  [
    {
      prompt: "Pick the first five companies alphabetically from the database.",
      names: ["Aalo Atomics", "Anthropic", "Autumn AI", "Baseten", "Beltic"],
    },
    {
      prompt:
        "Keep just Aalo Atomics, Anthropic and Autumn AI. Put their cards in reverse alphabetical order, no text.",
      names: ["Autumn AI", "Anthropic", "Aalo Atomics"],
      cardsOnly: true,
    },
    {
      prompt: "Redisplay those three A–Z, widgets only.",
      names: ["Aalo Atomics", "Anthropic", "Autumn AI"],
      cardsOnly: true,
    },
    {
      prompt:
        "Only show companies whose industry contains unobtainium quantum unicorns.",
      names: [],
      empty: true,
    },
  ],
  [
    {
      prompt:
        "Which companies raised funding in September 2025? Show all matching rounds.",
      names: [
        "Vercel",
        "Modal",
        "Cohere",
        "Groq",
        "Mistral AI",
        "Baseten",
        "Exa",
        "Anthropic",
      ],
      funding: true,
    },
    {
      prompt: "Give me the three biggest of those rounds.",
      names: ["Anthropic", "Mistral AI", "Groq"],
      funding: true,
    },
    {
      prompt: "Rearrange those three cards alphabetically. Cards only.",
      names: ["Anthropic", "Groq", "Mistral AI"],
      cardsOnly: true,
    },
  ],
  [
    {
      prompt:
        "Show only the two most recently announced funding rounds in September 2025.",
      names: ["Vercel", "Modal"],
      funding: true,
    },
    {
      prompt:
        "Actually show the three largest rounds from that whole month, not just those two.",
      names: ["Anthropic", "Mistral AI", "Groq"],
      funding: true,
    },
  ],
];

async function main() {
  const report: Record<string, unknown>[] = [];
  for (const [scenario, cases] of scenarios.entries()) {
    const sessionId = `focus-presentation-eval-${crypto.randomUUID()}`;
    const messages: UIMessage[] = [];
    let hasCompleteFundingEvidence = false;
    for (const item of cases) {
      messages.push({
        id: crypto.randomUUID(),
        role: "user",
        parts: [{ type: "text", text: item.prompt }],
      });
      const start = performance.now();
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, messages, pagePath: "/companies" }),
        signal: AbortSignal.timeout(90_000),
      });
      assert.ok(response.ok, `HTTP ${response.status}`);
      const raw = await response.text();
      const chunks = raw
        .split("\n")
        .filter((line) => line.startsWith("data: {"))
        .map((line) => JSON.parse(line.slice(6)) as UIMessageChunk);
      const elapsedMs = Math.round(performance.now() - start);
      const stream = new ReadableStream<UIMessageChunk>({
        start(controller) {
          chunks.forEach((c) => controller.enqueue(c));
          controller.close();
        },
      });
      let assistant: UIMessage | undefined;
      for await (const message of readUIMessageStream({
        stream,
        terminateOnError: true,
      }))
        assistant = message;
      assert.ok(assistant);
      messages.push(assistant);
      const calls = chunks.filter((c) => c.type === "tool-input-available");
      const outputs = chunks
        .filter((c) => c.type === "tool-output-available")
        .map((c) => c.output as Output);
      const names = outputs.flatMap((output) => [
        ...new Set(
          (output.companies ?? output.rounds ?? []).map((c) => c.name),
        ),
      ]);
      const text = chunks
        .filter((c) => c.type === "text-delta")
        .map((c) => c.delta)
        .join("");
      const errors: string[] = [];
      const check = (condition: boolean, error: string) => {
        if (!condition) errors.push(error);
      };
      check(
        JSON.stringify(names) === JSON.stringify(item.names),
        "Incorrect card identities/order/count",
      );
      check(
        calls.length === 1,
        "Expected one targeted tool call (no redundant calls)",
      );
      check(
        !chunks.some(
          (c) =>
            c.type === "error" ||
            c.type === "tool-output-error" ||
            c.type === "tool-input-error",
        ),
        "Stream/tool error",
      );
      if (item.cardsOnly)
        check(text.trim() === "", "Cards-only request has prose");
      if (!item.funding)
        check(
          !names.some((name) => text.includes(name)),
          "Prose repeats entity names without new evidence",
        );
      if (item.empty) {
        check(
          outputs.some((o) => o.totalMatches === 0),
          "Missing zero-result count",
        );
        check(text.trim().length > 0, "Empty result lacks explanation");
      }
      const reusedCompleteFundingSet =
        item.funding &&
        hasCompleteFundingEvidence &&
        calls.every((c) => c.toolName === "presentLocusResults");
      if (item.funding && !reusedCompleteFundingSet) {
        check(
          outputs.length > 0 &&
            outputs.every(
              (o) =>
                o.filters?.announcedAfter === "2025-09-01" &&
                o.filters?.announcedBefore === "2025-09-30",
            ),
          "Prior date constraints dropped or ranked an incomplete preview",
        );
      }
      if (
        outputs.some(
          (o) =>
            o.rounds &&
            o.rounds.length > 0 &&
            o.totalMatches === o.rounds.length &&
            o.filters?.announcedAfter === "2025-09-01" &&
            o.filters?.announcedBefore === "2025-09-30",
        )
      )
        hasCompleteFundingEvidence = true;
      report.push({
        scenario,
        prompt: item.prompt,
        passed: errors.length === 0,
        errors,
        elapsedMs,
        reusedCompleteFundingSet: Boolean(reusedCompleteFundingSet),
        calls: calls.map((c) => ({ name: c.toolName, input: c.input })),
        names,
        text,
      });
      console.log(
        `${errors.length ? "FAIL" : "PASS"} ${item.prompt} (${elapsedMs}ms)`,
      );
    }
  }
  await mkdir("reports", { recursive: true });
  await writeFile(
    "reports/focus-presentation-eval.json",
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseUrl,
        note: "Small live smoke suite; expected entities reflect the current database. Token usage is not exposed by this endpoint. Not a reliability benchmark.",
        passed: report.filter((r) => r.passed).length,
        total: report.length,
        cases: report,
      },
      null,
      2,
    ) + "\n",
  );
  if (report.some((r) => !r.passed)) process.exitCode = 1;
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
