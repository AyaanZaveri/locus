import { createHash } from "node:crypto";

export const EMBEDDING_MODEL = "voyage/voyage-4-large";
export const EMBEDDING_DIMENSIONS = 1024;
export const JOB_EMBEDDING_RECIPE = "job-description-canary-v1";
export const COMPANY_EMBEDDING_RECIPE = "company-about-canary-v1";
export const QUERY_EMBEDDING_RECIPE = "semantic-query-v1";
export type EmbeddingInputType = "document" | "query";

export function embeddingKey(
  text: string,
  inputType: EmbeddingInputType,
  recipe: string,
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        modelId: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
        recipe,
        inputType,
        text,
      }),
    )
    .digest("hex");
}

export function validateEmbedding(vector: unknown): asserts vector is number[] {
  if (
    !Array.isArray(vector) ||
    vector.length !== EMBEDDING_DIMENSIONS ||
    !vector.every(
      (value) => typeof value === "number" && Number.isFinite(value),
    ) ||
    !vector.some((value) => value !== 0)
  ) {
    throw new Error(
      `Invalid embedding; expected ${EMBEDDING_DIMENSIONS} finite, non-zero values`,
    );
  }
}

export function jobEmbeddingText(job: {
  title: string;
  department: string | null;
  focus: string;
  skills: string[];
  description: string;
  companyName: string;
}) {
  return `Company: ${job.companyName}\nTitle: ${job.title}\nTeam: ${job.department ?? job.focus}\nSkills: ${job.skills.join(", ")}\nDescription:\n${job.description}`;
}

export function companyEmbeddingText(company: {
  name: string;
  industry: string;
  tagline: string | null;
  description: string;
}) {
  return `Company: ${company.name}\nIndustry: ${company.industry}\nTagline: ${company.tagline}\nAbout: ${company.description}`;
}
