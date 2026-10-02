import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * A company stays as a complete profile document for the rich company page.
 * Jobs are deliberately normalized below: they are what people search and filter.
 */
export const companies = pgTable(
  "companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    industry: text("industry").notNull(),
    stage: text("stage").notNull(),
    location: text("location").notNull(),
    countryCode: text("country_code").notNull(),
    employeeCount: text("employee_count").notNull(),
    profile: jsonb("profile").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("companies_industry_idx").on(table.industry),
    index("companies_stage_idx").on(table.stage),
    index("companies_knowledge_idx").using(
      "gin",
      sql`to_tsvector('english', ${table.profile})`,
    ),
  ],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    location: text("location").notNull(),
    focus: text("focus").notNull(),
    url: text("url"),
    description: text("description"),
    status: text("status").notNull().default("unknown"),
    workplaceType: text("workplace_type"),
    employmentType: text("employment_type"),
    department: text("department"),
    skills: text("skills").array().notNull().default([]),
    minimumExperienceYears: numeric("minimum_experience_years"),
    maximumExperienceYears: numeric("maximum_experience_years"),
    experienceLevel: text("experience_level"),
    acceptsNewGrads: boolean("accepts_new_grads"),
    salaryMinimum: numeric("salary_minimum"),
    salaryMaximum: numeric("salary_maximum"),
    salaryCurrency: text("salary_currency"),
    salaryPeriod: text("salary_period"),
    equityMinimumPercent: numeric("equity_minimum_percent"),
    equityMaximumPercent: numeric("equity_maximum_percent"),
    requiresUsWorkAuthorization: boolean("requires_us_work_authorization"),
    visaSponsorship: text("visa_sponsorship"),
    citizenshipRequired: boolean("citizenship_required"),
    interviewProcessAvailable: boolean("interview_process_available"),
    interviewProcessSummary: text("interview_process_summary"),
    interviewProcessUrl: text("interview_process_url"),
    postedAt: text("posted_at"),
    lastSeenAt: text("last_seen_at"),
    searchText: text("search_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("jobs_company_idx").on(table.companyId),
    index("jobs_filters_idx").on(
      table.status,
      table.workplaceType,
      table.employmentType,
    ),
    index("jobs_department_idx").on(table.department),
  ],
);

export const people = pgTable(
  "people",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role").notNull(),
    image: text("image"),
    linkedin: text("linkedin"),
    x: text("x"),
    sourceUrl: text("source_url"),
    isFounder: boolean("is_founder").notNull().default(false),
    searchText: text("search_text").notNull(),
  },
  (table) => [
    index("people_company_idx").on(table.companyId),
    index("people_name_idx").on(table.name),
  ],
);
