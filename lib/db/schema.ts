import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  vector,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export { user, session, account, verification } from "./auth-schema";
export { userProfiles } from "./user-profile-schema";

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey(),
    identityKey: text("identity_key").notNull().unique(),
    name: text("name").notNull(),
    displayLabel: text("display_label").notNull(),
    kind: text("kind").notNull(),
    countryCode: text("country_code"),
    subdivisionCode: text("subdivision_code"),
  },
  (table) => [
    index("locations_country_idx").on(table.countryCode),
    check(
      "locations_kind_check",
      sql`${table.kind} IN ('city', 'country', 'subdivision', 'region')`,
    ),
  ],
);

export const locationAliases = pgTable(
  "location_aliases",
  {
    alias: text("alias").primaryKey(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
  },
  (table) => [index("location_aliases_location_idx").on(table.locationId)],
);

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
    headquartersLocationId: uuid("headquarters_location_id").references(
      () => locations.id,
    ),
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

/** Multiple locations are rows, not an array of foreign keys. */
export const jobLocations = pgTable(
  "job_locations",
  {
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    locationId: uuid("location_id").references(() => locations.id),
    relation: text("relation").notNull(),
    qualifier: text("qualifier"),
    sourceLabel: text("source_label").notNull(),
    label: text("label").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.jobId, table.position] }),
    index("job_locations_location_idx").on(table.locationId, table.jobId),
    check(
      "job_locations_relation_check",
      sql`${table.relation} IN ('office', 'eligibility', 'unspecified')`,
    ),
    check("job_locations_position_check", sql`${table.position} >= 0`),
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

/** Content-addressed vectors outlive entity imports; only entity links cascade. */
export const embeddingCache = pgTable("embedding_cache", {
  key: text("key").primaryKey(),
  modelId: text("model_id").notNull(),
  dimensions: integer("dimensions").notNull(),
  recipe: text("recipe").notNull(),
  inputType: text("input_type").notNull(),
  contentText: text("content_text").notNull(),
  embedding: vector("embedding", { dimensions: 1024 }).notNull(),
});

export const jobEmbeddings = pgTable("job_embeddings", {
  jobId: uuid("job_id")
    .primaryKey()
    .references(() => jobs.id, { onDelete: "cascade" }),
  cacheKey: text("cache_key")
    .notNull()
    .references(() => embeddingCache.key),
});

export const companyEmbeddings = pgTable("company_embeddings", {
  companyId: uuid("company_id")
    .primaryKey()
    .references(() => companies.id, { onDelete: "cascade" }),
  cacheKey: text("cache_key")
    .notNull()
    .references(() => embeddingCache.key),
});

export const embeddingRequests = pgTable(
  "embedding_requests",
  {
    key: text("key").notNull().unique(),
    day: text("day").notNull(),
    slot: integer("slot").notNull(),
    state: text("state").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    receipt: jsonb("receipt"),
  },
  (table) => [primaryKey({ columns: [table.day, table.slot] })],
);
