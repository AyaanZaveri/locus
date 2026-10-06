/** Retrieval pools are evidence for curation, not frontend recommendations. */
export function shouldDisplayLocusResult(output: unknown) {
  if (!output || typeof output !== "object" || !("presentation" in output))
    return true;
  const presentation = output.presentation;
  return !(
    presentation &&
    typeof presentation === "object" &&
    "mode" in presentation &&
    presentation.mode === "candidatePool"
  );
}
