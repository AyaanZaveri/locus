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
Keep answers compact and include useful company or job links when a tool returns them.`;

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
