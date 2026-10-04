export type LocusTrace = {
  icon:
    | "company"
    | "evidence"
    | "jobs"
    | "navigation"
    | "people"
    | "search"
    | "semantic"
    | "selection";
  phase: "running" | "complete" | "error";
  label: string;
  detail?: string;
  logo?: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function quoted(value: string) {
  return `“${value.replace(/^"|"$/g, "")}”`;
}

function nameFromSlug(slug: unknown) {
  const value = text(slug);
  return value
    ? value
        .split("-")
        .map((word) => word[0]?.toUpperCase() + word.slice(1))
        .join(" ")
    : "company";
}

function count(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function noun(amount: number, singular: string, plural = `${singular}s`) {
  return `${amount} ${amount === 1 ? singular : plural}`;
}

function resultCount(value: unknown) {
  const output = record(value);
  return [
    noun(count(output.companies), "company", "companies"),
    noun(count(output.people), "person", "people"),
    noun(count(output.jobs), "role"),
  ]
    .filter((item) => !item.startsWith("0 "))
    .join(", ");
}

const toolIcons: Record<string, LocusTrace["icon"]> = {
  searchLocus: "search",
  searchKnowledge: "evidence",
  queryFunding: "evidence",
  queryJobs: "jobs",
  queryCompanies: "company",
  queryPeople: "people",
  queryActivity: "evidence",
  getCompany: "company",
  getCompanyProfile: "company",
  findCompanyPeople: "people",
  listCompanyPeople: "people",
  listCompanyJobs: "jobs",
  recommendOutreachTargets: "search",
  presentLocusResults: "selection",
  navigateLocus: "navigation",
};

/** A truthful, human-readable summary of one actual AI SDK tool part. */
export function describeLocusTool(part: unknown): LocusTrace | null {
  const value = record(part);
  const type = text(value.type);
  if (!type.startsWith("tool-")) return null;

  const toolName = type.slice(5);
  const input = record(value.input);
  const output = value.output;
  const state = text(value.state);
  const phase: LocusTrace["phase"] =
    state === "output-error" ||
    state === "output-denied" ||
    text(record(output).error)
      ? "error"
      : state === "output-available"
        ? "complete"
        : "running";
  const icon = toolIcons[toolName] ?? "search";
  const company = nameFromSlug(input.slug ?? input.companySlug);
  const logo = text(record(output).logo) || undefined;
  const query = text(input.query);
  const hasInput = state !== "input-streaming";
  const fallback = toolName.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();

  if (phase === "error") {
    return { icon, phase, label: `Couldn’t finish ${fallback}` };
  }

  if (toolName === "queryJobs" || toolName === "queryCompanies") {
    const retrieval = record(record(output).retrieval);
    const semanticQuery = text(input.semanticQuery);
    // Input tells us the requested mode while running; the actual output is
    // authoritative on completion (semantic requests can fall back to keywords).
    const semantic =
      phase === "complete"
        ? retrieval.mode === "semantic"
        : hasInput && Boolean(semanticQuery);
    const keywordFallback =
      phase === "complete" && retrieval.mode === "lexical-fallback";
    if (semantic || keywordFallback) {
      const jobs = toolName === "queryJobs";
      const amount = count(record(output)[jobs ? "jobs" : "companies"]);
      const singular = jobs ? "role" : "company";
      const plural = jobs ? "roles" : "companies";
      const coverage =
        typeof retrieval.embeddedRecords === "number" &&
        typeof retrieval.eligibleRecords === "number"
          ? `${retrieval.embeddedRecords}/${retrieval.eligibleRecords} eligible records embedded${retrieval.completeCoverage === false ? " · incomplete coverage" : ""}`
          : "";
      return {
        icon: semantic ? "semantic" : "search",
        phase,
        label: keywordFallback
          ? `Keyword fallback · ${amount ? `${noun(amount, singular, plural)} found` : "no matches"}`
          : phase === "complete"
            ? `Semantic search · ${amount ? `${noun(amount, singular, plural)} ranked` : `no ranked ${plural}`}`
            : `Semantic search · Ranking ${plural}`,
        detail:
          [
            keywordFallback
              ? text(retrieval.queryUsed)
              : text(retrieval.query) || semanticQuery,
            coverage,
            retrieval.queryCacheHit === true
              ? "Query vector reused from cache"
              : "",
            keywordFallback ? text(retrieval.reason) : "",
          ]
            .filter(Boolean)
            .join(" · ") || undefined,
      };
    }
  }

  switch (toolName) {
    case "queryJobs":
    case "queryCompanies":
    case "queryPeople":
    case "queryActivity": {
      const config = {
        queryJobs: {
          key: "jobs",
          singular: "matching role",
          plural: "matching roles",
          running: "Querying jobs",
        },
        queryCompanies: {
          key: "companies",
          singular: "matching company",
          plural: "matching companies",
          running: "Querying companies",
        },
        queryPeople: {
          key: "people",
          singular: "matching person",
          plural: "matching people",
          running: "Querying people",
        },
        queryActivity: {
          key: "activity",
          singular: "activity event",
          plural: "activity events",
          running: "Querying activity",
        },
      }[toolName];
      const amount = count(record(output)[config.key]);
      const modeLabel =
        toolName === "queryJobs" || toolName === "queryCompanies"
          ? "Database search · "
          : "";
      return {
        icon,
        phase,
        label:
          modeLabel +
          (phase === "complete"
            ? amount
              ? `Found ${noun(amount, config.singular, config.plural)}`
              : `No ${config.plural} found`
            : config.running),
        detail: hasInput
          ? [
              query,
              text(input.role),
              text(input.title),
              text(input.industry),
              text(input.location),
              text(input.workplaceType),
              text(input.type),
            ]
              .filter(Boolean)
              .join(" · ") || undefined
          : undefined,
      };
    }
    case "queryFunding": {
      const rounds = count(record(output).rounds);
      return {
        icon,
        phase,
        label:
          phase === "complete"
            ? rounds
              ? `Found ${noun(rounds, "funding round")}`
              : "No matching funding rounds"
            : "Querying funding rounds",
        detail: hasInput
          ? [
              text(input.companySlug),
              text(input.stage),
              text(input.investor),
              input.announcedAfter ? `From ${text(input.announcedAfter)}` : "",
              input.announcedBefore
                ? `Through ${text(input.announcedBefore)}`
                : "",
            ]
              .filter(Boolean)
              .join(" · ") || undefined
          : undefined,
      };
    }
    case "searchLocus": {
      const categories = Array.isArray(input.types)
        ? input.types.filter((item): item is string => typeof item === "string")
        : [];
      const detail = hasInput
        ? [categories.join(", "), query && quoted(query)]
            .filter(Boolean)
            .join(" · ")
        : undefined;
      const found = resultCount(output);
      return {
        icon,
        phase,
        label:
          phase === "complete"
            ? found
              ? `Found ${found}`
              : "No matching results found"
            : "Searching Locus",
        detail,
      };
    }
    case "searchKnowledge":
      return {
        icon,
        phase,
        label:
          phase === "complete"
            ? count(output)
              ? `Found ${noun(count(output), "matching passage")}`
              : "No matching passages found"
            : "Searching company profiles",
        detail:
          hasInput && query
            ? `${quoted(query)}${input.companySlug ? ` · ${nameFromSlug(input.companySlug)}` : ""}`
            : undefined,
      };
    case "getCompany":
    case "getCompanyProfile": {
      const section =
        toolName === "getCompanyProfile"
          ? text(input.section) || "profile"
          : "profile";
      const companyName = text(record(output).name) || company;
      return {
        icon,
        phase,
        logo,
        label:
          phase === "complete"
            ? `Found ${companyName} ${section}`
            : `Reviewing ${section}`,
        detail: phase === "running" && hasInput ? company : undefined,
      };
    }
    case "findCompanyPeople":
    case "listCompanyPeople":
      return {
        icon,
        phase,
        label:
          phase === "complete"
            ? count(output)
              ? `Found ${noun(count(output), "person", "people")}`
              : "No matching people recorded"
            : toolName === "findCompanyPeople"
              ? "Looking up a person"
              : "Reviewing the team",
        detail: hasInput
          ? [company, query].filter(Boolean).join(" · ")
          : undefined,
      };
    case "listCompanyJobs":
      return {
        icon,
        phase,
        label:
          phase === "complete"
            ? count(output)
              ? `Found ${noun(count(output), "matching role")}`
              : "No matching roles found"
            : "Matching open roles",
        detail: hasInput
          ? [company, text(input.criteria)].filter(Boolean).join(" · ")
          : undefined,
      };
    case "recommendOutreachTargets":
      return {
        icon,
        phase,
        label:
          phase === "complete"
            ? count(output)
              ? `Found ${noun(count(output), "outreach target")}`
              : "No outreach targets found"
            : "Finding outreach targets",
        detail: hasInput ? text(input.location) : undefined,
      };
    case "presentLocusResults": {
      const found = resultCount(output);
      return {
        icon,
        phase,
        label:
          phase === "complete"
            ? found
              ? `Selected ${found}`
              : "No cards to display"
            : "Preparing result cards",
      };
    }
    case "navigateLocus": {
      const destination = text(input.destination);
      const target =
        destination === "person"
          ? text(input.personName)
          : destination === "job"
            ? text(input.jobTitle)
            : company;
      return {
        icon,
        phase,
        label: phase === "complete" ? `Opening ${target}` : "Opening result",
        detail: hasInput && destination !== "company" ? company : undefined,
      };
    }
    default:
      return {
        icon,
        phase,
        label:
          phase === "complete" ? `Finished ${fallback}` : `Running ${fallback}`,
      };
  }
}
