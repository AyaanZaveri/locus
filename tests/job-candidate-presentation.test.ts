import assert from "node:assert/strict";
import test from "node:test";
import { withJobPresentation } from "../lib/ai/job-candidate-presentation";
import { compactToolResult } from "../lib/ai/compact-tool-output";
import { shouldDisplayLocusResult } from "../lib/locus-result-visibility";
import { jobsQueryResult, jobsQuerySchema } from "../lib/ai/jobs-query";

test("candidate evidence remains available to the model but not rendered as cards", () => {
  const pool = withJobPresentation(
    { jobs: [{ title: "Engineer", companySlug: "test", location: "Remote" }] },
    "candidates",
  );
  assert.equal(shouldDisplayLocusResult(pool), false);
  assert.equal(shouldDisplayLocusResult(compactToolResult(pool)), false);
  assert.equal(pool.jobs.length, 1);
  assert.equal(
    shouldDisplayLocusResult(withJobPresentation(pool, "inline")),
    true,
  );
  assert.equal(shouldDisplayLocusResult({ jobs: pool.jobs }), true);
});

test("non-semantic fallback still supplies requirements evidence for candidate curation", () => {
  const input = jobsQuerySchema.parse({ resultMode: "candidates", limit: 15 });
  const result = jobsQueryResult(
    [
      {
        title: "Engineer",
        description: `${"Introduction. ".repeat(200)}\n## Requirements\n3+ years of software experience.`,
      },
    ],
    input,
    "2026-10-06",
  );
  assert.equal(
    result.jobs[0].requirementsExcerpt,
    "3+ years of software experience.",
  );
  assert.equal("semanticScore" in result.jobs[0], false);
});
