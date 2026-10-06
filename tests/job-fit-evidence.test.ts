import assert from "node:assert/strict";
import test from "node:test";
import { jobFitEvidence } from "../lib/ai/job-fit-evidence";

test("requirements survive long introductions and preserve experience ranges", () => {
  for (const [heading, requirement] of [
    ["## Requirements", "3+ years of experience building software."],
    ["**Who You Are**", "You have 5-8 years of full-stack experience."],
    [
      "### What You Bring to the Table",
      "Staff-level engineer with 7-8+ years of experience.",
    ],
  ]) {
    assert.equal(
      jobFitEvidence(
        `${"Company context. ".repeat(200)}\n${heading}\n${requirement}`,
      ).requirementsExcerpt,
      requirement,
    );
  }
});

test("skill evidence never invents years; responsibilities are not requirements", () => {
  const skills =
    "Polished React and Next.js skills; backend API experience required.";
  assert.equal(
    jobFitEvidence(`Qualifications:\n${skills}`).requirementsExcerpt,
    skills,
  );
  assert.deepEqual(
    jobFitEvidence(
      "## What You'll Do\nBuild APIs using React and backend services.",
    ),
    {},
  );
  assert.deepEqual(
    jobFitEvidence(
      "We are a fast-growing company.\n## Requirements\nA collaborative team player.",
    ),
    {},
  );
});

test("requirement evidence is bounded", () => {
  assert.equal(
    jobFitEvidence(
      `## Requirements\n${"Experience with React and Next.js. ".repeat(100)}`,
    ).requirementsExcerpt?.length,
    1000,
  );
});

test("new sections stop requirements; tenure perks are not experience requirements", () => {
  const result = jobFitEvidence(
    "## What You Will Bring\nExperience with React.\n## What You Could Do\nBuild backend APIs.\n## Benefits\nPaid month off after 4 years and every 2 years thereafter.",
  );
  assert.equal(result.requirementsExcerpt, "Experience with React.");
  assert.deepEqual(
    jobFitEvidence("Benefits:\nSabbatical: 3 paid months off after 4 years."),
    {},
  );
});
