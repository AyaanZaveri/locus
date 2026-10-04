import assert from "node:assert/strict";

import { getJobLocationReviewIssues, sanitizeLocation } from "../../lib/job-location";

type ProfileJob = { title: string; location: string; url?: string | null; [key: string]: unknown };
export type LocationCompany = {
  id: string;
  slug: string;
  name: string;
  profile_hash?: string;
  profile: Record<string, unknown> & { jobs: ProfileJob[] };
};
export type LocationJobRow = {
  id: string;
  company_id: string;
  title: string;
  url: string | null;
  location: string;
  search_text: string;
  search_text_hash?: string;
  other_fields_hash?: string;
};
export type LocationOverride = {
  url: string;
  expectedLocation: string;
  location: string;
  sourceUrl: string;
};

export function planLocationRepairs(
  companies: LocationCompany[],
  jobs: LocationJobRow[],
  overrides: LocationOverride[] = [],
) {
  const usedOverrides = new Set<string>();
  const companyChanges: { id: string; slug: string; expected_profile: unknown; profile: unknown }[] = [];
  const jobChanges: { id: string; company_id: string; title: string; expected_location: string; location: string; expected_search_text: string; search_text: string }[] = [];
  const unresolved: { company: string; title: string; url: string | null; location: string; issues: string[] }[] = [];
  const rowsByCompany = new Map<string, LocationJobRow[]>();
  for (const job of jobs) {
    const rows = rowsByCompany.get(job.company_id) ?? [];
    rows.push(job);
    rowsByCompany.set(job.company_id, rows);
  }

  for (const company of companies) {
    const remainingRows = [...(rowsByCompany.get(company.id) ?? [])];
    const nextJobs = company.profile.jobs.map((job) => {
      const index = remainingRows.findIndex((row) =>
        row.title === job.title && row.url === (job.url ?? null) && row.location === job.location,
      );
      assert.notEqual(index, -1, `${company.slug}: profile/row drift for ${job.title}`);
      const [row] = remainingRows.splice(index, 1);
      const override = overrides.find((candidate) => candidate.url === job.url);
      if (override) {
        assert.equal(job.location, override.expectedLocation, `Stale override: ${job.url}`);
        assert.match(override.sourceUrl, /^https:\/\//, "Overrides need verified source URLs");
        usedOverrides.add(override.url);
      }
      const location = sanitizeLocation(override?.location ?? job.location);
      assert.equal(sanitizeLocation(location), location, `Non-idempotent: ${location}`);
      const issues = getJobLocationReviewIssues(location);
      if (issues.length) unresolved.push({ company: company.slug, title: job.title, url: job.url ?? null, location, issues });
      if (location !== row.location) {
        const prefix = `${company.name} ${job.title} ${row.location}`;
        assert.ok(row.search_text.startsWith(prefix), `Unexpected search text for ${row.id}`);
        jobChanges.push({
          id: row.id,
          company_id: company.id,
          title: job.title,
          expected_location: row.location,
          location,
          expected_search_text: row.search_text,
          search_text: `${company.name} ${job.title} ${location}${row.search_text.slice(prefix.length)}`,
        });
      }
      return { ...job, location };
    });
    assert.equal(remainingRows.length, 0, `${company.slug}: orphan job rows`);
    if (nextJobs.some((job, index) => job.location !== company.profile.jobs[index].location)) {
      companyChanges.push({
        id: company.id,
        slug: company.slug,
        expected_profile: company.profile,
        profile: { ...company.profile, jobs: nextJobs },
      });
    }
    rowsByCompany.delete(company.id);
  }
  assert.equal(rowsByCompany.size, 0, "Jobs reference unknown companies");
  assert.equal(usedOverrides.size, overrides.length, "Unused or duplicate source overrides");
  return { companyChanges, jobChanges, unresolved };
}
