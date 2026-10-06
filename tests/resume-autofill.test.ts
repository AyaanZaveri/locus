import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_USER_PROFILE, mergeResumeDetails } from "../lib/user-profile";

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
