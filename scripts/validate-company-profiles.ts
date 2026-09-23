import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { parseCompanyProfile } from "../lib/company-profile.ts";
import {
  firstOutOfOrderRound,
  isGenericSkill,
  parseFundingDate,
  skillIsTraceable,
  unverifiedAmountMarker,
} from "./lib/company-profile-rules.ts";

type Money = { amount: number; currency: string; display: string } | null;

type Round = {
  id?: unknown;
  stage?: unknown;
  announcedAt?: unknown;
  amount?: Money;
  valuation?: Money;
};

type Job = {
  title?: unknown;
  description?: unknown;
  skills?: unknown;
};

type Profile = {
  financials?: { totalFunding?: Money } | null;
  funding?: { latestRoundId?: unknown; rounds?: Round[] } | null;
  jobs?: Job[];
};

const companiesDirectory = join(process.cwd(), "data", "companies");

function isMoney(value: unknown): value is NonNullable<Money> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Money)?.amount === "number" &&
    typeof (value as Money)?.display === "string"
  );
}

async function main() {
  const entries = await readdir(companiesDirectory, { withFileTypes: true });
  const failures: string[] = [];

  let profiles = 0;
  let jobs = 0;
  let jobsWithSkills = 0;
  let skills = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const file = join(companiesDirectory, entry.name, "company.json");
    let profile: Profile;
    try {
      profile = JSON.parse(await readFile(file, "utf8")) as Profile;
    } catch {
      continue;
    }

    try {
      parseCompanyProfile(profile as Record<string, unknown>);
    } catch (error) {
      failures.push(`${entry.name}: schema violation\n${String(error)}`);
      continue;
    }

    profiles += 1;
    const fail = (message: string) => failures.push(`${entry.name}: ${message}`);

    /* ---------------------------------------------------------------- */
    /* Funding                                                          */
    /* ---------------------------------------------------------------- */

    const rounds = profile.funding?.rounds ?? [];
    const totalFunding = profile.financials?.totalFunding ?? null;

    for (const round of rounds) {
      const announcedAt = round.announcedAt;
      if (typeof announcedAt === "string" && !parseFundingDate(announcedAt)) {
        fail(
          `round ${String(round.id)} has an invalid announcedAt ${JSON.stringify(announcedAt)}; use YYYY-MM-DD, YYYY-MM, YYYY, or null`,
        );
      }

      for (const [field, money] of [
        ["amount", round.amount],
        ["valuation", round.valuation],
      ] as const) {
        if (!isMoney(money)) continue;
        const marker = unverifiedAmountMarker(money.display);
        if (marker) {
          fail(
            `round ${String(round.id)} ${field} display ${JSON.stringify(money.display)} carries the unverified marker ${JSON.stringify(marker)}; source the real figure or drop the round`,
          );
        }
      }
    }

    const outOfOrder = firstOutOfOrderRound(
      rounds.map((round) =>
        typeof round.announcedAt === "string" ? round.announcedAt : null,
      ),
    );
    if (outOfOrder) {
      fail(
        `funding.rounds is not newest-first at index ${outOfOrder.index}: ${outOfOrder.current} follows ${outOfOrder.previous}`,
      );
    }

    const latestRoundId = profile.funding?.latestRoundId;
    if (rounds.length && latestRoundId !== rounds[0]?.id) {
      fail(
        `funding.latestRoundId ${JSON.stringify(latestRoundId)} does not reference rounds[0] ${JSON.stringify(rounds[0]?.id)}`,
      );
    }

    if (totalFunding && rounds.length) {
      const sum = rounds.reduce(
        (running, round) =>
          running + (isMoney(round.amount) ? round.amount.amount : 0),
        0,
      );
      if (sum !== totalFunding.amount) {
        const difference = totalFunding.amount - sum;
        fail(
          `funding.rounds sum to ${sum.toLocaleString()} but financials.totalFunding.amount is ${totalFunding.amount.toLocaleString()} (${difference > 0 ? "missing" : "excess"} ${Math.abs(difference).toLocaleString()}); a round is missing, duplicated, or mis-sized`,
        );
      }
    }

    /* ---------------------------------------------------------------- */
    /* Skills                                                           */
    /* ---------------------------------------------------------------- */

    for (const [index, job] of (profile.jobs ?? []).entries()) {
      jobs += 1;
      if (!Array.isArray(job.skills) || !job.skills.length) continue;

      const label = `job ${index} (${String(job.title ?? "Untitled")})`;
      const text = [job.title, job.description]
        .filter((value): value is string => typeof value === "string")
        .join("\n");

      const seen = new Set<string>();
      for (const skill of job.skills) {
        if (typeof skill !== "string" || !skill.trim()) continue;
        skills += 1;

        if (skill !== skill.trim()) {
          fail(`${label}: skill ${JSON.stringify(skill)} is not trimmed`);
        }
        if (seen.has(skill)) {
          fail(`${label}: skill ${JSON.stringify(skill)} is duplicated`);
        }
        seen.add(skill);

        if (isGenericSkill(skill)) {
          fail(
            `${label}: skill ${JSON.stringify(skill)} is a general competency, not a concrete tool, language, platform, or named standard`,
          );
          continue;
        }

        if (!skillIsTraceable(skill, text)) {
          fail(
            `${label}: skill ${JSON.stringify(skill)} is not named anywhere in the posting`,
          );
        }
      }

      jobsWithSkills += 1;
    }
  }

  if (failures.length) {
    console.error(`Invalid company profiles:\n\n${failures.join("\n\n")}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Validated ${profiles} company profiles: funding rounds are ordered, dated, and sum to their totals, and ${skills} skills across ${jobsWithSkills}/${jobs} jobs are concrete and traceable.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
