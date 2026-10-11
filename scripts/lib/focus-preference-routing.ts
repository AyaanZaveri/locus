type RecordValue = Record<string, any>;

export type PreferenceRoutingCall = {
  toolName: string;
  input: RecordValue;
  output?: RecordValue;
};

/** Trace assertions, not a judge of whether a job is objectively enjoyable. */
export function preferenceRoutingErrors(
  calls: PreferenceRoutingCall[],
  action: "navigate" | "present",
) {
  const errors: string[] = [];
  const check = (condition: boolean, message: string) => {
    if (!condition) errors.push(message);
  };
  const queries = calls.filter((c) => c.toolName === "queryJobs");
  const employer = calls
    .filter((c) => c.toolName === "searchLocus")
    .flatMap((c) => c.output?.companies ?? [])
    .find((c: RecordValue) => String(c.name).toLowerCase() === "cursor");
  check(Boolean(employer?.slug), "Expected verified Cursor identity lookup");
  check(
    !calls.some((c) => c.toolName === "queryCompanies"),
    "Named employer must not trigger conceptual company discovery",
  );
  check(queries.length > 0, "Expected job candidate retrieval");
  for (const query of queries) {
    const i = query.input;
    check(
      typeof i.semanticQuery === "string" && i.semanticQuery.trim().length > 0,
      "Subjective preference must supply semanticQuery",
    );
    check(
      i.resultMode === "candidates" &&
        i.limit === 15 &&
        i.sortBy === "relevance",
      "Expected hidden 15-role relevance candidate pool",
    );
    check(i.status === "openOrUnknown", "Expected recorded-role status scope");
    check(
      Array.isArray(i.companySlugs) &&
        i.companySlugs.length === 1 &&
        i.companySlugs[0] === employer?.slug,
      "Candidates must be scoped to the resolved employer",
    );
    check(
      !i.query && !i.title && !i.skills,
      "No inferred hard lexical filters",
    );
    check(
      query.output?.presentation?.mode === "candidatePool" &&
        query.output?.presentation?.displayedCounts?.jobs === 0,
      "Candidate jobs must not display as cards",
    );
    check(
      query.output?.retrieval?.mode === "semantic",
      "Expected actual semantic retrieval, not lexical fallback",
    );
  }
  const candidates = queries.flatMap((c) => c.output?.jobs ?? []);
  const navigations = calls.filter((c) => c.toolName === "navigateLocus");
  const presentations = calls.filter(
    (c) => c.toolName === "presentLocusResults",
  );
  const matchesCandidate = (slug: unknown, title: unknown, location: unknown) =>
    candidates.some(
      (c: RecordValue) =>
        c.companySlug === slug && c.title === title && c.location === location,
    );
  if (action === "navigate") {
    check(navigations.length === 1, "Expected exactly one navigation");
    check(presentations.length === 0, "Do not publish cards before navigation");
    const n = navigations[0]?.input;
    check(
      Boolean(
        n &&
        n.destination === "job" &&
        matchesCandidate(n.companySlug, n.jobTitle, n.jobLocation),
      ),
      "Navigation must target an exact retrieved job identity",
    );
    check(
      calls.indexOf(navigations[0]) > calls.indexOf(queries.at(-1)!),
      "Retrieve candidates before navigation",
    );
  } else {
    check(navigations.length === 0, "Shortlist requests must not navigate");
    check(presentations.length === 1, "Expected one shortlist presentation");
    const selected = presentations.flatMap((c) => c.output?.jobs ?? []);
    check(selected.length === 1, "Expected one presented job for 'the most'");
    check(
      presentations.every(
        (c) => !(c.output?.companies?.length || c.output?.people?.length),
      ),
      "Job shortlist must not publish unrelated entity cards",
    );
    check(
      calls.indexOf(presentations[0]) > calls.indexOf(queries.at(-1)!),
      "Retrieve candidates before presentation",
    );
    check(
      selected.every((c: RecordValue) =>
        matchesCandidate(c.companySlug, c.title, c.location),
      ),
      "Presented job must exactly match a retrieved candidate",
    );
  }
  return errors;
}
