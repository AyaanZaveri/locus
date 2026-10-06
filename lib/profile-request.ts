// Profile mutations are same-origin browser requests. Identity always comes
// from the authenticated session, never a body/query user ID.
export function isSameOriginRequest(request: Request) {
  // Next may expose an internal host behind a reverse proxy. The configured
  // canonical auth origin is also the public origin for profile mutations.
  const expected = new URL(process.env.BETTER_AUTH_URL ?? request.url).origin;
  return request.headers.get("origin") === expected;
}
