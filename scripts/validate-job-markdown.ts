import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import remarkParse from "remark-parse";
import { unified } from "unified";

import {
  malformedStrongEmphasisRuns,
  sanitizeJobMarkdown,
} from "./lib/job-markdown";

type MarkdownNode = {
  type: string;
  value?: string;
  children?: MarkdownNode[];
};

type Profile = {
  jobs?: Array<{ title?: unknown; description?: unknown }>;
};

const companiesDirectory = join(process.cwd(), "data", "companies");
const parser = unified().use(remarkParse);

function rawStrongDelimiters(node: MarkdownNode): string[] {
  const problems =
    node.type === "text" && typeof node.value === "string"
      ? malformedStrongEmphasisRuns(node.value)
      : [];

  return [...problems, ...(node.children?.flatMap(rawStrongDelimiters) ?? [])];
}

async function main() {
  const entries = await readdir(companiesDirectory, { withFileTypes: true });
  const failures: string[] = [];
  let descriptions = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const file = join(companiesDirectory, entry.name, "company.json");
    let profile: Profile;
    try {
      profile = JSON.parse(await readFile(file, "utf8")) as Profile;
    } catch {
      continue;
    }

    for (const [index, job] of (profile.jobs ?? []).entries()) {
      if (typeof job.description !== "string" || !job.description) continue;
      descriptions += 1;

      const normalization = sanitizeJobMarkdown(job.description);
      if (normalization !== job.description) {
        failures.push(
          `${entry.name} job ${index} (${String(job.title ?? "Untitled")}): description is not normalized`,
        );
        continue;
      }

      const tree = parser.parse(job.description) as unknown as MarkdownNode;
      const problems = rawStrongDelimiters(tree);
      if (problems.length) {
        failures.push(
          `${entry.name} job ${index} (${String(job.title ?? "Untitled")}): invalid CommonMark strong emphasis: ${problems.join(", ")}`,
        );
      }
    }
  }

  if (failures.length) {
    console.error(`Invalid job Markdown:\n\n${failures.join("\n")}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Validated CommonMark in ${descriptions} job descriptions.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
