import assert from "node:assert/strict";
import test from "node:test";
import { jobsQuerySchema } from "../lib/ai/jobs-query";

for (const query of [undefined, "engineer"]) {
  test(
    `single-company queryJobs executes with ${query ?? "no keyword constraint"}`,
    { skip: !process.env.DATABASE_URL && !process.env.DATABASE_URL_POOLED },
    async () => {
      const { locusTools } = await import("../lib/ai/tools");
      const result = await locusTools.queryJobs.execute!(
        jobsQuerySchema.parse({
          companySlugs: ["hiringcafe"],
          status: "openOrUnknown",
          limit: 3,
          query,
        }),
        { toolCallId: "company-jobs-regression", messages: [], context: {} },
      );
      assert.ok("jobs" in result);
      assert.ok(result.jobs.length > 0 && result.jobs.length <= 3);
      assert.ok(result.jobs.every((row) => row.companySlug === "hiringcafe"));
      assert.ok("totalMatches" in result);
    },
  );
}

test(
  "candidate retrieval cannot accidentally collapse to the display limit",
  { skip: !process.env.DATABASE_URL && !process.env.DATABASE_URL_POOLED },
  async () => {
    const { locusTools } = await import("../lib/ai/tools");
    const result = await locusTools.queryJobs.execute!(
      jobsQuerySchema.parse({
        resultMode: "candidates",
        status: "openOrUnknown",
        limit: 3,
      }),
      { toolCallId: "candidate-limit-regression", messages: [], context: {} },
    );
    assert.ok("jobs" in result);
    assert.equal(result.jobs.length, 15);
    assert.equal(result.filters.limit, 15);
    assert.equal(result.presentation.mode, "candidatePool");
    assert.equal(result.presentation.displayedCounts.jobs, 0);
  },
);
