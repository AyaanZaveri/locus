type JobNavigationTarget = {
  companySlug: string;
  title: string;
  location?: string;
  url?: string | null;
};

/** A stable deep link that opens one job's details drawer on its company page. */
export function jobDetailsHref({
  companySlug,
  title,
  location,
  url,
}: JobNavigationTarget) {
  const params = new URLSearchParams({ job: title });
  if (location) params.set("jobLocation", location);
  if (url) params.set("jobUrl", url);

  return `/company/${companySlug}?${params.toString()}#jobs`;
}
