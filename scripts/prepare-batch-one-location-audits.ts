import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Lead-reviewed corrections to the read-only evidence lanes. No database writes.
async function main() {
  const root = process.argv[2];
  assert.ok(root, "Provide the batch research directory");
  const hash = (s: string) => createHash("sha256").update(s).digest("hex");
  const load = async (name: string) =>
    JSON.parse(await readFile(join(root, name), "utf8"));
  for (const slug of [
    "linear",
    "coder",
    "openrouter",
    "parallel",
    "mintlify",
  ]) {
    const audit = await load(`batch1-${slug}-audit.json`);
    const snapshot = await load(`batch1-${slug}-snapshot.json`);
    const pages = await load(`batch1-${slug}-pages.json`);
    const apis: Record<string, string> = {
      openrouter: "openrouter-ashby.json",
      parallel: "parallel-api.json",
      mintlify: "mintlify-api.json",
    };
    const api = apis[slug] ? await load(apis[slug]) : null;
    const apiUrl =
      slug === "openrouter"
        ? "https://api.ashbyhq.com/posting-api/job-board/openrouter?includeCompensation=true"
        : `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`;
    const apiMarkdown = api ? JSON.stringify(api) : null;
    if (api)
      pages.push({
        url: apiUrl,
        markdown: apiMarkdown,
        title: "First-party structured ATS response (not a Ketch posting body)",
      });
    for (const role of audit.roles) {
      const page = pages.find((p: any) => p.url === role.sourceUrl);
      assert.ok(page?.markdown, role.url);
      const md = page.markdown as string;
      const stored = snapshot.jobs.find((j: any) => j.url === role.url);
      assert.ok(stored, role.url);
      const unavailable = /^##? (Page|Job) not found\b/im.test(md);
      if (unavailable) {
        Object.assign(role, {
          unavailable: true,
          location: stored.location,
          workplaceType: stored.workplace_type,
          evidence: [md.trim()],
          sourceSha256: hash(md),
          note: "Source unavailable; existing job, locations, workplace and status are preserved without claiming verification or closure.",
        });
        continue;
      }
      delete role.unavailable;
      const bodyLocation = md.split("\n");
      const add = (text: string) => {
        assert.ok(md.includes(text), `${role.url}: ${text}`);
        role.evidence.push(text);
      };
      if (slug === "linear") {
        if (
          md.includes(
            "work from our London office in Shoreditch 3 days per week",
          )
        ) {
          role.location = "Hybrid - London, UK";
          role.workplaceType = "hybrid";
          role.note =
            "Explicit London office attendance three days weekly overrides the previously stored remote classification.";
          add("work from our London office in Shoreditch 3 days per week");
        } else {
          role.workplaceType = "remote";
          const line = bodyLocation.find((l: string) =>
            l.includes("This role is open to candidates based"),
          );
          if (line) {
            add(line);
            if (line.includes("North America and the United Kingdom"))
              role.location =
                "Remote - North America | Remote - United Kingdom";
            else if (line.includes("the US and Europe"))
              role.location = "Remote - United States | Remote - Europe";
            else if (
              /North America (?:or|and) Europe|North American or European time zones/.test(
                line,
              )
            )
              role.location = "Remote - North America | Remote - Europe";
            if (line.includes("Pacific or Mountain Time")) {
              role.location = "Remote - United States | Remote - Canada";
              role.qualifier = "Pacific or Mountain Time only";
            } else if (line.includes("(west coast)"))
              role.qualifier = "west coast";
            else if (line.includes("(Eastern time zone)"))
              role.qualifier =
                "Eastern time zone; New York City area preferred";
            else if (line.includes("EST or CST preferred"))
              role.qualifier = "EST or CST preferred";
            else if (line.includes("EST time zone is preferred"))
              role.qualifier = "EST time zone preferred";
            else if (line.includes("North American or European time zones"))
              role.qualifier = "North American or European time zones";
            else if (line.includes("North America or Europe time zones"))
              role.qualifier = "North America or Europe time zones";
          }
          if (md.includes("# Design Engineer (Web & Brand)")) {
            const header = md.match(/## Location\n\n([^\n]+)/)?.[1];
            assert.ok(header);
            role.location = header!
              .split(";")
              .map((l: string) => `Remote - ${l.trim()}`)
              .join(" | ");
            add(`## Location\n\n${header}`);
            add("Work remotely, no commuting to the office");
          }
          role.note =
            "Remote arrangement verified on the individual posting. Explicit body eligibility and time-zone/preference constraints are preserved; optional co-working offices are not job bases. Any wider body scope than the listing header is recorded in the evidence.";
        }
      }
      if (slug === "coder") {
        if (md.includes("This position follows a hybrid work model.")) {
          role.workplaceType = "hybrid";
          role.location = "Hybrid - San Francisco, CA";
          add(
            "This position follows a hybrid work model. Candidates should be local and able to work from our local office on a regular weekly basis, with scheduling flexibility.",
          );
          role.note =
            "Explicit role-specific hybrid requirement; remote work mentioned elsewhere does not make this fully remote.";
        } else if (
          role.workplaceType === "remote" &&
          !role.location.startsWith("Remote")
        )
          role.location = `Remote - ${role.location}`;
        if (
          md.includes(
            "Physically based in the DC / Maryland / Virginia (DMV) area",
          )
        ) {
          role.location = "Remote - DC-metro area";
          role.qualifier = "customer-site travel as required";
          add(
            "Physically based in the DC / Maryland / Virginia (DMV) area, with ability to travel to customer sites as required",
          );
          role.note =
            "Role is remote but explicitly restricted to the DMV area, not the whole United States.";
        }
        if (md.includes("**Location:** Remote EMEA (UK preferred)")) {
          add("**Location:** Remote EMEA (UK preferred)");
          role.qualifier = "UK preferred";
          role.note =
            "Explicit ATS countries are retained; body describes wider EMEA and UK preference. Wider regional wording is not assumed to authorize every EMEA country.";
        }
      }
      if (slug === "parallel") {
        role.location = role.location.replace(
          /San Francisco or Palo Alto/g,
          "San Francisco, CA | Palo Alto, CA",
        );
        role.evidence = role.evidence.filter((e: string) => md.includes(e));
        if (!role.evidence.length) {
          add(
            "Our team works **fully in-person**, between our Palo Alto HQ and San Francisco office.",
          );
        }
      }
      if (api) {
        const id = role.url.match(/\/([a-f0-9-]{36})(?:\/|$)/)?.[1];
        const job = api.jobs.find((j: any) => j.jobUrl?.includes(id));
        if (job) {
          role.additionalEvidence = [
            {
              sourceUrl: apiUrl,
              sourceSha256: hash(apiMarkdown!),
              evidence: [
                `"jobUrl":${JSON.stringify(job.jobUrl)}`,
                `"location":${JSON.stringify(job.location)}`,
                ...(job.workplaceType
                  ? [`"workplaceType":${JSON.stringify(job.workplaceType)}`]
                  : []),
              ],
            },
          ];
          if (slug === "openrouter") {
            if (!md.includes("## Location\n")) {
              role.location = job.location;
              role.workplaceType =
                job.workplaceType === "Remote"
                  ? "remote"
                  : job.workplaceType === "Hybrid"
                    ? "hybrid"
                    : null;
              role.note =
                "Full individual body read; missing extracted header is corroborated by the current exact-posting first-party ATS fields, with no contradictory role requirement found.";
            }
            if (md.includes("## Location Type\n\nHybrid"))
              role.workplaceType = "hybrid";
            if (role.location === "Remote (US)")
              role.location = "Remote - United States";
            if (role.url.includes("44ef374e-b234-4d77-b002-8b38b4fda18f")) {
              role.qualifier = "Bay Area preferred; regular event travel";
              add(
                "The ideal candidate is based in the Bay Area, or has the ability to travel for events regularly.",
              );
              role.note =
                "Source explicitly lists Hybrid and Remote (US), with Bay Area preference/event travel. Preserve both facts; do not infer an office attendance schedule from events or a remote team.";
            }
          }
        }
      }
      role.evidence = [...new Set(role.evidence)];
      role.sourceSha256 = hash(md);
      if (!role.evidence.length && role.additionalEvidence?.length) {
        const title = md.match(/^# .+$/m)?.[0];
        assert.ok(title, role.url);
        role.evidence = [title];
      }
      for (const quote of role.evidence)
        assert.ok(
          md.includes(quote),
          `Invalid evidence: ${role.url}: ${quote}`,
        );
      assert.ok(role.location && role.evidence.length, role.url);
    }
    const uniquePages = [
      ...new Map(pages.map((p: any) => [p.url, p])).values(),
    ];
    await writeFile(
      join(root, `batch1-${slug}-final-audit.json`),
      JSON.stringify(audit, null, 2) + "\n",
    );
    await writeFile(
      join(root, `batch1-${slug}-final-pages.json`),
      JSON.stringify(uniquePages, null, 2) + "\n",
    );
    console.log(
      slug,
      audit.roles.length,
      "inventoried",
      audit.roles.filter((r: any) => r.unavailable).length,
      "unavailable",
    );
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
