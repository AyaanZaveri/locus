import { withResultPresentation } from "./result-presentation";

export function withJobPresentation<T extends { jobs: unknown[] }>(
  result: T,
  mode?: "inline" | "candidates",
) {
  if (mode !== "candidates") return withResultPresentation(result);
  return {
    ...result,
    presentation: {
      mode: "candidatePool",
      candidateCount: result.jobs.length,
      displayedCounts: { companies: 0, people: 0, jobs: 0 },
      textPolicy:
        "These are undisplayed candidates, not recommendations. Compare responsibilities, requirementsExcerpt, stated experience, seniority, location and eligibility with the user's evidenced background. Product similarity or semanticScore alone is not job fit. Choose only defensible candidates, prefer distinct companies when equally suitable, and call presentLocusResults with exact companySlug/title/location identities, sort input and the requested shortlist count (default 3). Do not display the whole pool or invent qualifications. If no role is a defensible fit, explain the limitation rather than forcing three recommendations.",
    },
  };
}
