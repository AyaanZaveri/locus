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
        "These are undisplayed candidates, not recommendations. Compare responsibilities with the user's stated work preferences; for personal fit also compare requirementsExcerpt, stated experience, seniority, location and eligibility with evidenced background. A work preference can be ranked without a profile, but do not claim personalized suitability or objective enjoyment. Product similarity or semanticScore alone is not job fit. For an explicit open/go-to request, call navigateLocus directly once with the selected candidate's exact companySlug/title/location; do not publish cards first. Otherwise call presentLocusResults with verified identities, sort input and the requested shortlist count (one for 'the most' or 'a job', otherwise default 3), preferring distinct companies when equally suitable. Do not display the whole pool or invent qualifications. If no role is defensible, explain the limitation rather than forcing recommendations.",
    },
  };
}
