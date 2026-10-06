import type { LocusModelId } from "../locus-models";

/** Luna defaults to medium reasoning upstream; keep interactive Focus light.
 * Do not send OpenAI-specific effort values to other models without verifying
 * their support. Resume extraction has its own separate settings.
 */
export function focusGenerationSettings(modelId: LocusModelId) {
  return modelId === "gpt-6-luna"
    ? { providerOptions: { openai: { reasoningEffort: "low" as const } } }
    : {};
}
