import "server-only";

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

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

  return createOpenAICompatible({
    name: "opencode",
    baseURL,
    apiKey,
    headers: {
      "x-opencode-session": sessionId,
      "user-agent": userAgent,
    },
    includeUsage: true,
  }).chatModel("deepseek-v4.1-flash");
}
