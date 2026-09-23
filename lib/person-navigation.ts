type PersonNavigationTarget = {
  companySlug: string;
  name: string;
  url?: string | null;
};

/** A stable deep link that scrolls to and highlights one person on a company page. */
export function personDetailsHref({
  companySlug,
  name,
  url,
}: PersonNavigationTarget) {
  const params = new URLSearchParams({ person: name });
  if (url) params.set("personUrl", url);

  return `/company/${companySlug}?${params.toString()}#key-people`;
}
