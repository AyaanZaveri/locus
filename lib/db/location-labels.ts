import type { CompanyProfile } from "../company-profile";
import {
  locationReferencesDisplay,
  locationReferenceSchema,
} from "../location-reference";
import { db } from "./client";
import { locations } from "./schema";

/** JSON labels are snapshots. Render current labels from the shared catalog. */
export async function hydrateLocationLabels(profiles: CompanyProfile[]) {
  if (!profiles.length) return profiles;
  const places = new Map(
    (
      await db
        .select({
          id: locations.id,
          label: locations.displayLabel,
          countryCode: locations.countryCode,
          kind: locations.kind,
        })
        .from(locations)
    ).map((p) => [
      p.id,
      { ...p, kind: locationReferenceSchema.shape.kind.parse(p.kind) },
    ]),
  );
  return profiles.map((profile) => ({
    ...profile,
    location: {
      ...profile.location,
      label: profile.location.locationId
        ? (places.get(profile.location.locationId)?.label ??
          profile.location.label)
        : profile.location.label,
    },
    jobs: profile.jobs.map((job) => {
      if (!job.locations?.length) return job;
      const refs = job.locations.map((ref) => ({
        ...ref,
        ...(ref.locationId && places.has(ref.locationId)
          ? {
              countryCode: places.get(ref.locationId)!.countryCode,
              kind: places.get(ref.locationId)!.kind,
            }
          : {}),
        label: ref.locationId
          ? (places.get(ref.locationId)?.label ?? ref.label)
          : ref.label,
      }));
      return {
        ...job,
        locations: refs,
        location: locationReferencesDisplay(refs),
      };
    }),
  }));
}
