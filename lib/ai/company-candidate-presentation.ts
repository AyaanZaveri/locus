import { withResultPresentation } from "./result-presentation";

export function withCompanyPresentation<
  T extends {
    companies: unknown[];
    unrankedCompanies?: unknown[];
    retrieval?: unknown;
  },
>(result: T, mode?: "inline" | "candidates") {
  if (mode !== "candidates") return withResultPresentation(result);
  const candidateCount =
    result.companies.length + (result.unrankedCompanies?.length ?? 0);
  const retrieval = result.retrieval;
  const eligible =
    retrieval && typeof retrieval === "object" && "eligibleRecords" in retrieval
      ? retrieval.eligibleRecords
      : undefined;
  const rows = [...result.companies, ...(result.unrankedCompanies ?? [])];
  const slugs = rows.map((row) =>
    row &&
    typeof row === "object" &&
    "slug" in row &&
    typeof row.slug === "string"
      ? row.slug.trim()
      : "",
  );
  const completeEligiblePool =
    typeof eligible === "number" &&
    Number.isFinite(eligible) &&
    eligible >= 0 &&
    slugs.every(Boolean) &&
    new Set(slugs).size >= eligible;
  return {
    ...result,
    presentation: {
      mode: "candidatePool",
      candidateCount,
      completeEligiblePool,
      displayedCounts: { companies: 0, people: 0, jobs: 0 },
      textPolicy:
        (completeEligiblePool
          ? "All eligible recorded companies under these exact filters are already included across both arrays. Do not repeat company discovery by rephrasing semanticQuery under the same filters: it cannot find additional companies in this set. Proceed to role retrieval for the defensible companies, or explain insufficient product overlap. This does not mean all candidates are relevant or that all have vectors. "
          : "") +
        "Hidden company evidence, not displayed cards or a final recommendation. Judge PRODUCT and user/use-case similarity from descriptionExcerpt, not generic AI/search buzzwords or shared skills. Also review unrankedCompanies: these satisfy the same original exact/relation filters but lack current company vectors; no semantic score is not evidence of irrelevance. They are a separate bounded unranked supplement and are not included in vector candidate counts. Select relevant verified company slugs, then call queryJobs(resultMode candidates, limit 15, companySlugs selected) to assess role fit. Preserve funding/date and other exact constraints; nested job previews are not personalized rankings. If no defensible company match exists, explain rather than force unrelated neighbors.",
    },
  };
}
