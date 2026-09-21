import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { sanitizeJobMarkdown } from "./lib/job-markdown";
import { sanitizeLocation } from "./lib/job-location";

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
      let changed = false;

      const currentDescription = job.description;
      if (typeof currentDescription === "string" && currentDescription) {
        const nextDescription = sanitizeJobMarkdown(currentDescription);
        if (nextDescription !== currentDescription) {
          job.description = nextDescription;
          changed = true;
        }
      }

      const currentLocation = job.location;
      if (typeof currentLocation === "string" && currentLocation) {
        const nextLocation = sanitizeLocation(currentLocation);
        if (nextLocation !== currentLocation) {
          job.location = nextLocation;
          changed = true;
        }
      }

      if (changed) touched += 1;
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
    `${dryRun ? "Would normalize" : "Normalized"} ${jobsChanged} job record(s) across ${companiesChanged} company profile(s).`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
