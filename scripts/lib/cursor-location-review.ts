import audit from "../../data/companies/cursor/location-review.json";

/** Source-reviewed location/workplace only: never infer from a title or ATS flag. */
export function reviewedCursorLocation(url: string) {
  const role = audit.roles.find((role) => role.url === url);
  if (!role)
    throw new Error(
      `Unreviewed Cursor posting: ${url}. Scrape and review the current careers board before importing.`,
    );
  return {
    location: role.location,
    workplaceType: role.workplaceType as "remote" | "onsite" | "hybrid" | null,
  };
}
