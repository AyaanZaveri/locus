import { readFile, writeFile } from "node:fs/promises";

import { sanitizeJobMarkdown } from "./lib/job-markdown";
import { sanitizeLocation } from "./lib/job-location";

const slug = process.argv[2] ?? "tavily";
// Board slug and profile slug can differ (board "togetherai" -> profile "together").
const profileSlug = process.argv[3] ?? slug;
const profilePath = new URL(`../data/companies/${profileSlug}/company.json`, import.meta.url);
const boardUrl = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;

type GreenhouseBoardJob = {
  id: number;
  title: string;
  absolute_url: string;
  updated_at?: string;
  first_published?: string;
  location?: { name?: string };
  metadata?: Array<{ name?: string; value?: string | null }>;
};

type GreenhouseJobDetail = GreenhouseBoardJob & {
  content?: string;
  departments?: Array<{ name?: string }>;
  offices?: Array<{ name?: string }>;
  company_name?: string;
};

const namedEntities: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
  middot: "·",
  trade: "™",
  reg: "®",
  copy: "©",
};

function decodeEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&([a-z]+);/gi, (match, name: string) => {
      const resolved = namedEntities[name.toLowerCase()];
      return resolved ?? match;
    });
}

/** Cuts a same-tag div block starting at `start`, balancing nested divs. */
function sliceDiv(html: string, start: number) {
  const tag = /<\/?div\b[^>]*>/gi;
  tag.lastIndex = start;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(html))) {
    depth += match[0][1] === "/" ? -1 : 1;
    if (depth === 0) return html.slice(start, tag.lastIndex);
  }
  return html.slice(start);
}

/** Extracts pay ranges, then removes the boilerplate pay-transparency block. */
function extractCompensation(html: string) {
  const ranges: Array<{ label: string; minimum: number; maximum: number }> = [];

  // A posting can carry more than one pay block (e.g. base range plus OTE range).
  let withoutBlock = html;
  for (let guard = 0; guard < 8; guard += 1) {
    const marker = withoutBlock.search(/<div class="content-pay-transparency"/i);
    if (marker === -1) break;
    const block = sliceDiv(withoutBlock, marker);
    for (const input of block.split(/<div class="pay-input">/i).slice(1)) {
      const label = input.match(/<div class="title"[^>]*>([\s\S]*?)<\/div>/i);
      const amounts = [...input.matchAll(/\$([\d,]+)/g)].map((match) =>
        Number(match[1].replace(/,/g, "")),
      );
      if (amounts.length >= 2) {
        ranges.push({
          label: decodeEntities(label?.[1] ?? "Compensation").trim(),
          minimum: Math.min(...amounts),
          maximum: Math.max(...amounts),
        });
      }
    }
    withoutBlock = withoutBlock.replace(block, "");
  }

  return { ranges, withoutBlock };
}

/** Remote only when stated as the work mode — not a "remote work reimbursement" perk. */
function isRemote(location: string, body: string) {
  if (/remote/i.test(location)) return true;
  return /(work remotely from|fully remote|remote-first|this (?:role|position) is remote|remote position|remote role)/i.test(
    body,
  );
}

function htmlToMarkdown(html: string) {
  let markdown = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<h[1-6][^>]*>\s*(?:<a[^>]*>\s*)?(?:<strong>)?\s*\u200b?\s*(?:<\/strong>)?\s*(?:<\/a>)?\s*<\/h[1-6]>/gi, "")
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
      const cleanText = String(text).replace(/<[^>]+>/g, "").trim();
      return cleanText && cleanText !== "\u200b" ? `[${cleanText}](${href})` : "";
    })
    .replace(/<[^>]+>/g, "");

  // Shared rules keep synced output identical to a normalized profile.
  return sanitizeJobMarkdown(markdown);
}

/** Derives a stable focus bucket from whatever labels the board provides. */
function focusFor(...labels: Array<string | undefined>) {
  const haystack = labels.filter(Boolean).join(" ").toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/research|research scientist/, "Research"],
    [/security|trust|safeguard|compliance/, "Security"],
    [/engineering|infrastructure|compute|hardware|api|platform/, "Engineering"],
    [/data science|analytics|data engineering/, "Data"],
    [/product/, "Product"],
    [/design/, "Design"],
    [/sales|revenue|partnership|business development|account executive/, "Sales"],
    [/marketing|brand|communication/, "Marketing"],
    [/legal|counsel/, "Legal"],
    [/finance|accounting|controllership/, "Finance"],
    [/people|human resources|recruiting|talent/, "People"],
    [/operations|customer success|support|program|enablement/, "Operations"],
  ];
  for (const [pattern, value] of rules) if (pattern.test(haystack)) return value;
  return "Other";
}

/** Falls back to a range stated in prose (Vercel "OTE pay range ... $X - $Y"). */
function payFromText(text: string) {
  const match = text.match(
    /\$\s?([\d][\d,]{3,})\s*(?:-|–|—|\bto\b)\s*\$?\s?([\d][\d,]{3,})/,
  );
  if (!match) return undefined;
  const a = Number(match[1].replace(/,/g, ""));
  const b = Number(match[2].replace(/,/g, ""));
  const minimum = Math.min(a, b);
  const maximum = Math.max(a, b);
  if (minimum < 10000 || maximum / minimum > 10) return undefined;
  return { minimum, maximum };
}

const workplaceMap: Record<string, "remote" | "hybrid" | "onsite"> = {
  remote: "remote",
  hybrid: "hybrid",
  "on-site": "onsite",
  onsite: "onsite",
};

function employmentFrom(title: string) {
  if (/\bintern(ship)?\b/i.test(title)) return "internship" as const;
  if (/\b(contract|contractor)\b/i.test(title)) return "contract" as const;
  if (/\bpart[- ]time\b/i.test(title)) return "part-time" as const;
  return "full-time" as const;
}

function experienceFrom(description: string) {
  const range = description.match(/(\d+)\s*[–-]\s*(\d+)\s*years/i);
  if (range) {
    return { minimumYears: Number(range[1]), maximumYears: Number(range[2]) };
  }
  const minimum = description.match(/(\d+)\s*\+\s*years/i);
  if (minimum) return { minimumYears: Number(minimum[1]) };
  return undefined;
}

async function main() {
  // One call with content=true carries every posting body, so large boards
  // (Anthropic, Vercel) don't need a request per job.
  const boardResponse = await fetch(`${boardUrl}?content=true`);
  if (!boardResponse.ok) {
    throw new Error(`Greenhouse board returned ${boardResponse.status} for ${boardUrl}`);
  }
  const board = (await boardResponse.json()) as { jobs?: GreenhouseJobDetail[] };
  let details = (board.jobs ?? []).filter((job) => job.content);

  if (!details.length) {
    const fallback = await fetch(boardUrl);
    if (!fallback.ok) {
      throw new Error(`Greenhouse board returned ${fallback.status} for ${boardUrl}`);
    }
    const listed = ((await fallback.json()) as { jobs?: GreenhouseBoardJob[] }).jobs ?? [];
    details = await Promise.all(
      listed.slice(0, 40).map(async (job) => {
        const response = await fetch(
          `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs/${job.id}?questions=false`,
        );
        if (!response.ok) {
          throw new Error(`Greenhouse returned ${response.status} for job ${job.id}`);
        }
        return (await response.json()) as GreenhouseJobDetail;
      }),
    );
  }

  if (!details.length) throw new Error(`Greenhouse returned no jobs for board "${slug}"`);

  const profile = JSON.parse(await readFile(profilePath, "utf8")) as {
    jobs?: Array<Record<string, unknown>>;
  };
  const previous = new Map(
    (profile.jobs ?? []).map((job) => [String(job.url ?? job.title), job]),
  );

  const jobs = details.map((job) => {
    // Boards label this differently: "Job Category" (Tavily) vs
    // "Career Site Categories" (Vercel).
    const category =
      job.metadata?.find((item) => /categor/i.test(item.name ?? ""))?.value ?? undefined;
    const locationType = job.metadata?.find((item) =>
      /location type/i.test(item.name ?? ""),
    )?.value;
    // Greenhouse returns the posting body entity-escaped; decode once to real HTML.
    const decoded = decodeEntities(job.content ?? "");
    const { ranges, withoutBlock } = extractCompensation(decoded);
    const description = htmlToMarkdown(withoutBlock);
    const salary =
      ranges.find((range) => /base/i.test(range.label)) ??
      ranges[0] ??
      payFromText(description);
    const old = previous.get(job.absolute_url) ?? previous.get(job.title) ?? {};
    const location = sanitizeLocation(job.location?.name ?? "");

    return {
      ...old,
      title: job.title.trim(),
      location,
      focus: focusFor(category, job.departments?.[0]?.name, job.title),
      url: job.absolute_url,
      description,
      status: "open",
      workplaceType:
        workplaceMap[(locationType ?? "").toLowerCase()] ??
        (isRemote(job.location?.name ?? "", description) ? "remote" : "onsite"),
      employmentType: employmentFrom(job.title),
      department: category ?? job.departments?.[0]?.name ?? null,
      ...(salary
        ? {
            compensation: {
              salary: {
                minimum: salary.minimum,
                maximum: salary.maximum,
                currency: "USD",
                period: "year",
              },
            },
          }
        : {}),
      ...(employmentFrom(job.title) === "internship"
        ? { experience: { level: "intern" as const } }
        : experienceFrom(description)
          ? { experience: experienceFrom(description) }
          : {}),
      postedAt: job.first_published?.slice(0, 10) ?? null,
      lastSeenAt: new Date().toISOString().slice(0, 10),
    };
  });

  profile.jobs = jobs;
  await writeFile(profilePath, `${JSON.stringify(profile, null, 2)}\n`);
  console.log(
    `Synced ${jobs.length} Greenhouse jobs for ${slug}. Pay ranges found: ${jobs.filter((job) => job.compensation).length}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
