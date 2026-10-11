import assert from "node:assert/strict";
import test from "node:test";
import {
  preferenceRoutingErrors,
  type PreferenceRoutingCall,
} from "../scripts/lib/focus-preference-routing";
import { withJobPresentation } from "../lib/ai/job-candidate-presentation";
import { toolRoutingPrompt } from "../lib/ai/tool-routing-prompt";
import { jobsQuerySchema } from "../lib/ai/jobs-query";
import { presentationPrompt } from "../lib/ai/presentation-prompt";

const job = {
  companySlug: "cursor",
  title: "Product Engineer",
  location: "San Francisco",
};
function trace(): PreferenceRoutingCall[] {
  return [
    {
      toolName: "searchLocus",
      input: { types: ["companies"] },
      output: { companies: [{ name: "Cursor", slug: "cursor" }] },
    },
    {
      toolName: "queryJobs",
      input: jobsQuerySchema.parse({
        companySlugs: ["cursor"],
        semanticQuery: "Varied work, experimentation and creative ownership",
        resultMode: "candidates",
        status: "openOrUnknown",
        sortBy: "relevance",
        limit: 15,
      }),
      output: withJobPresentation(
        { jobs: [job], retrieval: { mode: "semantic" } },
        "candidates",
      ),
    },
    {
      toolName: "navigateLocus",
      input: {
        companySlug: job.companySlug,
        destination: "job",
        jobTitle: job.title,
        jobLocation: job.location,
      },
    },
  ];
}

test("accepts hidden semantic candidates followed by exact job navigation", () => {
  assert.deepEqual(preferenceRoutingErrors(trace(), "navigate"), []);
});
test("rejects inventory routing, lexical filters and fallback for subjective preferences", () => {
  const calls = trace();
  calls[1].input = { companySlugs: ["cursor"], query: "fun", limit: 50 };
  calls[1].output = { jobs: [job], retrieval: { mode: "lexical-fallback" } };
  const errors = preferenceRoutingErrors(calls, "navigate");
  assert.ok(errors.some((e) => e.includes("semanticQuery")));
  assert.ok(errors.some((e) => e.includes("lexical filters")));
  assert.ok(errors.some((e) => e.includes("not display")));
  assert.ok(errors.some((e) => e.includes("not lexical fallback")));
});
test("rejects guessed jobs, wrong employer scope and cards before navigation", () => {
  const calls = trace();
  calls[1].input.companySlugs = ["unrelated"];
  calls[2].input.jobTitle = "Invented job";
  calls.push({
    toolName: "presentLocusResults",
    input: {},
    output: { jobs: [job] },
  });
  const errors = preferenceRoutingErrors(calls, "navigate");
  assert.ok(errors.some((e) => e.includes("resolved employer")));
  assert.ok(errors.some((e) => e.includes("exact retrieved")));
  assert.ok(errors.some((e) => e.includes("before navigation")));
});
test("shortlist must publish one retrieved job without navigating", () => {
  const calls = trace().slice(0, 2);
  calls.push({
    toolName: "presentLocusResults",
    input: {},
    output: { jobs: [job] },
  });
  assert.deepEqual(preferenceRoutingErrors(calls, "present"), []);
  calls[2].output = { jobs: [job, job] };
  assert.ok(
    preferenceRoutingErrors(calls, "present").some((e) =>
      e.includes("one presented"),
    ),
  );
});
test("rejects premature shortlist presentation and additional entity cards", () => {
  const calls = trace().slice(0, 2);
  calls.unshift({
    toolName: "presentLocusResults",
    input: {},
    output: { jobs: [job], companies: [{ slug: "other" }] },
  });
  const errors = preferenceRoutingErrors(calls, "present");
  assert.ok(errors.some((e) => e.includes("before presentation")));
  assert.ok(errors.some((e) => e.includes("unrelated entity cards")));
});
test("instructions cover profile-free preferences and navigation without mandatory presentation", () => {
  assert.match(toolRoutingPrompt, /A profile is not required/);
  assert.match(toolRoutingPrompt, /Contrastive JSON examples/);
  assert.match(presentationPrompt, /even without a profile/);
  assert.match(presentationPrompt, /navigateLocus directly/);
  const policy = withJobPresentation({ jobs: [job] }, "candidates").presentation
    .textPolicy;
  assert.match(policy, /work preference can be ranked without a profile/);
  assert.match(policy, /navigateLocus directly once/);
  assert.match(policy, /do not publish cards first/);
});

test("salary control does not prescribe navigation when salary evidence is missing", () => {
  assert.match(toolRoutingPrompt, /unknown, non-USD or non-annual/i);
  assert.match(
    toolRoutingPrompt,
    /otherwise explain the missing salary data without navigating/,
  );
});
