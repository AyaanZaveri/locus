import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { parseCompanyProfile } from "../lib/company-profile.ts";

const companiesDirectory = join(process.cwd(), "data", "companies");
const entries = await readdir(companiesDirectory, { withFileTypes: true });
const companyDirectories = entries.filter((entry) => entry.isDirectory());
const failures: string[] = [];

for (const entry of companyDirectories) {
  const profilePath = join(companiesDirectory, entry.name, "company.json");

  try {
    const source = await readFile(profilePath, "utf8");
    parseCompanyProfile(JSON.parse(source) as Record<string, unknown>);
  } catch (error) {
    failures.push(`${profilePath}\n${String(error)}`);
  }
}

if (failures.length) {
  console.error(`Invalid company profiles:\n\n${failures.join("\n\n")}`);
  process.exitCode = 1;
} else {
  console.log(`Validated ${companyDirectories.length} company profiles.`);
}
