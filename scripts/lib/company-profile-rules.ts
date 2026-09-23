/**
 * Semantic rules for company profiles that Zod cannot express.
 *
 * `company-profile.schema.json` describes shape: a round has an `announcedAt`
 * string, a job has a `skills` string array. It cannot say that the date must
 * be a real date, that rounds must be ordered, that the rounds must sum to the
 * stated total, or that a skill must name a concrete thing rather than a
 * competency. Those are the rules the research skill relies on, so they live
 * here and are enforced by `validate:companies`.
 *
 * Both the validator and any future skill extraction import this module, so the
 * accepted vocabulary cannot drift between writing and checking.
 */

/* -------------------------------------------------------------------------- */
/* Funding dates                                                              */
/* -------------------------------------------------------------------------- */

export type DatePrecision = "day" | "month" | "year";

/**
 * A verified partial date is better than `null` and better than a padded
 * invention, so `YYYY` and `YYYY-MM` are accepted. Anything else is not a date.
 */
const DATE_PRECISIONS: Array<{ precision: DatePrecision; pattern: RegExp }> = [
  { precision: "day", pattern: /^(\d{4})-(\d{2})-(\d{2})$/ },
  { precision: "month", pattern: /^(\d{4})-(\d{2})$/ },
  { precision: "year", pattern: /^(\d{4})$/ },
];

export type ParsedDate = {
  precision: DatePrecision;
  /** Comparable numeric key; more precise values sort within their year/month. */
  sortKey: number;
};

export function parseFundingDate(value: string): ParsedDate | null {
  for (const { precision, pattern } of DATE_PRECISIONS) {
    const match = pattern.exec(value);
    if (!match) continue;

    const year = Number(match[1]);
    const month = precision === "year" ? 0 : Number(match[2]);
    const day = precision === "day" ? Number(match[3]) : 0;

    if (month < 0 || month > 12) return null;
    if (day < 0 || day > 31) return null;

    return { precision, sortKey: year * 10_000 + month * 100 + day };
  }

  return null;
}

/**
 * Rounds must be newest-first. Undated rounds carry no ordering information, so
 * they are skipped rather than treated as oldest; the dated rounds around them
 * must still be non-increasing.
 */
export function firstOutOfOrderRound(
  dates: Array<string | null>,
): { index: number; previous: string; current: string } | null {
  let previous: { value: string; sortKey: number } | null = null;

  for (const [index, value] of dates.entries()) {
    if (value === null) continue;

    const parsed = parseFundingDate(value);
    if (!parsed) continue;

    if (previous && parsed.sortKey > previous.sortKey) {
      return { index, previous: previous.value, current: value };
    }

    previous = { value, sortKey: parsed.sortKey };
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Amounts                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Markers that mean a figure was reconstructed rather than disclosed. A
 * fabricated amount must never enter the profile, so the validator rejects it
 * instead of letting it pass as a real number.
 */
const UNVERIFIED_AMOUNT_MARKERS = [
  "derived",
  "estimated",
  "estimate",
  "reported",
  "unconfirmed",
  "rumoured",
  "rumored",
];

export function unverifiedAmountMarker(display: string): string | null {
  const normalized = display.toLowerCase();
  return (
    UNVERIFIED_AMOUNT_MARKERS.find((marker) => normalized.includes(marker)) ??
    null
  );
}

/* -------------------------------------------------------------------------- */
/* Skills                                                                     */
/* -------------------------------------------------------------------------- */

function normalizeSkill(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Chips that name a general activity, business function, department, or
 * personal attribute rather than a specific tool, language, platform, or named
 * standard. These describe what a team does or what a person is like; they are
 * not filterable skills.
 */
const GENERIC_SKILLS = new Set(
  [
    // Personal attributes and soft skills
    "communication",
    "written communication",
    "verbal communication",
    "collaboration",
    "cross functional collaboration",
    "teamwork",
    "leadership",
    "mentoring",
    "coaching",
    "mentoring and coaching",
    "negotiation",
    "problem solving",
    "critical thinking",
    "attention to detail",
    "detail oriented",
    "time management",
    "prioritization",
    "multitasking",
    "stakeholder management",
    "project management",
    "program management",
    "ownership",
    "autonomy",
    "curiosity",
    "adaptability",
    "empathy",
    "interpersonal skills",
    "organizational skills",
    "presentation skills",
    "public speaking",
    "facilitation",
    "decision making",
    "conflict resolution",
    "relationship building",
    "strategic thinking",
    "analytical skills",
    "analytical thinking",
    "self starter",
    "builder dna",
    // Business functions and departments
    "accounting",
    "accounts payable",
    "accounts receivable",
    "fixed assets",
    "bookkeeping",
    "payroll",
    "tax",
    "financial reporting",
    "finance",
    "forecasting",
    "fp a",
    "financial planning and analysis",
    "audit",
    "internal controls",
    "revops",
    "revenue operations",
    "procurement",
    "sales",
    "enterprise sales",
    "full cycle sales",
    "business development",
    "pipeline generation",
    "lead generation",
    "quota carrying",
    "customer success",
    "customer support",
    "technical support",
    "marketing",
    "go to market",
    "gtm",
    "legal",
    "operations",
    "engineering",
    "design",
    "product management",
    "implementation",
    "onboarding",
    "quality assurance",
    "testing",
    "code review",
    // Engineering disciplines and practices
    "debugging",
    "infrastructure",
    "networking",
    "distributed systems",
    "system design",
    "architecture",
    "scalability",
    "reliability",
    "performance",
    "observability",
    "security",
    "compliance",
    "governance",
    "risk management",
    "gpu orchestration",
    "integrations",
    "ai agents",
    "llm applications",
    "machine learning",
    "full stack development",
    "full stack engineering",
    "product engineering",
    "solutions engineering",
    "solution architecture",
    "developer relations",
    "developer experience",
    "developer tools",
    "open source",
    "technical writing",
    "technical content",
    "technical sales",
    "browser automation",
    "browser security",
    "video",
    "data analysis",
    "reporting",
    "saas",
    "b2b",
    "enterprise",
    // Interface types and metrics, which are concepts rather than tools. A named
    // interface style (`REST API`, `GraphQL`, `MCP`) is still a skill.
    "apis",
    "sdks",
    "nrr",
    "net revenue retention",
    "arr",
    "ote",
    "cac",
    "ltv",
  ].map(normalizeSkill),
);

export function isGenericSkill(skill: string): boolean {
  return GENERIC_SKILLS.has(normalizeSkill(skill));
}

/**
 * Evidence patterns proving a chip is named by the posting, and the accepted
 * vocabulary for extraction. Entries exist where the source spells the thing
 * differently from the canonical chip (an ATS writing "Postgres" for
 * `PostgreSQL`), where a tool is named by one of its products, or where a bare
 * match would hit ordinary prose and the casing must be respected.
 *
 * Every chip the extractor can emit has an entry here, so a chip written by
 * `infer-job-skills` always passes `skillIsTraceable`. Adding an entry widens
 * both extraction and validation at once.
 */
const SKILL_EVIDENCE: Record<string, RegExp[]> = {
  // Languages
  Python: [/\bpython\b/i],
  TypeScript: [/\btypescript\b/i],
  JavaScript: [/\bjavascript\b/i],
  SQL: [/\bsql\b/i],
  "C++": [/\bc\+\+/],
  R: [/\bR\b/],
  // Frontend
  React: [/\breact\b/i],
  "Next.js": [/\bnext\.?js\b/i],
  Tailwind: [/\btailwind\b/i],
  Webflow: [/\bwebflow\b/i],
  // Runtimes, protocols, interfaces
  "Node.js": [/\bnode\.?js\b/i],
  "REST API": [/\bREST\b/],
  GraphQL: [/\bgraphql\b/i],
  APIs: [/\bapis?\b/i],
  SDKs: [/\bsdks?\b/i],
  MCP: [/\bmcps?\b/i],
  CLI: [/\bclis?\b/i],
  Git: [/\bgit\b/i],
  "CI/CD": [/\bci\/cd\b/i, /continuous integration/i, /continuous deployment/i],
  // Cloud and infrastructure
  AWS: [
    /\baws\b/i,
    /\bec2\b/i,
    /\becs\b/i,
    /\bfargate\b/i,
    /\blambda\b/i,
    /\bs3\b/i,
    /\becr\b/i,
    /\bcloudwatch\b/i,
  ],
  GCP: [/\bgcp\b/i, /google cloud/i],
  Azure: [/\bazure\b/i],
  Vercel: [/\bvercel\b/i],
  Netlify: [/\bNetlify\b/],
  Terraform: [/\bterraform\b/i],
  Kubernetes: [/\bkubernetes\b/i, /\bk8s\b/i],
  Docker: [/\bdocker\b/i, /containeri[sz]ed/i],
  Linux: [/\blinux\b/i],
  Chromium: [/\bchromium\b/i],
  microVMs: [/\bmicro ?vms?\b/i],
  unikernels: [/\bunikernels?\b/i],
  Datadog: [/\bdatadog\b/i],
  Mezmo: [/\bMezmo\b/],
  CircleCI: [/\bCircleCI\b/],
  // Browsers and automation
  Playwright: [/\bPlaywright\b/],
  Puppeteer: [/\bpuppeteer\b/i],
  CDP: [/\bcdp\b/i],
  // Data
  PostgreSQL: [/\bpostgres(?:ql)?\b/i, /\baurora\b/i],
  OpenSearch: [/\bopensearch\b/i, /\belasticsearch\b/i],
  Redis: [/\bredis\b/i, /\belasticache\b/i],
  ClickHouse: [/\bclick ?house\b/i],
  Snowflake: [/\bsnowflake\b/i],
  dbt: [/\bdbt\b/i],
  Airflow: [/\bairflow\b/i],
  ETL: [/\betl\b/i, /\belt\b/i],
  GA4: [/\bga4\b/i],
  Mixpanel: [/\bmixpanel\b/i],
  Segment: [/\bSegment\b/],
  // AI. `LLM` is matched only where it qualifies engineering work: the bare
  // term also appears in product copy ("LLM-ready", "LLM answers"), which
  // describes the product rather than a skill the role needs.
  LLM: [
    /\bLLMs?\b(?=[\s-]*(?:in production|applications?|engineering|evals?|evaluation|outputs?|driven|based|models?|pipelines?|inference|training|agents?))/i,
    /\b(?:build|built|building|use|using|uses|worked|working|experience)\s+(?:with\s+)?LLMs?\b/i,
  ],
  Claude: [/\bclaude\b/i],
  ChatGPT: [/\bchatgpt\b/i],
  Evals: [/\bevals\b/i],
  RAG: [/\brag\b/i, /retrieval[- ]augmented generation/i],
  // Security and compliance
  "SOC 2": [/\bsoc ?2\b/i],
  "ISO 27001": [/\biso ?27001\b/i],
  GDPR: [/\bgdpr\b/i],
  CCPA: [/\bccpa\b/i],
  SSO: [/\bsso\b/i],
  SAML: [/\bsaml\b/i],
  Okta: [/\bokta\b/i],
  MDM: [/\bmdm\b/i, /device management/i],
  // Finance, legal and operations software
  NetSuite: [/\bnetsuite\b/i],
  QuickBooks: [/\bquickbooks\b/i],
  Campfire: [/\bcampfire\b/i],
  Ramp: [/\bRamp\b/],
  ERP: [/\berp\b/i],
  GAAP: [/\bgaap\b/i],
  Ironclad: [/\bironclad\b/i],
  DocuSign: [/\bdocu ?sign\b/i, /e-?signature/i],
  CPQ: [/\bcpq\b/i, /quote[- ]to[- ]cash/i],
  Excel: [/\bExcel\b/],
  // Go-to-market and collaboration
  Salesforce: [/\bsalesforce\b/i],
  HubSpot: [/\bhub ?spot\b/i],
  Gong: [/\bgong\b/i],
  ABM: [/\babm\b/i, /account[- ]based marketing/i],
  NRR: [/\bnrr\b/i, /net revenue retention/i],
  SEO: [/\bseo\b/i],
  Notion: [/\bNotion\b/],
  Linear: [/\bLinear\b/],
  Slack: [/\bSlack\b/],
  Zoom: [/\bZoom\b/],
  Loom: [/\bLoom\b/],
  Cursor: [/\bCursor\b/],
  Rootly: [/\brootly\b/i],
  "Google Workspace": [/\bgoogle workspace\b/i, /\bgmail\b/i],
  // Clay-specific surface
  Claygent: [/\bclaygents?\b/i],
  "Clay University": [/\bclay university\b/i],
  Waterfall: [/\bwaterfall\b/i],
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Keys are matched case-insensitively, and a chip's singular form is accepted,
 * because a posting may write "SDK" where the chip reads `SDKs`.
 */
const SKILL_EVIDENCE_LOWER = new Map(
  Object.entries(SKILL_EVIDENCE).map(([key, patterns]) => [
    key.toLowerCase(),
    patterns,
  ]),
);

/**
 * True when the posting itself names the chip. A skill that cannot be found in
 * the job's own text was inferred from the title, the company stack, or
 * industry convention, which the research standard forbids.
 */
export function skillIsTraceable(skill: string, text: string): boolean {
  const key = skill.toLowerCase();
  const patterns =
    SKILL_EVIDENCE_LOWER.get(key) ??
    SKILL_EVIDENCE_LOWER.get(key.replace(/s$/, "")) ?? [
      // Strip a trailing plural before adding the optional one, or a chip like
      // `SDKs` compiles to /SDKss?/ and never matches the singular in the text.
      new RegExp(`\\b${escapeRegExp(skill.replace(/s$/, ""))}s?`, "i"),
    ];

  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Every chip named by the given text, in vocabulary order, excluding anything
 * the blocklist rejects. This is the inverse of `skillIsTraceable`: anything it
 * returns is traceable and concrete by construction, so an extractor using it
 * cannot write a chip the validator would reject.
 */
export function matchSkills(text: string): string[] {
  return Object.entries(SKILL_EVIDENCE)
    .filter(([chip, patterns]) => !isGenericSkill(chip) && patterns.some((pattern) => pattern.test(text)))
    .map(([chip]) => chip);
}

/** The accepted chip vocabulary, for reporting coverage. */
export function skillVocabulary(): string[] {
  return Object.keys(SKILL_EVIDENCE);
}
