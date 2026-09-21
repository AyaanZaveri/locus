import { readFile, writeFile } from "node:fs/promises";

import { sanitizeJobMarkdown } from "./lib/job-markdown";

const slug = process.argv[2] ?? "parallel";
// Board slug and profile slug can differ.
const profileSlug = process.argv[3] ?? slug;
const profilePath = new URL(`../data/companies/${profileSlug}/company.json`, import.meta.url);
const apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`;

type AshbyJob = {
  id: string;
  title: string;
  department?: string;
  team?: string;
  location: string;
  secondaryLocations?: Array<{ location?: string }>;
  publishedAt?: string;
  isListed?: boolean;
  workplaceType?: string;
  employmentType?: string;
  jobUrl: string;
  descriptionHtml?: string;
  compensation?: {
    summaryComponents?: Array<{
      compensationType?: string;
      interval?: string;
      currencyCode?: string | null;
      minValue?: number | null;
      maxValue?: number | null;
    }>;
  };
};

function decodeEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'");
}

function htmlToMarkdown(html: string) {
  let markdown = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<h[1-6][^>]*>\s*(?:<a[^>]*>\s*)?(?:<strong>)?\s*​?\s*(?:<\/strong>)?\s*(?:<\/a>)?\s*<\/h[1-6]>/gi, "")
    .replace(/<h[1-6][^>]*>/gi, "\n\n## ")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(?:li|p|div|section|article)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<(?:strong|b)[^>]*>/gi, "**")
    .replace(/<\/(?:strong|b)>/gi, "**")
    .replace(/<(?:em|i)[^>]*>/gi, "*")
    .replace(/<\/(?:em|i)>/gi, "*")
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
      const cleanText = text.replace(/<[^>]+>/g, "").trim();
      return cleanText && cleanText !== "​" ? `[${cleanText}](${href})` : "";
    })
    .replace(/<[^>]+>/g, "");

  // Shared rules keep synced output identical to a normalized profile.
  return sanitizeJobMarkdown(markdown);
}

/** Derives a stable focus bucket from whatever labels the board provides. */
function focusFor(...labels: Array<string | undefined>) {
  const haystack = labels.filter(Boolean).join(" ").toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/research/, "Research"],
    [/security|trust|safeguard|compliance/, "Security"],
    [/engineering|infrastructure|compute|hardware/, "Engineering"],
    [/data science|analytics|data/, "Data"],
    [/product/, "Product"],
    [/design/, "Design"],
    [/gtm|sales|revenue|partnership|business development/, "GTM"],
    [/marketing|brand|communication|content/, "Marketing"],
    [/customer success|support/, "Customer Success"],
    [/legal|counsel/, "Legal"],
    [/finance|accounting/, "Finance"],
    [/people|human resources|recruiting|talent/, "People"],
    [/operations|program|enablement/, "Operations"],
  ];
  for (const [pattern, value] of rules) if (pattern.test(haystack)) return value;
  const first = labels.find((label) => label && label.trim());
  return first?.trim() ?? "Other";
}

function employmentFor(title: string, employmentType: string | undefined) {
  if (/\bintern(ship)?\b/i.test(title)) return "internship";
  if (employmentType === "FullTime") return "full-time";
  if (employmentType === "PartTime") return "part-time";
  if (employmentType === "Contract") return "contract";
  if (employmentType === "Temporary") return "temporary";
  return "full-time";
}

function structuredFields(job: AshbyJob) {
  const salary = job.compensation?.summaryComponents?.find(
    (component) => component.compensationType === "Salary",
  );
  const equity = job.compensation?.summaryComponents?.some(
    (component) => component.compensationType === "EquityPercentage",
  );
  const description = htmlToMarkdown(job.descriptionHtml ?? "");
  const existing = description.match(/(\d+)\+ years?/i);

  return {
    status: "open",
    workplaceType:
      job.workplaceType === "OnSite"
        ? "onsite"
        : job.workplaceType === "Remote"
          ? "remote"
          : job.workplaceType === "Hybrid"
            ? "hybrid"
            : "onsite",
    employmentType: employmentFor(job.title, job.employmentType),
    department: job.department ?? null,
    ...(salary
      ? {
          compensation: {
            salary: {
              minimum: salary.minValue ?? null,
              maximum: salary.maxValue ?? null,
              currency: salary.currencyCode ?? "USD",
              period: salary.interval === "1 YEAR" ? "year" : "year",
            },
            ...(equity ? { equity: { minimumPercent: null, maximumPercent: null } } : {}),
          },
        }
      : {}),
    ...(description.match(/visa sponsorship/i)
      ? { visa: { sponsorship: "available" } }
      : {}),
    ...(existing ? { experience: { minimumYears: Number(existing[1]) } } : {}),
    postedAt: job.publishedAt?.slice(0, 10) ?? null,
    lastSeenAt: new Date().toISOString().slice(0, 10),
    description,
  };
}

async function main() {
  const response = await fetch(apiUrl);
  if (!response.ok) throw new Error(`Ashby returned ${response.status} for ${apiUrl}`);
  const payload = (await response.json()) as { jobs?: AshbyJob[] };
  const ashbyJobs = (payload.jobs ?? []).filter((job) => job.isListed !== false);
  if (!ashbyJobs.length) throw new Error(`Ashby returned no listed jobs for ${slug}`);

  const profile = JSON.parse(await readFile(profilePath, "utf8")) as {
    jobs?: Array<Record<string, unknown>>;
  };
  const previous = new Map(
    (profile.jobs ?? []).map((job) => [String(job.url ?? job.title), job]),
  );
  const jobs = ashbyJobs.map((job) => {
    const key = job.jobUrl;
    const old = previous.get(key) ?? previous.get(job.title) ?? {};
    const locations = [job.location, ...(job.secondaryLocations ?? []).map((item) => item.location ?? "")]
      .filter(Boolean)
      .filter((location, index, all) => all.indexOf(location) === index)
      .join("; ");
    return {
      ...old,
      title: job.title,
      location: locations,
      focus: focusFor(job.department, job.team, job.title),
      url: job.jobUrl,
      ...structuredFields(job),
    };
  });

  profile.jobs = jobs;
  await writeFile(profilePath, `${JSON.stringify(profile, null, 2)}\n`);
  console.log(`Synced ${jobs.length} listed Ashby jobs for ${slug} from ${apiUrl}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
