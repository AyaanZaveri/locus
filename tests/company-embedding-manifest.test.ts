import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createCompanyEmbeddingManifest,
  isStrictCompanySlug,
  type CompanyEmbeddingCompany,
  type CompanyEmbeddingJob,
} from "../lib/ai/company-embedding-manifest";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
} from "../lib/ai/embedding-config";

const company: CompanyEmbeddingCompany = {
  slug: "exa",
  name: "Exa",
  industry: "AI",
  tagline: "Search",
  description: "About Exa",
};
const job = (
  overrides: Partial<CompanyEmbeddingJob> = {},
): CompanyEmbeddingJob => ({
  title: "Engineer",
  department: "Research",
  focus: "Search",
  skills: ["Rust"],
  description: "Build search systems",
  companyName: "Exa",
  ...overrides,
});
const plan = (c = company, jobs: CompanyEmbeddingJob[] = []) =>
  createCompanyEmbeddingManifest(c, jobs, new Date("2026-10-05T23:00:00Z"));

test("plans zero-job companies and emits runner-compatible fixed config", () => {
  const result = plan();
  assert.equal(
    JSON.stringify(result),
    JSON.stringify({
      version: 1,
      status: "planned",
      snapshotDate: "2026-10-05",
      scope: ["company-about", "job-descriptions"],
      modelId: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      batches: [
        {
          id: result.batches[0].id,
          status: "planned",
          companySlugs: ["exa"],
          companyCount: 1,
          jobCount: 0,
        },
      ],
    }),
  );
});
test("does not include regenerated job IDs in deterministic batch IDs", () => {
  assert.equal(
    plan(company, [job()]).batches[0].id,
    plan(company, [job()]).batches[0].id,
  );
});
test("changes the batch ID when company or job embedding content changes", () => {
  const base = plan(company, [job()]).batches[0].id;
  assert.notEqual(
    plan({ ...company, description: "Changed" }, [job()]).batches[0].id,
    base,
  );
  assert.notEqual(plan(company, [job({ skills: ["Go"] })]).batches[0].id, base);
  assert.notEqual(
    plan(company, [job({ department: "Platform" })]).batches[0].id,
    base,
  );
});
test("rejects missing descriptions rather than inventing a summary", () => {
  assert.throws(
    () => plan(company, [job({ description: " " })]),
    /cannot embed a summary or guessed content/i,
  );
});
test("preserves duplicate keys in count and snapshot hash", () => {
  const one = plan(company, [job()]).batches[0];
  const two = plan(company, [job(), job()]).batches[0];
  assert.equal(two.jobCount, 2);
  assert.notEqual(two.id, one.id);
});
test("validates strict slugs", () => {
  assert.equal(isStrictCompanySlug("exa-inc"), true);
  assert.equal(isStrictCompanySlug("../exa"), false);
  assert.equal(isStrictCompanySlug("a".repeat(101)), false);
  assert.throws(() => plan({ ...company, slug: "../exa" }), /slug/i);
});
