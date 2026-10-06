import assert from "node:assert/strict";
import test from "node:test";
import { resumeImportErrorMessage } from "../lib/resume-import-error";
import { EMPTY_USER_PROFILE, userProfileSchema } from "../lib/user-profile";

test("skills validation is explained without raw Zod details", () => {
  const parsed = userProfileSchema.safeParse({
    ...EMPTY_USER_PROFILE,
    skills: Array.from({ length: 201 }, (_, index) => `Skill ${index}`),
  });
  assert.equal(parsed.success, false);
  if (parsed.success) return;
  const message = resumeImportErrorMessage(parsed.error);
  assert.match(message, /200 items/);
  assert.doesNotMatch(message, /origin|too_big|maximum|inclusive|path|\[|\{/);
});

test("other invalid output produces readable copy, not a schema dump", () => {
  const parsed = userProfileSchema.safeParse({
    ...EMPTY_USER_PROFILE,
    location: 123,
  });
  if (parsed.success) throw new Error("Expected invalid input");
  assert.equal(
    resumeImportErrorMessage(parsed.error),
    "Some resume details couldn’t be imported. Try again or enter them manually.",
  );
  assert.equal(
    resumeImportErrorMessage(new Error("Choose a resume under 3 MB.")),
    "Choose a resume under 3 MB.",
  );
});
