import { ZodError } from "zod";
import { MAX_PROFILE_SKILLS } from "@/lib/user-profile";

export function resumeImportErrorMessage(failure: unknown) {
  if (failure instanceof ZodError) {
    if (
      failure.issues.some(
        (issue) => issue.path[0] === "skills" && issue.code === "too_big",
      )
    ) {
      return `Your combined skill list exceeds ${MAX_PROFILE_SKILLS} items. Shorten your skills list and try again.`;
    }
    return "Some resume details couldn’t be imported. Try again or enter them manually.";
  }
  if (failure instanceof TypeError)
    return "Couldn’t connect to resume import. Please try again.";
  return failure instanceof Error
    ? failure.message
    : "Try again or fill in your details manually.";
}
