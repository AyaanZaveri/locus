const MAX_EXCERPT_LENGTH = 1000;

const REQUIREMENT_HEADINGS = [
  "who you are",
  "what you bring",
  "what you will bring",
  "requirements",
  "qualifications",
  "desired experience",
  "minimum qualifications",
  "preferred qualifications",
  "what we're looking for",
  "what we’re looking for",
  "you may be a good fit if",
  "what you bring to the table",
];

const RESPONSIBILITY_HEADINGS = [
  "what you'll do",
  "what you will do",
  "what you could do",
  "responsibilities",
  "the role",
  "your role",
  "benefits",
  "perks",
  "compensation",
  "compensation philosophy",
  "logistics",
];

const headingText = (line: string) =>
  line
    .replace(/^\s{0,3}#{1,6}\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/\s*:?\s*$/, "")
    .trim()
    .toLowerCase();

const isHeading = (line: string, names: string[]) =>
  names.includes(headingText(line));

const isSubstantive = (text: string) =>
  /\b(?:\d+\s*\+?\s*years?|years?\s+of\s+experience|experience\s+with|proficien(?:t|cy)\s+in|expertise\s+in|strong\s+(?:knowledge|background)|familiar(?:ity)?\s+with|ability\s+to|skilled\s+in|you have|we're looking for|looking for|must have|required|preferred|polished|react|next\.js|backend|api)\b/i.test(
    text,
  );

/** Pulls source-grounded qualification evidence from a job description. */
export function jobFitEvidence(description: string): {
  requirementsExcerpt?: string;
} {
  const lines = description.split(/\r?\n/);
  const collected: string[] = [];
  let inRequirements = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (isHeading(line, REQUIREMENT_HEADINGS)) {
      inRequirements = true;
      continue;
    }
    if (isHeading(line, RESPONSIBILITY_HEADINGS)) {
      inRequirements = false;
      continue;
    }

    // Any new section ends the requirement section, including unknown headings.
    if (/^#{1,6}\s|^\*\*[^*]+:?\*\*\s*$/.test(line)) {
      inRequirements = false;
      continue;
    }

    if (inRequirements) collected.push(line);
    else if (
      !inRequirements &&
      /\b\d+(?:\s*[-–]\s*\d+)?\s*\+?\s*years?\b/i.test(line) &&
      /\bexperience\b/i.test(line) &&
      !/\b(sabbatical|paid|benefits?|vacation)\b/i.test(line)
    ) {
      collected.push(line);
    }
  }

  const excerpt = collected.join(" ").replace(/\s+/g, " ").trim();
  if (!excerpt || !isSubstantive(excerpt)) return {};
  return { requirementsExcerpt: excerpt.slice(0, MAX_EXCERPT_LENGTH) };
}
