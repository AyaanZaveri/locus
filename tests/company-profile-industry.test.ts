import assert from "node:assert/strict";
import test from "node:test";
import { companyProfileSchema } from "../lib/company-profile";

test("company profiles accept the Job Search industry used by HiringCafe", () => {
  assert.equal(
    companyProfileSchema.shape.industry.parse("Job Search"),
    "Job Search",
  );
});

test("company profiles accept new industry labels without a schema update", () => {
  for (const industry of ["Healthcare", "Climate Technology", "Robotics"]) {
    assert.equal(companyProfileSchema.shape.industry.parse(industry), industry);
  }
});

test("industry labels are trimmed without changing capitalization", () => {
  assert.equal(
    companyProfileSchema.shape.industry.parse("  AI Inference  "),
    "AI Inference",
  );
});

test("industry labels must be non-empty strings", () => {
  for (const industry of ["", " \t\n ", null, undefined, 123]) {
    assert.equal(
      companyProfileSchema.shape.industry.safeParse(industry).success,
      false,
    );
  }
});
