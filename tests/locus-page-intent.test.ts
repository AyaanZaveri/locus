import assert from "node:assert/strict";
import { test } from "node:test";

import { usesCurrentCompanyPage } from "../lib/locus-page-intent";

test("looks at the current company only for page-relevant questions", () => {
  const page = "/company/mintlify";
  for (const question of [
    "What does this company do?",
    "How many employees does it have?",
    "Recommend a job here",
    "What does Mintlify do?",
    "What about funding?",
    "Compare this company with Anthropic",
  ]) {
    assert.equal(usesCurrentCompanyPage(page, question), true, question);
  }

  for (const question of [
    "Which companies mention SOC 2 Type 1 certification?",
    "Find jobs at Anthropic",
    "Search for other companies hiring in SF",
    "Recommend full-stack roles across companies",
  ]) {
    assert.equal(usesCurrentCompanyPage(page, question), false, question);
  }
  assert.equal(
    usesCurrentCompanyPage("/companies", "What does this company do?"),
    false,
  );
  assert.equal(
    usesCurrentCompanyPage("/company/not/valid", "What does this company do?"),
    false,
  );
});
