import type { LocationReference } from "./location-reference";
import { splitJobLocations } from "./job-location";
import { getJobLocationCountryCode } from "./job-location-country";
import { displayJobFilterLocation } from "./job-location-filter";

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
const isRegion = (label: string) =>
  /^(EMEA|APJ|APAC|APAC business hours|APAC time zones|ANZ|Europe|North America|Americas|Middle East|Worldwide|Global)$/i.test(
    label,
  );

export function getLocationGroups(
  jobs: { location: string; locations?: LocationReference[] }[],
) {
  const options = new Map<
    string,
    {
      value: string;
      label: string;
      countryCode: string | null;
      group: string;
      count: number;
    }
  >();
  const countryJobs = new Map<string, Set<number>>();
  for (const [index, job] of jobs.entries()) {
    const refs = job.locations?.length
      ? job.locations
      : splitJobLocations(job.location).map((label) => ({ label }));
    const seen = new Set<string>();
    for (const ref of refs) {
      const label = displayJobFilterLocation(ref.label);
      if (!label || /\bremote\b/i.test(label)) continue;
      const structured = ref as Partial<LocationReference>;
      const value = structured.locationId ?? label;
      if (seen.has(value)) continue;
      seen.add(value);
      // Explicit null means no single country. Only older snapshots use fallback.
      const countryCode =
        structured.countryCode === undefined
          ? getJobLocationCountryCode(label)
          : (structured.countryCode?.toLowerCase() ?? null);
      const group =
        countryCode ??
        (structured.kind === "region" || isRegion(label) ? "regions" : "other");
      const old = options.get(value);
      options.set(value, {
        value,
        label,
        countryCode,
        group,
        count: (old?.count ?? 0) + 1,
      });
      if (!countryJobs.has(group)) countryJobs.set(group, new Set());
      countryJobs.get(group)!.add(index);
    }
  }
  const groups = new Set([...options.values()].map((option) => option.group));
  const rank = (code: string) =>
    code === "regions" ? 1 : code === "other" ? 2 : 0;
  return [...groups]
    .map((code) => ({
      code,
      label:
        code === "regions"
          ? "Regions"
          : code === "other"
            ? "Other locations"
            : (countryNames.of(code.toUpperCase()) ?? code),
      jobCount: countryJobs.get(code)?.size ?? 0,
      places: [...options.values()]
        .filter((option) => option.group === code)
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .map(({ value, label, countryCode }) => ({
          value,
          label,
          countryCode,
        })),
    }))
    .sort(
      (a, b) =>
        rank(a.code) - rank(b.code) ||
        b.jobCount - a.jobCount ||
        a.label.localeCompare(b.label),
    );
}
