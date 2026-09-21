import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { cache } from "react";
import { z } from "zod";

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
  }),
  stage: z.string().min(1),
  employees: z.string().min(1),
  financials: z.object({
    totalFunding: moneySchema,
    valuation: moneySchema.nullable(),
    annualRevenue: moneySchema.nullable(),
  }),
  funding: z.object({
    latestRoundId: z.string().min(1),
    investors: z.array(investorSchema),
    rounds: z.array(fundingRoundSchema),
  }),
  jobs: z.array(
    z.object({
      title: z.string().min(1),
      location: z.string().min(1),
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

export const getCompanies = cache(async () => {
  try {
    const [{ db }, { companies }] = await Promise.all([
      import("./db"),
      import("./db/schema"),
    ]);
    const records = await db.query.companies.findMany({
      orderBy: (company, { asc }) => asc(company.slug),
      columns: { profile: true },
    });

    return records.map((record) =>
      parseCompanyProfile(record.profile as Record<string, unknown>),
    );
  } catch (error) {
    throw new Error("Unable to load company profiles from Neon.", {
      cause: error,
    });
  }
});

export const getCompanyNavigation = cache(
  async (): Promise<CompanyNavigationItem[]> => {
    try {
      const [{ db }, { companies }] = await Promise.all([
        import("./db"),
        import("./db/schema"),
      ]);
      return db
        .select({
          slug: companies.slug,
          name: companies.name,
          industry: companies.industry,
          location: companies.location,
          countryCode: companies.countryCode,
          logo: companies.profile,
        })
        .from(companies)
        .orderBy(companies.name)
        .then((records) =>
          records.map(({ logo, ...company }) => ({
            ...company,
            logo:
              logo && typeof logo === "object" && "logo" in logo
                ? typeof logo.logo === "string"
                  ? logo.logo
                  : null
                : null,
          })),
        );
    } catch (error) {
      throw new Error("Unable to load company navigation from Neon.", {
        cause: error,
      });
    }
  },
);

export async function getCompanyProfile(slug: string) {
  return (await getCompanies()).find((company) => company.slug === slug);
}
