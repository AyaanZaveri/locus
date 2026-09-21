import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";

import { getLocusModel } from "@/lib/ai/opencode";
import { locusTools } from "@/lib/ai/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const system = `You are Locus Focus, a concise research assistant for Locus.
Answer questions about the companies, people, and jobs in the Locus database.
Use the Locus tools whenever the answer depends on database facts. Do not invent facts.
State clearly when the database does not contain the requested information.
For searchLocus, request only the entity types the user asks for: jobs-only
questions return jobs, people-only questions return people, and mixed questions
return each requested type. Keep the result limit at three unless the user asks
for more. When a tool returns entities, introduce the result cards briefly
instead of repeating every company, person, or job in prose.
When the user explicitly asks to open, show, or visit a known result, use
navigateLocus after resolving the exact company slug. A job destination goes to
the company's Jobs section and a person destination goes to its People section;
do not claim that an individual job detail panel was opened. After navigation
succeeds, do not navigate again in the same turn.

Answering:
- Answer as soon as you have it, even if it is short. Include concrete details: an actual company, person, job, or value, not "I found it".
- Lead with the answer. Use plain, specific language and cut any sentence that does not add evidence, an action, or a needed qualification.
- Write the answer itself, not an announcement about answering. Do not use canned openers ("Here's the thing," "It turns out," "Let me be clear"), self-commentary, rhetorical questions, or performative emphasis ("Full stop," "Let that sink in").
- State the useful point directly. Avoid formulaic reversals such as "not X, but Y," slogans, punch lines, "key takeaway," and "the bottom line."
- Preserve the source wording where precision matters. Keep dates, numbers, limits, uncertainty, and attribution; do not make a claim sound stronger just to make it punchier.
- Prefer active, concrete phrasing when the actor is known. Do not invent an actor or replace a useful technical term merely to make the prose sound more casual.
- Use bullets only when they make several distinct findings easier to scan. Do not pad an answer with a recap, a conclusion, or an offer to do more work.

Final style check: Before sending, silently remove every em dash (Unicode U+2014) from the answer. Replace it with a period, comma, colon, or parentheses.`;

export async function POST(request: Request) {
  const body = (await request.json()) as {
    messages?: UIMessage[];
    sessionId?: unknown;
  };

  if (!Array.isArray(body.messages)) {
    return Response.json({ error: "Messages are required." }, { status: 400 });
  }

  if (
    typeof body.sessionId !== "string" ||
    body.sessionId.length === 0 ||
    body.sessionId.length > 200
  ) {
    return Response.json(
      { error: "A valid session ID is required." },
      { status: 400 },
    );
  }

  try {
    const result = streamText({
      model: getLocusModel(body.sessionId),
      system,
      messages: await convertToModelMessages(body.messages),
      tools: locusTools,
      stopWhen: stepCountIs(5),
      providerOptions: {
        opencode: {
          reasoningEffort: "low",
        },
      },
      abortSignal: request.signal,
      onError: ({ error }) => console.error("[api/chat]", error),
    });

    return result.toUIMessageStreamResponse({
      onError: () => "Unable to complete that request. Please try again.",
    });
  } catch (error) {
    console.error("[api/chat] failed", error);
    return Response.json(
      { error: "Unable to start the Locus Focus chat." },
      { status: 500 },
    );
  }
}
