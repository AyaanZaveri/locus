import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const directory = "skills/company-profile-research";
test("company research advertises and requires the referenced post-import embedding gate", async () => {
  const skill = await readFile(join(directory, "SKILL.md"), "utf8");
  assert.match(skill, /description:.*embeddings.*after import/);
  assert.match(
    skill,
    /Finish only after[\s\S]*?current-text embedding verification have succeeded/,
  );
  assert.match(skill, /after each import/i);
  const targets = [...skill.matchAll(/\]\((references\/embeddings\.md)\)/g)];
  assert.ok(
    targets.length >= 2,
    "Default workflow and import gate must link the procedure",
  );
  await access(join(directory, "references/embeddings.md"));
});

test("embedding procedure preserves no-write scope, spend gates and cached reimports", async () => {
  const text = await readFile(
    join(directory, "references/embeddings.md"),
    "utf8",
  );
  assert.match(
    text,
    /research-only\/JSON-only\/no-write request does \*\*not\*\*/,
  );
  assert.match(text, /\$0\.25 total/);
  assert.match(text, /zero provider calls/);
  assert.match(text, /zero jobs still gets its About vector/);
  assert.match(text, /regenerate unchanged Exa/);
  assert.match(text, /regenerated job IDs|replace job IDs/);
  assert.match(text, /\.inflight/);
  assert.match(text, /allJobDocumentCoverage/);
  assert.match(text, /not permission|not a substitute|don't fabricate/);
  for (const path of [
    "scripts/prepare-company-embeddings.ts",
    "scripts/run-embedding-batch.ts",
    "scripts/verify-embedding-batch.ts",
    "lib/ai/embedding-config.ts",
    "lib/ai/embedding-batch-plan.ts",
  ]) {
    assert.ok(
      text.includes(path),
      `Missing canonical implementation reference ${path}`,
    );
    await access(path);
  }
});
