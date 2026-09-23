/**
 * Infer `jobs[].skills` for one company from its own postings.
 *
 * ATS postings are not clean input. Two things in particular produce chips that
 * are not skills:
 *
 *   1. Shared boilerplate. Every posting repeats the same "About us" block, so a
 *      company fact like "we have 180k GitHub stars" would become a chip on all
 *      thirty jobs. Blocks that recur across most postings are dropped.
 *   2. Negation sections. Many boards include "What we're NOT looking for",
 *      which names the very things a candidate should not need. Matching there
 *      inverts the meaning.
 *
 * What remains is the role-specific text, matched against the shared vocabulary
 * in `company-profile-rules.ts`, so every emitted chip is traceable by
 * construction.
 *
 *   npx tsx scripts/infer-job-skills.ts <slug> [--write]
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { matchSkills } from "./lib/company-profile-rules.ts";

type Job = {
  title?: string;
  description?: string | null;
  skills?: string[];
};

type Profile = { slug?: string; jobs?: Job[] };

/** A heading whose body lists things the candidate should *not* have. */
const NEGATION_HEADING =
  /not looking for|not a fit|who this is not|what we are not|non-?negotiables|you might not/i;

/** A block repeated in at least this share of postings is company boilerplate. */
const BOILERPLATE_SHARE = 0.5;

function normalizeBlock(block: string): string {
  return block.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Split a description into blocks, dropping any block under a negation heading.
 * Headings and their bodies are kept together so a heading is judged by the
 * text it introduces.
 */
function contentBlocks(description: string): string[] {
  const blocks = description.split(/\n{2,}/);
  const kept: string[] = [];
  let negated = false;

  for (const block of blocks) {
    const heading = /^#{1,6}\s*(.+?)\s*$/.exec(block);
    if (heading) {
      negated = NEGATION_HEADING.test(heading[1]);
    }
    if (!negated) kept.push(block);
  }

  return kept;
}

/** Blocks appearing in most postings, i.e. the shared company blurb. */
function boilerplate(jobs: Job[]): Set<string> {
  const counts = new Map<string, number>();

  for (const job of jobs) {
    const seen = new Set<string>();
    for (const block of contentBlocks(job.description ?? "")) {
      const key = normalizeBlock(block);
      if (key.length < 40 || seen.has(key)) continue;
      seen.add(key);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const threshold = Math.max(2, Math.ceil(jobs.length * BOILERPLATE_SHARE));
  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count >= threshold)
      .map(([key]) => key),
  );
}

async function main() {
  const slug = process.argv[2];
  const write = process.argv.includes("--write");
  if (!slug) throw new Error("Usage: infer-job-skills.ts <slug> [--write]");

  const file = join(process.cwd(), "data", "companies", slug, "company.json");
  const profile = JSON.parse(await readFile(file, "utf8")) as Profile;
  const jobs = profile.jobs ?? [];

  const shared = boilerplate(jobs);
  const counts = new Map<string, number>();
  let empty = 0;

  console.log(`${slug}: ${jobs.length} jobs, ${shared.size} boilerplate blocks dropped\n`);

  for (const job of jobs) {
    const roleText = [
      job.title ?? "",
      ...contentBlocks(job.description ?? "").filter(
        (block) => !shared.has(normalizeBlock(block)),
      ),
    ].join("\n");

    const chips = matchSkills(roleText);
    if (!chips.length) empty += 1;
    for (const chip of chips) counts.set(chip, (counts.get(chip) ?? 0) + 1);

    console.log(`${(job.title ?? "Untitled").slice(0, 44).padEnd(46)} ${chips.join(", ") || "—"}`);

    if (write) job.skills = chips;
  }

  console.log(`\ndistinct chips: ${counts.size} | chips: ${[...counts.values()].reduce((a, b) => a + b, 0)} | jobs with none: ${empty}`);
  console.log("\nby frequency:");
  for (const [chip, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    const blanket = count >= jobs.length * 0.8 ? "  <-- on nearly every job, check for boilerplate leak" : "";
    console.log(`  ${String(count).padStart(4)} ${chip}${blanket}`);
  }

  if (!write) {
    console.log("\n(dry run; pass --write to set jobs[].skills)");
    return;
  }

  await writeFile(file, `${JSON.stringify(profile, null, 2)}\n`);
  console.log(`\nwrote skills to ${file}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
