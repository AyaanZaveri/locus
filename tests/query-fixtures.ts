import { sql } from "drizzle-orm";

export function companySource(rows: Record<string, unknown>[]) {
  return sql`jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS c(
    id text, slug text, name text, industry text, stage text, location text,
    country_code text, employee_count text, profile jsonb, headquarters_location_id text
  )`;
}

export function peopleSource(
  personRows: Record<string, unknown>[],
  companyRows: Record<string, unknown>[],
) {
  return sql`jsonb_to_recordset(${JSON.stringify(personRows)}::jsonb) AS p(
    id text, company_id text, name text, role text, image text, linkedin text,
    source_url text, is_founder boolean
  ) INNER JOIN ${companySource(companyRows)} ON p.company_id = c.id`;
}

export function jobsSource(
  jobRows: Record<string, unknown>[],
  companyRows: Record<string, unknown>[],
) {
  return sql`jsonb_to_recordset(${JSON.stringify(jobRows)}::jsonb) AS j(
    id text, company_id text, title text, location text, focus text, url text,
    description text, status text, workplace_type text, employment_type text,
    department text, skills text[], experience_level text,
    minimum_experience_years numeric, maximum_experience_years numeric,
    accepts_new_grads boolean, salary_minimum numeric, salary_maximum numeric,
    salary_currency text, salary_period text, visa_sponsorship text,
    requires_us_work_authorization boolean, citizenship_required boolean, posted_at text
  ) INNER JOIN ${companySource(companyRows)} ON j.company_id = c.id`;
}

export const fixtureCompanies = [
  {
    id: "a",
    slug: "alpha",
    name: "Alpha",
    industry: "Database",
    stage: "Seed",
    location: "San Francisco",
    country_code: "US",
    employee_count: "11-50 employees",
    profile: {
      foundedYear: 2025,
      description: "Postgres database",
      tagline: "Build",
      industry: "Database",
      location: { label: "San Francisco", countryCode: "US" },
      financials: {
        totalFunding: { amount: 20_000_000, currency: "USD", display: "$20M" },
      },
      activity: [
        {
          type: "product",
          title: "Launched database",
          description: "New Postgres database",
          dateTime: "2026-10-01",
          sourceUrl: "https://example.com/a",
        },
        { type: "product", title: "Future product", dateTime: "2026-10-03" },
        { type: "product", title: "Unknown date", dateTime: null },
      ],
    },
  },
  {
    id: "b",
    slug: "beta",
    name: "Beta",
    industry: "Database",
    stage: "Series A",
    location: "New York",
    country_code: "US",
    employee_count: "200+ employees",
    profile: {
      foundedYear: 2020,
      industry: "Database",
      location: { label: "New York", countryCode: "US" },
      financials: { totalFunding: { amount: 40_000_000, currency: "USD" } },
      activity: [
        {
          type: "hiring",
          title: "Hiring designers",
          description: "Growing team",
          dateTime: "2026-09-30",
        },
        {
          type: "product",
          title: "New tool",
          description: "Launch",
          dateTime: "2026-09-29",
        },
      ],
    },
  },
  {
    id: "c",
    slug: "gamma",
    name: "Gamma",
    industry: "Fintech",
    stage: "Seed",
    location: "Toronto",
    country_code: "CA",
    employee_count: "2,300 employees",
    profile: {
      foundedYear: null,
      activity: [],
      financials: { totalFunding: null },
    },
  },
  {
    id: "d",
    slug: "delta",
    name: "Delta",
    industry: "Database",
    stage: "Seed",
    location: "San Francisco",
    country_code: "US",
    employee_count: "unknown",
    profile: {
      activity: [
        { type: "product", title: "Partial date", dateTime: "2026-10" },
      ],
    },
  },
  {
    id: "e",
    slug: "epsilon",
    name: "Epsilon",
    industry: "Database",
    stage: "Seed",
    location: "San Francisco",
    country_code: "US",
    employee_count: "16 employees (point-in-time figure)",
    profile: {
      activity: [],
      financials: { totalFunding: { amount: 30_000_000, currency: "EUR" } },
    },
  },
];
