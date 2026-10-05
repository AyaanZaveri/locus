import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

async function main() {
  const root = process.argv[2];
  assert.ok(root);
  const load = async (name: string) =>
    JSON.parse(await readFile(join(root, name), "utf8"));
  const sha = (s: string) => createHash("sha256").update(s).digest("hex");
  for (const slug of ["convex", "weave", "tavily", "vooma", "harmonic"]) {
    const audit = await load(`batch2-${slug}-audit.json`);
    const pages = await load(`batch2-${slug}-pages.json`);
    const api = await load(`batch2-${slug}-api.json`);
    const board =
      slug === "convex"
        ? "convex-dev"
        : slug === "weave"
          ? "weave-os"
          : slug === "harmonic"
            ? "harmonic-ai"
            : slug;
    const apiUrl =
      slug === "tavily"
        ? "https://boards-api.greenhouse.io/v1/boards/tavily/jobs"
        : "https://api.ashbyhq.com/posting-api/job-board/" + board;
    const json = JSON.stringify(api);
    pages.push({
      url: apiUrl,
      markdown: json,
      title: "First-party structured ATS corroboration, not a Ketch body",
    });
    audit.removed = audit.roles
      .filter((r: any) => r.unavailable)
      .map((r: any) => r.url);
    audit.roles = audit.roles.filter((r: any) => !r.unavailable);
    for (const role of audit.roles) {
      const page = pages.find((p: any) => p.url === role.sourceUrl);
      assert.ok(page?.markdown, role.url);
      const md = page.markdown as string;
      assert.equal(sha(md), role.sourceSha256, role.url);
      const add = (quote: string) => {
        assert.ok(md.includes(quote), role.url + ": " + quote);
        role.evidence.push(quote);
      };
      const id =
        slug === "tavily"
          ? role.url.split("/jobs/")[1].split("?")[0]
          : role.url.split("/").pop();
      const job = api.jobs.find((j: any) =>
        slug === "tavily" ? String(j.id) === id : j.jobUrl.includes(id),
      );
      assert.ok(job, role.url);
      role.additionalEvidence = [
        {
          sourceUrl: apiUrl,
          sourceSha256: sha(json),
          evidence: [JSON.stringify(job)],
        },
      ];
      // Missing extracted metadata is not a conflict with explicit ATS metadata.
      // A vague in-person preference also does not contradict a Hybrid label.
      if (
        (slug === "convex" || slug === "harmonic") &&
        job.workplaceType === "Hybrid"
      ) {
        role.workplaceType = "hybrid";
        role.note =
          "Explicit exact-posting ATS Hybrid designation corroborates the full body; office preferences do not contradict it. No remote option or attendance schedule inferred.";
      }
      if (slug === "tavily") {
        role.location = job.location.name
          .split(";")
          .map((label: string) => {
            label = label.trim();
            if (
              label === "New York City, New York, United States" ||
              label === "New York, United States"
            )
              return "New York, NY";
            if (label === "Austin, Texas, United States") return "Austin, TX";
            if (label === "London, United Kingdom") return "London, UK";
            return label;
          })
          .filter(
            (label: string, index: number, all: string[]) =>
              all.indexOf(label) === index,
          )
          .join(" | ");
        if (
          md.includes(
            "This is a full-time, on-site role based in our New York office.",
          )
        )
          add(
            "This is a full-time, on-site role based in our New York office.",
          );
        if (
          md.includes("# Senior Site Reliability Engineer (In-Office Required)")
        )
          add("# Senior Site Reliability Engineer (In-Office Required)");
        if (md.includes("hybrid with the NYC team"))
          add(
            "This role is based in our New York office, hybrid with the NYC team.",
          );
        if (md.includes("**work hybrid from Tel Aviv, Israel.**"))
          add("**work hybrid from Tel Aviv, Israel.**");
        role.note =
          "Canonical geography follows the current exact posting, not the old location string. New York City uses its city identity; Austin-only legal listing does not retain an unsupported New York alternative. Work mode comes from explicit role prose.";
      }
      if (md.includes("approximately 10-20% travel")) {
        role.qualifier = "10–20% travel";
        add("approximately 10-20% travel");
      }
      if (md.includes("up to 25% of time on-site")) {
        role.qualifier = "up to 25% customer-site travel";
        add("up to 25% of time on-site");
      }
      if (md.includes("in office when you're not on the road")) {
        role.qualifier =
          "in office when not on the road; regular customer/conference travel";
        add("in office when you're not on the road");
      }
      if (md.includes("open to being in office 3 days a week")) {
        role.qualifier = "3 office days weekly";
        add("open to being in office 3 days a week");
      }
      if (md.includes("work in person 3+ days of the week at our office")) {
        role.qualifier = "3+ office days weekly";
        add("work in person 3+ days of the week at our office");
      }
      role.evidence = [...new Set(role.evidence)];
      for (const quote of role.evidence)
        assert.ok(md.includes(quote), role.url + ": " + quote);
      assert.ok(md.length < 30000 && role.evidence.length, role.url);
    }
    await writeFile(
      join(root, `batch2-${slug}-final-audit.json`),
      JSON.stringify(audit, null, 2) + "\n",
    );
    await writeFile(
      join(root, `batch2-${slug}-final-pages.json`),
      JSON.stringify(
        [...new Map(pages.map((p: any) => [p.url, p])).values()],
        null,
        2,
      ) + "\n",
    );
    console.log(
      slug,
      audit.roles.length,
      "verified;",
      audit.removed.length,
      "confirmed removal candidates",
    );
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
