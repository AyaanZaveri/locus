import type { CompanyProfile } from "../company-profile";
import { locationReferencesDisplay } from "../location-reference";
import { db } from "./client";
import { locations } from "./schema";

/** JSON labels are snapshots. Render current labels from the shared catalog. */
export async function hydrateLocationLabels(profiles: CompanyProfile[]) {
  if (!profiles.length) return profiles;
  const places = new Map(
    (
      await db
        .select({ id: locations.id, label: locations.displayLabel })
        .from(locations)
    ).map((p) => [p.id, p.label]),
  );
  return profiles.map((profile) => ({
    ...profile,
    location: {
      ...profile.location,
      label: profile.location.locationId
        ? (places.get(profile.location.locationId) ?? profile.location.label)
        : profile.location.label,
    },
    jobs: profile.jobs.map((job) => {
      if (!job.locations?.length) return job;
      const refs = job.locations.map((ref) => ({
        ...ref,
        label: ref.locationId
          ? (places.get(ref.locationId) ?? ref.label)
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
