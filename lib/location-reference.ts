import { z } from "zod";

/** JSON transport shape. Null IDs retain unresolved/remote-only source scopes. */
export const locationReferenceSchema = z.object({
  locationId: z.string().uuid().nullable(),
  label: z.string().min(1),
  relation: z.enum(["office", "eligibility", "unspecified"]),
  qualifier: z.string().nullable(),
  sourceLabel: z.string().min(1),
});

export type LocationReference = z.infer<typeof locationReferenceSchema>;

export function locationReferenceLabels(refs: LocationReference[]): string[] {
  return [
    ...new Set(
      refs.map((ref) => {
        if (ref.relation === "eligibility") {
          if (ref.qualifier === "Remote-Friendly")
            return `Remote-Friendly, ${ref.label}`;
          const label = ref.qualifier
            ? `${ref.label}, ${ref.qualifier}`
            : ref.label;
          return /^Remote/i.test(label) ? label : `Remote - ${label}`;
        }
        return ref.qualifier ? `${ref.label} ${ref.qualifier}` : ref.label;
      }),
    ),
  ];
}

export function locationReferencesDisplay(refs: LocationReference[]): string {
  return locationReferenceLabels(refs).join(" | ");
}
