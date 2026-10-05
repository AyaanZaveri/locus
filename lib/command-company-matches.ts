/** Use the already-loaded navigation catalog; the server handles aliases/typos. */
export function immediateCompanyMatches<
  T extends { name: string; slug: string },
>(companies: T[], query: string, limit = 6): T[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  const rank = (company: T) => {
    const name = company.name.toLocaleLowerCase();
    const slug = company.slug.toLocaleLowerCase();
    if (name === normalized || slug === normalized) return 0;
    // Compare literal word-start slices, never execute the input as a pattern.
    if (
      [name, slug].some((text) =>
        [...text.matchAll(/(^|[^\p{L}\p{N}])([\p{L}\p{N}])/gu)].some((match) =>
          text.slice(match.index + match[1].length).startsWith(normalized),
        ),
      )
    )
      return 1;
    return 2;
  };
  return companies
    .filter((company) => rank(company) < 2)
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        a.name.localeCompare(b.name) ||
        a.slug.localeCompare(b.slug),
    )
    .slice(0, limit);
}
