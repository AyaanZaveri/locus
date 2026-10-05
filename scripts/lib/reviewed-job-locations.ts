import { readFile } from "node:fs/promises";
import { z } from "zod";
import { locationReferenceSchema } from "../../lib/location-reference";

const schema = z.object({
  companySlug: z.string(),
  roles: z.array(
    z.object({
      url: z.string().url(),
      location: z.string().min(1),
      workplaceType: z
        .enum(["remote", "onsite", "hybrid", "flexible"])
        .nullable(),
      locations: z.array(locationReferenceSchema).optional(),
    }),
  ),
});

/** Only audited companies opt in. Unreviewed URLs fail rather than reuse ATS guesses. */
export async function getReviewedJobLocations(slug: string) {
  if (!/^[a-z0-9-]+$/.test(slug))
    throw new Error(`Invalid company slug: ${slug}`);
  let raw: string;
  try {
    raw = await readFile(
      new URL(`../../data/job-location-reviews/${slug}.json`, import.meta.url),
      "utf8",
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const audit = schema.parse(JSON.parse(raw));
  if (audit.companySlug !== slug)
    throw new Error(`Location audit identity mismatch: ${slug}`);
  const roles = new Map(audit.roles.map((role) => [role.url, role]));
  if (roles.size !== audit.roles.length)
    throw new Error(`Duplicate audited posting: ${slug}`);
  return {
    get(url: string) {
      const role = roles.get(url);
      if (!role)
        throw new Error(
          `Unreviewed ${slug} posting: ${url}. Run a fresh full careers audit before importing.`,
        );
      return {
        location: role.location,
        workplaceType: role.workplaceType,
        locations: role.locations,
      };
    },
  };
}
