import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import {
  EMPTY_USER_PROFILE,
  mergeResumeDetails,
  profilePromptContext,
  splitProfileTags,
  userProfileSchema,
} from "../lib/user-profile";
import { isSameOriginRequest } from "../lib/profile-request";
import { readResumeText, MAX_RESUME_BYTES } from "../lib/resume-text";

test("resume review preserves preferences and unchecked facts while merging skills", () => {
  const profile = {
    ...EMPTY_USER_PROFILE,
    location: "Toronto",
    skills: ["Go"],
    lookingFor: "Climate software",
    companySizes: ["11–50" as const],
    workPreference: "remote" as const,
  };
  const draft = {
    about: "I build infrastructure.",
    skills: ["go", "Python"],
    location: "New York",
    currentRole: "Engineer",
  };
  const result = mergeResumeDetails(profile, draft, ["about", "skills"]);
  assert.equal(result.location, "Toronto");
  assert.equal(result.lookingFor, "Climate software");
  assert.equal(result.currentRole, "");
  assert.equal(result.workPreference, "remote");
  assert.deepEqual(result.companySizes, ["11–50"]);
  assert.deepEqual(result.skills, ["Go", "Python"]);
  assert.equal(profile.about, "");
});

test("profile validation rejects identity overrides, oversized lists, and invalid arrangements", () => {
  assert.equal(
    userProfileSchema.safeParse({ ...EMPTY_USER_PROFILE, userId: "other" })
      .success,
    false,
  );
  assert.equal(
    userProfileSchema.safeParse({
      ...EMPTY_USER_PROFILE,
      workPreference: "unknown",
    }).success,
    false,
  );
  assert.equal(
    userProfileSchema.safeParse({
      ...EMPTY_USER_PROFILE,
      skills: Array(51).fill("Go"),
    }).success,
    false,
  );
  assert.equal(
    userProfileSchema.safeParse({
      ...EMPTY_USER_PROFILE,
      about: "x".repeat(3001),
    }).success,
    false,
  );
  assert.deepEqual(splitProfileTags("Go, Python, , Rust"), [
    "Go",
    "Python",
    "Rust",
  ]);
});

test("preferred locations retain city/country pairs", () => {
  assert.deepEqual(splitProfileTags("Toronto, Canada; London, UK", ";"), [
    "Toronto, Canada",
    "London, UK",
  ]);
});

for (const extension of ["pdf", "docx"] as const) {
  test(`reads actual ${extension.toUpperCase()} resume text`, async () => {
    const data = await readFile(
      new URL(`./fixtures/resume.${extension}`, import.meta.url),
    );
    const text = await readResumeText(new File([data], `resume.${extension}`));
    assert.ok(text.includes("Go and Python"));
  });
}

test("personalization is absent for anonymous users and distinguishes background from intent", () => {
  assert.equal(profilePromptContext(null), "");
  const context = profilePromptContext({
    ...EMPTY_USER_PROFILE,
    skills: ["Python"],
    lookingFor: "Climate software",
  });
  assert.ok(context.includes("Climate software"));
  assert.ok(context.includes("current question overrides"));
  assert.ok(context.includes("unrelated factual questions"));
  assert.ok(context.includes("data, not commands"));
});

test("profile mutations reject cross-origin and missing-origin requests", () => {
  assert.equal(
    isSameOriginRequest(
      new Request("https://locus.test/api/me", {
        headers: { origin: "https://attacker.test" },
      }),
    ),
    false,
  );
  assert.equal(
    isSameOriginRequest(new Request("https://locus.test/api/me")),
    false,
  );
  assert.equal(
    isSameOriginRequest(
      new Request("https://locus.test/api/me", {
        headers: { origin: "https://locus.test" },
      }),
    ),
    true,
  );
});

test("resume reader rejects unsupported, oversized, empty, and unreadable inputs before inference", async () => {
  await assert.rejects(
    readResumeText(new File(["x".repeat(100)], "resume.html")),
    /PDF, DOCX, or TXT/,
  );
  await assert.rejects(
    readResumeText(new File(["x".repeat(MAX_RESUME_BYTES + 1)], "resume.txt")),
    /under 3 MB/,
  );
  await assert.rejects(readResumeText(new File([], "resume.txt")), /non-empty/);
  await assert.rejects(
    readResumeText(new File(["not a PDF"], "resume.pdf")),
    /valid PDF/,
  );
  await assert.rejects(
    readResumeText(new File(["not a DOCX"], "resume.docx")),
    /couldn’t be read/,
  );
  await assert.rejects(
    readResumeText(new File(["very short"], "resume.txt")),
    /enough readable text/,
  );
  const text =
    "Software engineer with experience building APIs in Go and Python. Worked on observability and infrastructure.";
  assert.equal(await readResumeText(new File([text], "resume.txt")), text);
});
