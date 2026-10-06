import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { connection } from "next/server";
import { z } from "zod";
import { sanitizeLocation } from "./job-location";
import {
  locationReferenceSchema,
  locationReferencesDisplay,
} from "./location-reference";

const activityTypeSchema = z.enum([
  "documentation",
  "funding",
  "growth",
  "hiring",
  "news",
  "people",
  "product",
]);

const industrySchema = z.enum([
  "AI Compute",
  "AI Gateway",
  "AI Inference",
  "Database",
  "Developer Tools",
  "Energy",
  "Fintech",
  "Foundation Models",
  "Job Search",
  "Market Intelligence",
  "Web Search",
  "Workflow Orchestration",
]);

const moneySchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.literal("USD"),
  display: z.string().min(1),
});

const investorSchema = z.object({
  name: z.string().min(1),
  website: z.string().url().nullable(),
  logo: z.string().min(1).nullable().optional(),
});

const fundingRoundSchema = z.object({
  id: z.string().min(1),
  stage: z.string().min(1),
  announcedAt: z.string().min(1).nullable(),
  amount: moneySchema,
  valuation: moneySchema.nullable(),
  leadInvestors: z.array(investorSchema),
  investors: z.array(investorSchema),
  sourceUrl: z.string().url().nullable(),
});

const jobWorkplaceTypeSchema = z.enum([
  "remote",
  "hybrid",
  "onsite",
  "flexible",
]);

const jobEmploymentTypeSchema = z.enum([
  "full-time",
  "part-time",
  "contract",
  "internship",
  "temporary",
]);

const jobExperienceSchema = z.object({
  minimumYears: z.number().nonnegative().nullable().optional(),
  maximumYears: z.number().nonnegative().nullable().optional(),
  level: z
    .enum([
      "intern",
      "entry",
      "mid",
      "senior",
      "staff",
      "principal",
      "manager",
      "director",
      "executive",
    ])
    .nullable()
    .optional(),
  acceptsNewGrads: z.boolean().nullable().optional(),
});

const jobCompensationSchema = z.object({
  salary: z
    .object({
      minimum: z.number().nonnegative().nullable(),
      maximum: z.number().nonnegative().nullable(),
      currency: z.string().length(3),
      period: z.enum(["hour", "month", "year"]),
    })
    .nullable()
    .optional(),
  equity: z
    .object({
      minimumPercent: z.number().nonnegative().nullable(),
      maximumPercent: z.number().nonnegative().nullable(),
    })
    .nullable()
    .optional(),
});

const jobVisaSchema = z.object({
  requiresUSWorkAuthorization: z.boolean().nullable().optional(),
  sponsorship: z.enum(["available", "unavailable", "unknown"]).optional(),
  citizenshipRequired: z.boolean().nullable().optional(),
});

const jobInterviewProcessSchema = z.object({
  available: z.boolean(),
  summary: z.string().min(1).nullable().optional(),
  url: z.string().url().nullable().optional(),
});

export const companyProfileSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  tagline: z.string().min(1),
  description: z.string().min(1),
  website: z.string().url().nullable(),
  foundedYear: z.number().int().min(1800).max(2100).nullable(),
  banner: z.string().min(1).nullable(),
  bannerPosition: z.string().min(1).optional(),
  logo: z.string().min(1).nullable(),
  industry: industrySchema,
  location: z.object({
    label: z.string().min(1),
    countryCode: z.string().length(2),
    locationId: z.string().uuid().nullable().optional(),
    sourceLabel: z.string().min(1).optional(),
  }),
  stage: z.string().min(1),
  employees: z.string().min(1),
  financials: z.object({
    totalFunding: moneySchema.nullable(),
    valuation: moneySchema.nullable(),
    annualRevenue: moneySchema.nullable(),
  }),
  funding: z.object({
    latestRoundId: z.string().min(1).nullable(),
    investors: z.array(investorSchema),
    rounds: z.array(fundingRoundSchema),
  }),
  jobs: z.array(
    z.object({
      title: z.string().min(1),
      location: z.string().min(1),
      locations: z.array(locationReferenceSchema).min(1).optional(),
      focus: z.string().min(1),
      url: z.string().url().nullable().optional(),
      description: z.string().min(1).nullable().optional(),
      status: z.enum(["open", "closed", "unknown"]).nullable().optional(),
      workplaceType: jobWorkplaceTypeSchema.nullable().optional(),
      employmentType: jobEmploymentTypeSchema.nullable().optional(),
      department: z.string().min(1).nullable().optional(),
      skills: z.array(z.string().min(1)).optional(),
      experience: jobExperienceSchema.nullable().optional(),
      compensation: jobCompensationSchema.nullable().optional(),
      visa: jobVisaSchema.nullable().optional(),
      interviewProcess: jobInterviewProcessSchema.nullable().optional(),
      postedAt: z.string().date().nullable().optional(),
      lastSeenAt: z.string().date().nullable().optional(),
    }),
  ),
  people: z.array(
    z.object({
      name: z.string().min(1),
      role: z.string().min(1),
      image: z.string().min(1).nullable(),
      linkedin: z.string().url().nullable(),
      x: z.string().url().nullable().optional(),
      sourceUrl: z.string().url().nullable().optional(),
      isFounder: z.boolean().optional(),
    }),
  ),
  activity: z.array(
    z.object({
      type: activityTypeSchema,
      time: z.string().min(1),
      dateTime: z.string().min(1),
      title: z.string().min(1),
      description: z.string().min(1),
      sourceUrl: z.string().url().nullable().optional(),
    }),
  ),
});

export type CompanyProfile = z.infer<typeof companyProfileSchema>;
export type ActivityType = z.infer<typeof activityTypeSchema>;
export type Industry = z.infer<typeof industrySchema>;
export type CompanyNavigationItem = {
  slug: string;
  name: string;
  logo: string | null;
  industry: string;
  location: string;
  countryCode: string;
  latestFundingAt: string | null;
};

const companiesDirectory = join(process.cwd(), "data", "companies");

function normalizeInvestor(investor: Record<string, unknown>) {
  return {
    ...investor,
    logo: investor.logo ?? investor.logoUrl ?? null,
  };
}

function normalizeCompany(source: Record<string, unknown>) {
  const funding = source.funding as Record<string, unknown> | undefined;
  const rounds = Array.isArray(funding?.rounds) ? funding.rounds : [];

  return {
    ...source,
    jobs: Array.isArray(source.jobs)
      ? source.jobs.map((job) => {
          const record = job as Record<string, unknown>;
          return {
            ...record,
            location:
              Array.isArray(record.locations) && record.locations.length
                ? locationReferencesDisplay(
                    z.array(locationReferenceSchema).parse(record.locations),
                  )
                : typeof record.location === "string"
                  ? sanitizeLocation(record.location)
                  : record.location,
          };
        })
      : source.jobs,
    banner: source.banner ?? null,
    logo: source.logo ?? null,
    funding: {
      ...funding,
      investors: Array.isArray(funding?.investors)
        ? funding.investors.map((investor) =>
            normalizeInvestor(investor as Record<string, unknown>),
          )
        : [],
      rounds: rounds.map((round) => {
        const record = round as Record<string, unknown>;
        return {
          ...record,
          leadInvestors: Array.isArray(record.leadInvestors)
            ? record.leadInvestors.map((investor) =>
                normalizeInvestor(investor as Record<string, unknown>),
              )
            : [],
          investors: Array.isArray(record.investors)
            ? record.investors.map((investor) =>
                normalizeInvestor(investor as Record<string, unknown>),
              )
            : [],
        };
      }),
    },
  };
}

export function parseCompanyProfile(source: Record<string, unknown>) {
  return companyProfileSchema.parse(normalizeCompany(source));
}

export async function getCompaniesFromFiles() {
  const entries = await readdir(companiesDirectory, { withFileTypes: true });
  const profiles = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(async (entry) => {
        try {
          const source = await readFile(
            join(companiesDirectory, entry.name, "company.json"),
            "utf8",
          );
          return parseCompanyProfile(
            JSON.parse(source) as Record<string, unknown>,
          );
        } catch (error) {
          console.warn(
            `Skipping company "${entry.name}": unable to load company.json.`,
            error,
          );
          return null;
        }
      }),
  );

  return profiles.filter(
    (profile): profile is CompanyProfile => profile !== null,
  );
}

export async function getCompanies() {
  // Company data is managed in Neon, so never let this query become part of
  // a deployment's prerendered output.
  await connection();

  try {
    const [{ db }, { companies }] = await Promise.all([
      import("./db"),
      import("./db/schema"),
    ]);
    const records = await db.query.companies.findMany({
      orderBy: (company, { asc }) => asc(company.slug),
      columns: { profile: true },
    });

    const { hydrateLocationLabels } = await import("./db/location-labels");
    return hydrateLocationLabels(
      records.map((record) =>
        parseCompanyProfile(record.profile as Record<string, unknown>),
      ),
    );
  } catch (error) {
    throw new Error("Unable to load company profiles from Neon.", {
      cause: error,
    });
  }
}

export type CompanyDirectoryItem = {
  slug: string;
  name: string;
  tagline: string;
  banner: string | null;
  bannerPosition?: string;
  logo: string | null;
  industry: string;
  location: { label: string; countryCode: string };
  stage: string;
};

export async function getCompanyDirectory(): Promise<CompanyDirectoryItem[]> {
  await connection();

  try {
    const [{ db }, { companies, locations }, { sql, eq }] = await Promise.all([
      import("./db"),
      import("./db/schema"),
      import("drizzle-orm"),
    ]);
    const records = await db
      .select({
        slug: companies.slug,
        name: companies.name,
        industry: companies.industry,
        locationLabel: sql<string>`coalesce(${locations.displayLabel},${companies.location})`,
        countryCode: companies.countryCode,
        stage: companies.stage,
        tagline: sql<string>`${companies.profile} ->> 'tagline'`,
        banner: sql<string | null>`${companies.profile} ->> 'banner'`,
        bannerPosition: sql<
          string | null
        >`${companies.profile} ->> 'bannerPosition'`,
        logo: sql<string | null>`${companies.profile} ->> 'logo'`,
      })
      .from(companies)
      .leftJoin(locations, eq(companies.headquartersLocationId, locations.id))
      .orderBy(companies.name);

    return records.map(({ locationLabel, countryCode, ...record }) => ({
      ...record,
      bannerPosition: record.bannerPosition ?? undefined,
      location: { label: locationLabel, countryCode },
    }));
  } catch (error) {
    throw new Error("Unable to load company directory from Neon.", {
      cause: error,
    });
  }
}

export async function getCompanyNavigation(): Promise<CompanyNavigationItem[]> {
  await connection();

  try {
    const [{ db }, { companies, locations }, { sql, eq }] = await Promise.all([
      import("./db"),
      import("./db/schema"),
      import("drizzle-orm"),
    ]);
    return await db
      .select({
        slug: companies.slug,
        name: companies.name,
        industry: companies.industry,
        location: sql<string>`coalesce(${locations.displayLabel},${companies.location})`,
        countryCode: companies.countryCode,
        logo: sql<string | null>`${companies.profile} ->> 'logo'`,
        latestFundingAt: sql<string | null>`(
          SELECT max(round ->> 'announcedAt')
          FROM jsonb_array_elements(coalesce(${companies.profile} -> 'funding' -> 'rounds', '[]'::jsonb)) AS round
          WHERE round ->> 'announcedAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            AND round ->> 'announcedAt' <= to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')
        )`,
      })
      .from(companies)
      .leftJoin(locations, eq(companies.headquartersLocationId, locations.id))
      .orderBy(companies.name);
  } catch (error) {
    throw new Error("Unable to load company navigation from Neon.", {
      cause: error,
    });
  }
}

export async function getCompanyProfile(slug: string) {
  await connection();

  try {
    const [{ db }, { companies }, { eq }] = await Promise.all([
      import("./db"),
      import("./db/schema"),
      import("drizzle-orm"),
    ]);
    const record = await db.query.companies.findFirst({
      where: eq(companies.slug, slug),
      columns: { profile: true },
    });

    if (!record) return undefined;
    const { hydrateLocationLabels } = await import("./db/location-labels");
    return (
      await hydrateLocationLabels([
        parseCompanyProfile(record.profile as Record<string, unknown>),
      ])
    )[0];
  } catch (error) {
    throw new Error(`Unable to load company profile "${slug}" from Neon.`, {
      cause: error,
    });
  }
}
