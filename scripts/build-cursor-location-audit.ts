import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

// Every source body was reviewed, not merely searched for the word "remote".
// Explicit role requirements take precedence over contradictory board headers.
const overrides: Record<
  string,
  {
    location: string;
    workplaceType: "hybrid" | "onsite" | null;
    evidence: string;
    note?: string;
  }
> = {
  "strategic-account-executive-enterprise-phillippines": {
    location: "Singapore",
    workplaceType: null,
    evidence: "You will be performing this role based in Singapore.",
    note: "Philippines is the sales territory, not a second job base.",
  },
  "strategic-account-executive-enterprise-thailand": {
    location: "Singapore",
    workplaceType: null,
    evidence: "This role will be based in Singapore.",
    note: "Body specifies Singapore; Thailand is the sales territory and APJ is the header region.",
  },
  "deal-desk-analyst-americas": {
    location: "San Francisco | New York",
    workplaceType: "onsite",
    evidence: "This role requires five days a week in office.",
  },
  "integrated-campaigns-amer": {
    location: "San Francisco",
    workplaceType: "onsite",
    evidence:
      "This is a full-time, in-office role based at our San Francisco headquarters.",
  },
  "regional-vice-president-commercial-sales-apj": {
    location: "Singapore | Sydney, NSW",
    workplaceType: null,
    evidence: "Singapore (Regional Hub) or Sydney, Australia",
  },
  "brand-paid-media-manager": {
    location: "San Francisco | New York",
    workplaceType: null,
    evidence:
      "This role is based in our San Francisco or New York City office and requires an in-office presence.",
    note: "Office attendance required despite Remote header; no onsite/hybrid schedule specified.",
  },
  "paid-media-manager": {
    location: "San Francisco | New York",
    workplaceType: null,
    evidence:
      "This role is based in our San Francisco or New York City office and requires an in-office presence.",
    note: "Office attendance required despite Remote header; no onsite/hybrid schedule specified.",
  },
  "regional-director-geo-enterprise": {
    location: "San Francisco",
    workplaceType: null,
    evidence: "based out of our San Francisco office",
    note: "Body requires SF Bay Area, conflicting with Austin header; attendance schedule is unspecified.",
  },
  "sales-development-leader-apj-australia": {
    location: "Sydney, NSW",
    workplaceType: "onsite",
    evidence:
      "This is a full-time, in-office leadership role based in our Sydney office.",
  },
  "sales-development-leader-apj-singapore": {
    location: "Singapore",
    workplaceType: "onsite",
    evidence:
      "This is a full-time, in-office leadership role based in our Singapore office.",
  },
  "sales-development-representative-anz": {
    location: "Sydney, NSW",
    workplaceType: null,
    evidence: "This role will be based in Sydney.",
  },
  "strategic-account-executive-federal-sales-australia": {
    location: "Sydney, NSW | Canberra, ACT",
    workplaceType: null,
    evidence: "based in either Sydney or Canberra",
  },
  "strategic-account-executive-federal-sales-civilian": {
    location: "DC-metro area",
    workplaceType: null,
    evidence: "based in the DC-metro area",
  },
  "strategic-account-executive-federal-sales-dow": {
    location: "DC-metro area",
    workplaceType: null,
    evidence: "based in the DC-metro area",
  },
  "startup-events-community": {
    location: "San Francisco",
    workplaceType: "onsite",
    evidence:
      "This role is based in our San Francisco office and requires working in-office",
  },
};

async function main() {
  const [input, output] = process.argv.slice(2);
  assert.ok(
    input && output,
    "Usage: build-cursor-location-audit.ts sources.json output.json",
  );
  const pages = JSON.parse(await readFile(input, "utf8")) as {
    url: string;
    markdown: string;
    error?: string;
  }[];
  assert.equal(pages.length, 132);
  assert.equal(new Set(pages.map((p) => p.url)).size, 132);
  const roles = pages
    .map((page) => {
      assert.ok(
        !page.error && page.markdown && !page.markdown.includes("[truncated]"),
        page.url,
      );
      assert.ok(
        page.markdown.length < 30000,
        `Potential output-cap truncation: ${page.url}`,
      );
      const body = page.markdown.split("## Apply for this role")[0];
      const header = body.match(/·\s*Full-time\s*·\s*([^\n]+)/)?.[1].trim();
      const title = body.match(/^# (.+)$/m)?.[1];
      assert.ok(header && title, page.url);
      const slug = new URL(page.url).pathname.split("/").pop()!;
      const override = overrides[slug];
      if (override)
        assert.ok(
          body.includes(override.evidence),
          `Missing reviewed quote: ${page.url}`,
        );
      const location =
        override?.location ??
        header
          .split(";")
          .map((s) => s.trim())
          .join(" | ");
      const workplaceType = override
        ? override.workplaceType
        : header.split(";").some((s) => s.trim() === "Remote")
          ? "remote"
          : null;
      return {
        url: page.url,
        title,
        header,
        location,
        workplaceType,
        evidence: override?.evidence ?? header,
        note:
          override?.note ??
          (workplaceType === null
            ? "Source lists geography, not an explicit workplace arrangement."
            : "Remote is an explicit source-header option, not a restriction on the listed cities."),
        bodySha256: createHash("sha256").update(body).digest("hex"),
      };
    })
    .sort((a, b) => a.url.localeCompare(b.url));
  for (const slug of Object.keys(overrides))
    assert.ok(
      roles.some((r) => r.url.endsWith(`/` + slug)),
      slug,
    );
  await writeFile(
    output,
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        source: "https://cursor.com/careers",
        roles,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Audited ${roles.length} full sources; ${roles.filter((r) => r.workplaceType === "remote").length} remote options; ${Object.keys(overrides).length} explicit body overrides.`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
