type JobNavigationTarget = {
  companySlug: string;
  title: string;
  location?: string;
};

/** A stable deep link that opens one job's details drawer on its company page. */
export function jobDetailsHref({
  companySlug,
  title,
  location,
}: JobNavigationTarget) {
  const params = new URLSearchParams({ job: title });
  if (location) params.set("jobLocation", location);

  return `/company/${companySlug}?${params.toString()}#jobs`;
}
