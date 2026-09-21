/**
 * Job locations are pipe-delimited in this repo because `components/job-card.tsx`
 * renders " | " as " · " for display.
 *
 * Boards disagree on how they encode multi-location roles: Greenhouse uses
 * `location.name` with semicolons, and Ashby sometimes embeds a semicolon inside
 * a single `location` string (e.g. "San Francisco HQ; Toronto Hub") rather than
 * using `secondaryLocations`. Normalize every source to pipes.
 */
export function sanitizeLocation(location: string) {
  return location
    .split(/\s*;\s*/)
    .flatMap((part) => part.split(/\s*\|\s*/))
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part, index, all) => all.indexOf(part) === index)
    .join(" | ");
}
