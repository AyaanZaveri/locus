import assert from "node:assert/strict";
import test from "node:test";
import { companyProfileSchema } from "../lib/company-profile";

test("company profiles accept the Job Search industry used by HiringCafe", () => {
  assert.equal(
    companyProfileSchema.shape.industry.parse("Job Search"),
    "Job Search",
  );
});
