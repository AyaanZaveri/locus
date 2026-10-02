import { describeLocusTool } from "./locus-tool-trace";
import { usesCurrentCompanyPage } from "./locus-page-intent";

type ActivityMessage = {
  role: string;
  parts: ReadonlyArray<unknown>;
};

// Inspired by the concise verbs in claude-code-spinner-verbs. Pick one column
// per turn; never roll a new phrase during streaming or a React re-render.
const phrases = {
  initial: [
    "Pondering",
    "Perusing",
    "Mulling it over",
    "Considering",
    "Thinking it through",
    "Following the thread",
    "Deciphering",
    "Turning it over",
  ],
  page: [
    "Checking this page",
    "Reading this page",
    "Looking over this company",
    "Scanning this page",
    "Reading the company context",
    "Checking this company",
    "Taking in the page",
    "Looking at the details here",
  ],
  profile: [
    "Reading the company profile",
    "Perusing the profile",
    "Picking out the details",
    "Looking over the profile",
    "Reading the company details",
    "Checking the page details",
    "Taking in the profile",
    "Reading what's on the page",
  ],
  results: [
    "Checking the results",
    "Reading what turned up",
    "Sorting through the results",
    "Looking over the results",
    "Taking stock of the results",
    "Reviewing what came back",
    "Checking the matches",
    "Reading the results",
  ],
  writing: [
    "Putting it into words",
    "Writing it up",
    "Composing the reply",
    "Summing it up",
    "Pulling the answer together",
    "Synthesizing the answer",
    "Shaping the response",
    "Putting the answer together",
  ],
} as const;

export const LOCUS_ACTIVITY_VARIANT_COUNT = phrases.initial.length;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function initialLabel(
  question: string,
  pagePath: string | undefined,
  variant: number,
) {
  return usesCurrentCompanyPage(pagePath, question)
    ? phrases.page[variant]
    : phrases.initial[variant];
}

function activeToolLabel(part: Record<string, unknown>) {
  const input = record(part.input);

  if (part.type === "tool-getCompanyProfile") {
    switch (input.section) {
      case "funding":
        return "Checking the funding";
      case "activity":
        return "Reading recent activity";
      default:
        return "Reading the company profile";
    }
  }

  if (part.type === "tool-searchKnowledge") return "Searching the evidence";
  if (part.type === "tool-searchLocus") return "Searching the directory";
  return describeLocusTool(part)?.label ?? "Getting oriented";
}

/** Status copy follows streamed, observable events rather than invented thoughts. */
export function getLocusActivityLabel(
  messages: ReadonlyArray<ActivityMessage>,
  pagePath?: string,
  variant = 0,
) {
  const phraseIndex =
    ((variant % LOCUS_ACTIVITY_VARIANT_COUNT) + LOCUS_ACTIVITY_VARIANT_COUNT) %
    LOCUS_ACTIVITY_VARIANT_COUNT;
  const lastUserIndex = messages.findLastIndex(
    (message) => message.role === "user",
  );
  const question =
    messages[lastUserIndex]?.parts
      .map((part) => record(part))
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join(" ") ?? "";
  const assistant = messages
    .slice(lastUserIndex + 1)
    .findLast((message) => message.role === "assistant");
  if (!assistant) return initialLabel(question, pagePath, phraseIndex);

  for (const rawPart of [...assistant.parts].reverse()) {
    const part = record(rawPart);
    if (
      part.type === "text" &&
      typeof part.text === "string" &&
      part.text.trim()
    ) {
      return phrases.writing[phraseIndex];
    }

    if (typeof part.type === "string" && part.type.startsWith("tool-")) {
      if (
        part.state === "input-streaming" ||
        part.state === "input-available"
      ) {
        return activeToolLabel(part);
      }
      if (part.state === "output-available" || part.state === "output-error") {
        return phrases.results[phraseIndex];
      }
    }

    if (part.type === "data-pageContext") return phrases.profile[phraseIndex];
  }

  return initialLabel(question, pagePath, phraseIndex);
}
