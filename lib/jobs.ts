import "server-only";

import {
  and,
  arrayOverlaps,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  or,
  sql,
} from "drizzle-orm";

import { db } from "./db";
import { companies, jobs } from "./db/schema";
import { sanitizeLocation } from "./job-location";
import { jobLocationPredicate } from "./location-query";

export type JobFilters = {
  query?: string;
  commitment?:
    "full-time" | "part-time" | "contract" | "internship" | "temporary";
  role?: string;
  companySize?: string;
  industry?: string;
  minimumExperienceYears?: number;
  location?: string;
  remote?: boolean;
  companyStage?: string;
  hasSalaryRange?: boolean;
  hasEquityRange?: boolean;
  hasInterviewProcess?: boolean;
  usVisaNotRequired?: boolean;
  skills?: string[];
};

/**
 * Shared server-side search/filter query for the jobs index. Add UI controls
 * without duplicating filtering rules in client components.
 */
export async function getJobs(filters: JobFilters = {}) {
  // Older imports do not always state a status. Treat unknown as visible until
  // the next research refresh resolves it; only explicit closures are hidden.
  const clauses = [or(eq(jobs.status, "open"), eq(jobs.status, "unknown"))!];

  if (filters.query) {
    const query = `%${filters.query.trim()}%`;
    const canonicalLocation = sanitizeLocation(filters.query.trim());
    clauses.push(
      or(
        ilike(jobs.searchText, query),
        ilike(companies.name, query),
        ...(canonicalLocation !== filters.query.trim()
          ? [
              jobLocationPredicate(
                sql`${jobs.id}`,
                sql`${jobs.location}`,
                canonicalLocation,
              ),
            ]
          : []),
      )!,
    );
  }
  if (filters.commitment) {
    clauses.push(eq(jobs.employmentType, filters.commitment));
  }
  if (filters.role) clauses.push(ilike(jobs.title, `%${filters.role}%`));
  if (filters.companySize) {
    clauses.push(eq(companies.employeeCount, filters.companySize));
  }
  if (filters.industry) clauses.push(eq(companies.industry, filters.industry));
  if (filters.companyStage)
    clauses.push(eq(companies.stage, filters.companyStage));
  if (filters.location)
    clauses.push(
      jobLocationPredicate(
        sql`${jobs.id}`,
        sql`${jobs.location}`,
        sanitizeLocation(filters.location),
      ),
    );
  if (filters.remote) clauses.push(eq(jobs.workplaceType, "remote"));
  if (filters.minimumExperienceYears !== undefined) {
    clauses.push(
      gte(jobs.minimumExperienceYears, String(filters.minimumExperienceYears)),
    );
  }
  if (filters.hasSalaryRange) {
    clauses.push(
      or(isNotNull(jobs.salaryMinimum), isNotNull(jobs.salaryMaximum))!,
    );
  }
  if (filters.hasEquityRange) {
    clauses.push(
      or(
        isNotNull(jobs.equityMinimumPercent),
        isNotNull(jobs.equityMaximumPercent),
      )!,
    );
  }
  if (filters.hasInterviewProcess) {
    clauses.push(eq(jobs.interviewProcessAvailable, true));
  }
  if (filters.usVisaNotRequired) {
    clauses.push(eq(jobs.requiresUsWorkAuthorization, false));
  }
  if (filters.skills?.length) {
    clauses.push(arrayOverlaps(jobs.skills, filters.skills));
  }

  return db
    .select({
      id: jobs.id,
      title: jobs.title,
      location: jobs.location,
      focus: jobs.focus,
      description: jobs.description,
      workplaceType: jobs.workplaceType,
      employmentType: jobs.employmentType,
      department: jobs.department,
      skills: jobs.skills,
      salaryMinimum: jobs.salaryMinimum,
      salaryMaximum: jobs.salaryMaximum,
      salaryCurrency: jobs.salaryCurrency,
      salaryPeriod: jobs.salaryPeriod,
      equityMinimumPercent: jobs.equityMinimumPercent,
      equityMaximumPercent: jobs.equityMaximumPercent,
      companySlug: companies.slug,
      companyName: companies.name,
      companyProfile: companies.profile,
    })
    .from(jobs)
    .innerJoin(companies, eq(jobs.companyId, companies.id))
    .where(and(...clauses))
    .orderBy(desc(jobs.postedAt), desc(jobs.updatedAt));
}
