import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../lib/db/client";
import { buildJobCategoryInventoryQuery } from "../lib/job-category-inventory";
import {
  getJobDepartmentIcon,
  hasSpecificJobDepartmentIcon,
} from "../components/job-department-icon";

async function main() {
  const { rows } = await db.execute(buildJobCategoryInventoryQuery());
  const inventory = rows.map((row) => {
    const label = String(row.label);
    return {
      label,
      icon: getJobDepartmentIcon(label).displayName ?? "Lucide icon",
      sources: row.sources as string[],
      fallback: !hasSpecificJobDepartmentIcon(label),
    };
  });
  const missing = inventory.filter((row) => row.fallback);
  const report = [
    "# Job category icon inventory",
    "",
    `Generated ${new Date().toISOString()} from Neon (read-only).`,
    "",
    `**${inventory.length} distinct labels; ${missing.length} using the generic fallback.**`,
    "Includes every department and focus label in the jobs table and company-profile jobs, regardless of job status.",
    "Future unrecognized labels always get BriefcaseBusiness; this audit flags them for a more specific mapping.",
    "BriefcasePlus is from Lucide Lab; the remaining icons are from lucide-react.",
    "",
    "| Category | Icon | Sources |",
    "| --- | --- | --- |",
    ...inventory.map(
      (row) =>
        `| ${row.label.replaceAll("|", "\\|")} | ${row.icon}${row.fallback ? " (fallback)" : ""} | ${row.sources.join(", ")} |`,
    ),
    "",
  ].join("\n");
  await mkdir("reports", { recursive: true });
  await writeFile("reports/job-category-icons.md", report);
  console.log(
    `${inventory.length} labels audited; ${missing.length} generic fallbacks. Report: reports/job-category-icons.md`,
  );
  if (missing.length) {
    console.error(
      "Needs a specific mapping:",
      missing.map((row) => row.label),
    );
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
