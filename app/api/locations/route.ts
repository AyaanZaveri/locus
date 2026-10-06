import {
  PROFILE_LOCATION_PAGE_SIZE,
  searchProfileLocations,
} from "@/lib/profile-locations";

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q") ?? "";
  const offset = Number(params.get("offset") ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0)
    return Response.json(
      { error: "Invalid location offset." },
      { status: 400 },
    );
  if (query.length > 120)
    return Response.json(
      { error: "Location query is too long." },
      { status: 400 },
    );
  const results = searchProfileLocations(
    query,
    offset,
    PROFILE_LOCATION_PAGE_SIZE + 1,
  );
  return Response.json({
    locations: results.slice(0, PROFILE_LOCATION_PAGE_SIZE),
    nextOffset:
      results.length > PROFILE_LOCATION_PAGE_SIZE
        ? offset + PROFILE_LOCATION_PAGE_SIZE
        : null,
  });
}
