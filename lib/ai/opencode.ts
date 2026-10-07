import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";
import {
  DEFAULT_LOCUS_MODEL,
  LOCUS_MODELS,
  type LocusModelId,
} from "@/lib/locus-models";

const baseURL = "https://opencode.ai/zen/go/v1";
const userAgent = "locus/1.0";

/**
 * OpenCode uses this opaque ID for routing and prompt-cache affinity. It is a
 * stable per-conversation identifier, never a credential.
 */
export function getLocusModel(
  sessionId: string,
  modelId: LocusModelId = DEFAULT_LOCUS_MODEL,
) {
  const apiKey = process.env.OPENCODE_GO_API_KEY;

  if (!apiKey) {
    throw new Error("OPENCODE_GO_API_KEY is not configured.");
  }

  const headers = { "x-opencode-session": sessionId, "user-agent": userAgent };
  const model = LOCUS_MODELS.find((option) => option.id === modelId)!;
  if (model.protocol === "anthropic") {
    return createAnthropic({
      baseURL,
      apiKey,
      headers,
    })(modelId);
  }
  if (model.protocol === "chat") {
    return createOpenAICompatible({
      name: "opencode",
      baseURL,
      apiKey,
      headers,
      includeUsage: true,
    }).chatModel(modelId);
  }
  // Luna and Muse use Responses; the other options use Chat Completions.
  return createOpenAI({
    baseURL,
    apiKey,
    headers,
  }).responses(modelId);
}
