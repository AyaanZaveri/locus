/** Decide whether a turn refers to the current company, before loading its profile. */
export function usesCurrentCompanyPage(pagePath: unknown, question: string) {
  if (typeof pagePath !== "string") return false;
  const slug = /^\/company\/([a-z0-9-]{1,100})\/?$/.exec(pagePath)?.[1];
  if (!slug) return false;

  const lower = question.toLowerCase();
  const words = lower.replace(/[^a-z0-9]/g, "");
  const slugWords = slug.replace(/-/g, "");
  if (slugWords.length > 3 && words.includes(slugWords)) return true;

  if (
    /\b(this company|this page|this team|this role|this job|here|on this page|at this company|the current company)\b/i.test(
      lower,
    )
  ) {
    return true;
  }

  // Pronouns are only a page reference when the question is not asking for a
  // cross-company search. This is a conservative hint, not a claim about what
  // the model ultimately researches.
  if (
    /\b(which|find|search|show|list|all|other)\b.*\b(companies|people|jobs|roles)\b/i.test(
      lower,
    )
  ) {
    return false;
  }

  return (
    /\b(it|its|they|their)\b/i.test(lower) ||
    /\b(the company|what about (?:jobs|funding|people|the team|employees|activity))\b/i.test(
      lower,
    )
  );
}
