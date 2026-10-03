import "server-only";

import { createOpenAI } from "@ai-sdk/openai";

const baseURL = "https://opencode.ai/zen/go/v1";
const userAgent = "locus/1.0";

/**
 * OpenCode uses this opaque ID for routing and prompt-cache affinity. It is a
 * stable per-conversation identifier, never a credential.
 */
export function getLocusModel(sessionId: string) {
  const apiKey = process.env.OPENCODE_GO_API_KEY;

  if (!apiKey) {
    throw new Error("OPENCODE_GO_API_KEY is not configured.");
  }

  // GPT 6 Luna uses the Responses protocol on Go.
  return createOpenAI({
    baseURL,
    apiKey,
    headers: {
      "x-opencode-session": sessionId,
      "user-agent": userAgent,
    },
  }).responses("gpt-6-luna");
}
