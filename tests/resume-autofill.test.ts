import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_USER_PROFILE,
  mergeResumeDetails,
  resumeDetailsSchema,
  MAX_PROFILE_BACKGROUND_CHARACTERS,
  userProfileSchema,
  profilePromptContext,
} from "../lib/user-profile";

test("re-uploading a skill-rich resume deduplicates before enforcing list limits", () => {
  const skills = Array.from({ length: 40 }, (_, i) => `Skill ${i}`);
  const merged = mergeResumeDetails(
    { ...EMPTY_USER_PROFILE, skills },
    { skills: skills.map((skill) => skill.toUpperCase()) },
    ["skills"],
  );
  assert.deepEqual(merged.skills, skills);
});

test("resume autofill preserves more than 50 distinct skills across profile and import", () => {
  const existing = Array.from({ length: 40 }, (_, i) => `Existing ${i}`);
  const imported = Array.from({ length: 40 }, (_, i) => `Imported ${i}`);
  const merged = mergeResumeDetails(
    { ...EMPTY_USER_PROFILE, skills: existing },
    { skills: imported },
    ["skills"],
  );
  assert.deepEqual(merged.skills, [...existing, ...imported]);
});

test("resume autofill updates existing facts without changing preferences or saving", () => {
  const profile = {
    ...EMPTY_USER_PROFILE,
    skills: ["TypeScript"],
    lookingFor: "Developer tools",
    desiredRoles: ["Founding engineer"],
    workPreference: "remote" as const,
  };
  const result = mergeResumeDetails(
    profile,
    {
      location: "Toronto, Canada",
      currentRole: "Software engineer",
      skills: ["typescript", "Python"],
      about: "I build search tools.",
    },
    ["location", "currentRole", "skills", "about"],
  );
  assert.equal(result.location, "Toronto, Canada");
  assert.equal(result.currentRole, "Software engineer");
  assert.equal(result.about, "I build search tools.");
  assert.deepEqual(result.skills, ["TypeScript", "Python"]);
  assert.equal(result.lookingFor, profile.lookingFor);
  assert.deepEqual(result.desiredRoles, profile.desiredRoles);
  assert.equal(result.workPreference, profile.workPreference);
  assert.equal(profile.location, "");
});

test("missing resume facts do not clear existing fields", () => {
  const profile = {
    ...EMPTY_USER_PROFILE,
    location: "Toronto, Canada",
    currentRole: "Engineer",
  };
  const result = mergeResumeDetails(
    profile,
    { about: "", location: "", currentRole: "", skills: [] },
    ["location", "currentRole", "skills", "about"],
  );
  assert.deepEqual(result, profile);
});

const nextRoleDraft = resumeDetailsSchema.parse({
  about: "I build APIs.",
  linkedin: "https://linkedin.com/in/example",
  github: "",
  portfolio: "",
  skills: ["TypeScript"],
  location: "Toronto, Ontario, Canada",
  currentRole: "Backend engineer",
  desiredRoles: ["Backend engineer", "Platform engineer"],
  lookingFor: "I'd like to build reliable APIs and backend systems.",
  dealBreakers: "Frequent travel",
  desiredLocations: ["Toronto, Ontario, Canada"],
  workPreference: "hybrid",
  openToRelocation: true,
  companySizes: ["11–50"],
});

test("detailed resume background survives extraction validation, merge, save validation and Focus context", () => {
  const about =
    "## Experience\nExample Co · Engineer · Jan 2020–Dec 2023 (4 years)\n- Built APIs and led migrations.\n## Projects\nSearch tool · https://example.com\n- Go, PostgreSQL; reduced latency by 40%.\n" +
    "Documented resume detail. ".repeat(500);
  assert.ok(about.length > 3000);
  const details = resumeDetailsSchema.parse({ ...nextRoleDraft, about });
  const merged = mergeResumeDetails(EMPTY_USER_PROFILE, details, ["about"]);
  const saved = userProfileSchema.parse(merged);
  assert.equal(saved.about, about.trim());
  assert.ok(profilePromptContext(saved).includes(JSON.stringify(saved.about)));
  assert.equal(
    userProfileSchema.safeParse({
      ...saved,
      about: "x".repeat(MAX_PROFILE_BACKGROUND_CHARACTERS),
    }).success,
    true,
  );
  assert.equal(
    resumeDetailsSchema.safeParse({
      ...details,
      about: "x".repeat(MAX_PROFILE_BACKGROUND_CHARACTERS + 1),
    }).success,
    false,
  );
});
const allResumeFields = Object.keys(nextRoleDraft) as Array<
  keyof typeof nextRoleDraft
>;

test("resume autofill fills empty next-role fields as an unsaved draft", () => {
  const result = mergeResumeDetails(
    EMPTY_USER_PROFILE,
    nextRoleDraft,
    allResumeFields,
  );
  assert.deepEqual(result.desiredRoles, nextRoleDraft.desiredRoles);
  assert.equal(result.lookingFor, nextRoleDraft.lookingFor);
  assert.equal(result.dealBreakers, "Frequent travel");
  assert.deepEqual(result.desiredLocations, nextRoleDraft.desiredLocations);
  assert.equal(result.workPreference, "hybrid");
  assert.equal(result.openToRelocation, true);
  assert.deepEqual(result.companySizes, ["11–50"]);
  assert.equal(EMPTY_USER_PROFILE.lookingFor, "");
});

test("AI suggestions do not overwrite authored next-role preferences", () => {
  const profile = {
    ...EMPTY_USER_PROFILE,
    desiredRoles: ["Founding engineer"],
    lookingFor: "Climate software",
    dealBreakers: "On-call",
    desiredLocations: ["London, England, United Kingdom"],
    workPreference: "remote" as const,
    openToRelocation: true,
    companySizes: ["1–10" as const],
  };
  const result = mergeResumeDetails(
    profile,
    { ...nextRoleDraft, openToRelocation: false },
    allResumeFields,
  );
  for (const field of [
    "desiredRoles",
    "lookingFor",
    "dealBreakers",
    "desiredLocations",
    "workPreference",
    "openToRelocation",
    "companySizes",
  ] as const) {
    assert.deepEqual(result[field], profile[field]);
  }
});

test("unstated practical preferences remain empty while suggested role text fills", () => {
  const details = resumeDetailsSchema.parse({
    ...nextRoleDraft,
    dealBreakers: "",
    desiredLocations: [],
    workPreference: null,
    openToRelocation: null,
    companySizes: [],
  });
  const result = mergeResumeDetails(
    EMPTY_USER_PROFILE,
    details,
    allResumeFields,
  );
  assert.equal(result.workPreference, "any");
  assert.equal(result.openToRelocation, false);
  assert.deepEqual(result.desiredLocations, []);
  assert.deepEqual(result.companySizes, []);
  assert.equal(result.dealBreakers, "");
  assert.equal(result.lookingFor, nextRoleDraft.lookingFor);
});
