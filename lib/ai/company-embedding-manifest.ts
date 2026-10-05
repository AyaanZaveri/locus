import { createHash } from "node:crypto";
import {
  COMPANY_EMBEDDING_RECIPE,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  JOB_EMBEDDING_RECIPE,
  companyEmbeddingText,
  embeddingKey,
  jobEmbeddingText,
} from "./embedding-config";

export type CompanyEmbeddingCompany = {
  slug: string;
  name: string;
  industry: string;
  tagline: string | null;
  description: string;
};

export type CompanyEmbeddingJob = {
  title: string;
  department: string | null;
  focus: string;
  skills: string[];
  description: string | null;
  companyName: string;
};

export type CompanyEmbeddingManifest = {
  version: 1;
  status: "planned";
  snapshotDate: string;
  scope: ["company-about", "job-descriptions"];
  modelId: string;
  dimensions: number;
  batches: Array<{
    id: string;
    status: "planned";
    companySlugs: [string];
    companyCount: 1;
    jobCount: number;
  }>;
};

export function isStrictCompanySlug(slug: string) {
  return slug.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function createCompanyEmbeddingManifest(
  company: CompanyEmbeddingCompany,
  jobs: CompanyEmbeddingJob[],
  now: Date = new Date(),
): CompanyEmbeddingManifest {
  if (!isStrictCompanySlug(company.slug))
    throw new Error("Invalid company slug");
  for (const field of ["name", "industry", "description"] as const) {
    if (typeof company[field] !== "string" || !company[field].trim()) {
      throw new Error(`Missing company ${field}`);
    }
  }
  if (company.tagline !== null && typeof company.tagline !== "string")
    throw new Error("Invalid company tagline");

  const keys = [
    embeddingKey(
      companyEmbeddingText(company),
      "document",
      COMPANY_EMBEDDING_RECIPE,
    ),
    ...jobs.map((job, index) => {
      if (!job.description?.trim()) {
        throw new Error(
          `Missing job description for ${company.slug} job #${index + 1}; cannot embed a summary or guessed content.`,
        );
      }
      if (
        !job.title?.trim() ||
        !job.focus?.trim() ||
        !job.companyName?.trim() ||
        !Array.isArray(job.skills) ||
        !job.skills.every((skill) => typeof skill === "string") ||
        (job.department !== null && typeof job.department !== "string")
      ) {
        throw new Error(
          `Invalid required job fields for ${company.slug} job #${index + 1}`,
        );
      }
      return embeddingKey(
        jobEmbeddingText(job as CompanyEmbeddingJob & { description: string }),
        "document",
        JOB_EMBEDDING_RECIPE,
      );
    }),
  ];
  const id = `${company.slug}-${createHash("sha256")
    .update([...keys].sort().join(","))
    .digest("hex")
    .slice(0, 16)}`;
  return {
    version: 1,
    status: "planned",
    snapshotDate: now.toISOString().slice(0, 10),
    scope: ["company-about", "job-descriptions"],
    modelId: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    batches: [
      {
        id,
        status: "planned",
        companySlugs: [company.slug],
        companyCount: 1,
        jobCount: jobs.length,
      },
    ],
  };
}
