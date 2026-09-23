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
  ].map(normalizeSkill),
);

export function isGenericSkill(skill: string): boolean {
  return GENERIC_SKILLS.has(normalizeSkill(skill));
}

/**
 * Evidence patterns proving a chip is named by the posting. The default is the
 * chip itself, matched case-insensitively. Entries exist where the source spells
 * the thing differently from the canonical chip (an ATS writing "Postgres" for
 * `PostgreSQL`), where a tool is named by one of its products, or where a bare
 * match would hit ordinary prose and the casing must be respected.
 */
const SKILL_EVIDENCE: Record<string, RegExp[]> = {
  // Case-sensitive because the bare form is an ordinary word or a single letter.
  R: [/\bR\b/],
  Excel: [/\bExcel\b/],
  "REST API": [/\bREST\b/],
  Linear: [/\bLinear\b/],
  Notion: [/\bNotion\b/],
  Segment: [/\bSegment\b/],
  Slack: [/\bSlack\b/],
  Zoom: [/\bZoom\b/],
  Loom: [/\bLoom\b/],
  Cursor: [/\bCursor\b/],
  Ramp: [/\bRamp\b/],
  CircleCI: [/\bCircleCI\b/],
  Netlify: [/\bNetlify\b/],
  Mezmo: [/\bMezmo\b/],
  Playwright: [/\bPlaywright\b/],
  // Spelling variants and product aliases.
  TypeScript: [/\btypescript\b/i],
  PostgreSQL: [/\bpostgres(?:ql)?\b/i, /\baurora\b/i],
  OpenSearch: [/\bopensearch\b/i, /\belasticsearch\b/i],
  Redis: [/\bredis\b/i, /\belasticache\b/i],
  Kubernetes: [/\bkubernetes\b/i, /\bk8s\b/i],
  Docker: [/\bdocker\b/i, /containeri[sz]ed/i],
  "Node.js": [/\bnode\.?js\b/i],
  "SOC 2": [/\bsoc ?2\b/i],
  "ISO 27001": [/\biso ?27001\b/i],
  DocuSign: [/\bdocu ?sign\b/i, /e-?signature/i],
  CPQ: [/\bcpq\b/i, /quote[- ]to[- ]cash/i],
  ABM: [/\babm\b/i, /account[- ]based marketing/i],
  NRR: [/\bnrr\b/i, /net revenue retention/i],
  RAG: [/\brag\b/i, /retrieval[- ]augmented generation/i],
  LLM: [/\bllms?\b/i, /large language model/i],
  ETL: [/\betl\b/i, /\belt\b/i],
  "CI/CD": [/\bci\/cd\b/i, /continuous integration/i, /continuous deployment/i],
  MDM: [/\bmdm\b/i, /device management/i],
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
  Claygent: [/\bclaygents?\b/i],
  "Google Workspace": [/\bgoogle workspace\b/i, /\bgmail\b/i],
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
