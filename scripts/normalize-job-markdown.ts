import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { sanitizeJobMarkdown } from "./lib/job-markdown";

const companiesDir = new URL("../data/companies/", import.meta.url);
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const entries = await readdir(companiesDir, { withFileTypes: true });
  let companiesChanged = 0;
  let jobsChanged = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const file = join(companiesDir.pathname, entry.name, "company.json");
    let profile: { jobs?: Array<Record<string, unknown>> };
    try {
      profile = JSON.parse(await readFile(file, "utf8")) as typeof profile;
    } catch {
      continue;
    }
    if (!Array.isArray(profile.jobs)) continue;

    let touched = 0;
    for (const job of profile.jobs) {
      const current = job.description;
      if (typeof current !== "string" || !current) continue;
      const next = sanitizeJobMarkdown(current);
      if (next !== current) {
        job.description = next;
        touched += 1;
      }
    }

    if (touched) {
      companiesChanged += 1;
      jobsChanged += touched;
      if (!dryRun) {
        await writeFile(file, `${JSON.stringify(profile, null, 2)}\n`);
      }
      console.log(`${dryRun ? "[dry-run] " : ""}${entry.name}: ${touched} job(s)`);
    }
  }

  console.log(
    `${dryRun ? "Would normalize" : "Normalized"} ${jobsChanged} job description(s) across ${companiesChanged} company profile(s).`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
