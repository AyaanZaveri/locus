export type EmbeddingDocument = {
  key: string;
  recipe: string;
  text: string;
  tokens: number;
};

export const PRICE_PER_MILLION = 0.12;
export const BATCH_TOKEN_LIMIT = 90_000;
export const BATCH_INPUT_LIMIT = 128;
export const TOKEN_MARGIN_PER_INPUT = 64;

const MAX_INPUT_TOKENS = 32_000;

/** Deduplicate by cache key, then form stable, recipe-homogeneous API batches. */
export function planEmbeddingRequests(
  documents: EmbeddingDocument[],
): EmbeddingDocument[][] {
  const byKey = new Map<string, EmbeddingDocument>();
  for (const document of documents) {
    if (
      !document ||
      typeof document.key !== "string" ||
      !document.key.length ||
      typeof document.recipe !== "string" ||
      !document.recipe.length ||
      typeof document.text !== "string" ||
      !document.text.trim() ||
      !Number.isSafeInteger(document.tokens) ||
      document.tokens <= 0
    ) {
      throw new Error(
        "Invalid embedding document; key, recipe, text, and positive integer tokens are required",
      );
    }
    const prior = byKey.get(document.key);
    if (prior) {
      if (
        prior.text !== document.text ||
        prior.recipe !== document.recipe ||
        prior.tokens !== document.tokens
      ) {
        throw new Error(
          `Conflicting embedding text for duplicate key: ${document.key}`,
        );
      }
      continue;
    }
    const accounted = document.tokens + TOKEN_MARGIN_PER_INPUT;
    if (accounted > MAX_INPUT_TOKENS) {
      throw new Error(
        `Embedding input ${document.key} exceeds ${MAX_INPUT_TOKENS} tokens including margin`,
      );
    }
    byKey.set(document.key, document);
  }

  const batches: EmbeddingDocument[][] = [];
  let batch: EmbeddingDocument[] = [];
  let recipe: string | undefined;
  let tokens = 0;
  for (const document of byKey.values()) {
    const cost = document.tokens + TOKEN_MARGIN_PER_INPUT;
    if (
      batch.length &&
      (document.recipe !== recipe ||
        batch.length >= BATCH_INPUT_LIMIT ||
        tokens + cost > BATCH_TOKEN_LIMIT)
    ) {
      batches.push(batch);
      batch = [];
      tokens = 0;
    }
    recipe = document.recipe;
    batch.push(document);
    tokens += cost;
  }
  if (batch.length) batches.push(batch);
  return batches;
}
