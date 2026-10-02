import { z } from "zod";

export const presentationOptionsSchema = z.object({
  sort: z
    .enum(["input", "nameAsc", "nameDesc"])
    .default("input")
    .describe(
      "input preserves evidence/ranking order; nameAsc/nameDesc sorts verified labels in code.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(50)
    .describe(
      "Maximum total cards across companies, people and jobs. Set to the requested count.",
    ),
});

type Row = {
  name?: unknown;
  title?: unknown;
  slug?: unknown;
  companySlug?: unknown;
  location?: unknown;
};
type Groups = { companies: Row[]; people: Row[]; jobs: Row[] };

/** The UI renders groups in this order; sort within each group, then cap globally. */
export function selectPresentation<T extends Groups>(
  groups: T,
  options: z.infer<typeof presentationOptionsSchema>,
): T {
  let remaining = options.limit;
  const result = { ...groups };
  for (const key of ["companies", "people", "jobs"] as const) {
    const seen = new Set<string>();
    const rows = groups[key].filter((row) => {
      const identity = JSON.stringify([
        row.slug ?? row.companySlug,
        row.name ?? row.title,
        row.location,
      ]);
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
    if (options.sort !== "input") {
      const direction = options.sort === "nameAsc" ? 1 : -1;
      rows.sort(
        (a, b) =>
          direction *
          String(a.name ?? a.title ?? "").localeCompare(
            String(b.name ?? b.title ?? ""),
            "en",
            { sensitivity: "base" },
          ),
      );
    }
    result[key] = rows.slice(0, remaining) as T[typeof key];
    remaining -= result[key].length;
  }
  return result;
}

/** Mirrors automatic cards in locus-chat, without changing the existing payload. */
export function withResultPresentation<T extends object>(
  result: T,
  kind: "entities" | "rounds" | "activity" = "entities",
) {
  const data = result as Record<string, unknown>;
  const arrays = (key: string) =>
    Array.isArray(data[key]) ? (data[key] as Row[]) : [];
  const companies =
    kind === "entities"
      ? arrays("companies")
      : [...new Map(arrays(kind).map((row) => [row.slug, row])).values()];
  const people = kind === "entities" ? arrays("people") : [];
  const jobs = kind === "entities" ? arrays("jobs") : [];
  return {
    ...result,
    presentation: {
      mode: "automaticInlineCards",
      displayedCounts: {
        companies: companies.length,
        people: people.length,
        jobs: jobs.length,
      },
      visibleFields: {
        companies: ["name", "industry", "location"],
        people: ["name", "role", "company"],
        jobs: ["title", "company", "department/focus", "location"],
      },
      textPolicy:
        "Cards are the answer. Add only facts not visible in cards, totals, evidence or caveats. Do not repeat the list. Earlier-turn cards may be explicitly redisplayed.",
    },
  };
}
