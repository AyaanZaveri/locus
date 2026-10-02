import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import {
  Atom,
  BadgeCheck,
  BrainCircuit,
  BriefcaseBusiness,
  Building2,
  ChartCandlestick,
  ChartNoAxesCombined,
  Cpu,
  Factory,
  GraduationCap,
  Globe2,
  Headset,
  MonitorCog,
  ServerCog,
  ShieldCheck,
  UsersRound,
  Workflow,
} from "lucide-react";
import {
  getJobDepartmentIcon,
  hasSpecificJobDepartmentIcon,
} from "../components/job-department-icon";
import { buildJobCategoryInventoryQuery } from "../lib/job-category-inventory";

test("missing and specialized categories have appropriate icons", () => {
  const cases = [
    ["Brokerage & Capital Markets", ChartCandlestick],
    ["Kalshi Trading", ChartCandlestick],
    ["General", BriefcaseBusiness],
    ["Other", BriefcaseBusiness],
    ["Internships", GraduationCap],
    ["People Operations & Communications", UsersRound],
    ["AI Research & Engineering", BrainCircuit],
    ["Applied AI", BrainCircuit],
    ["Nuclear Operations", Atom],
    ["Factory", Factory],
    ["Manufacturing Staff", Factory],
    ["Consumer Devices", Cpu],
    ["Data Insights", ChartNoAxesCombined],
    ["Data Quality (Contract)", BadgeCheck],
    ["Risk", ShieldCheck],
    ["Safeguards (Trust & Safety)", ShieldCheck],
    ["Government & Public Policy", Globe2],
    ["IT Operations", MonitorCog],
    ["Workplace Experience", Building2],
    ["User Ops", Headset],
    ["CX", Headset],
    ["Scaling", ServerCog],
    ["Revenue Operations", Workflow],
    ["Technical Program Management", Workflow],
  ] as const;
  for (const [label, icon] of cases) {
    assert.equal(getJobDepartmentIcon(label), icon, label);
    assert.equal(hasSpecificJobDepartmentIcon(label), true, label);
  }
  assert.equal(getJobDepartmentIcon("  INTERNSHIPS  "), GraduationCap);
});

test("Lucide Lab icon renders with the same props as standard icons", () => {
  const Icon = getJobDepartmentIcon("Create your own role");
  assert.equal(Icon.displayName, "BriefcasePlus");
  const html = renderToStaticMarkup(
    createElement(Icon, {
      className: "category-icon",
      "aria-hidden": true,
      size: 16,
    }),
  );
  assert.match(html, /<svg/);
  assert.match(html, /category-icon/);
  assert.match(html, /width="16"/);
  assert.match(html, /aria-hidden="true"/);
});

test("new or empty categories always get a visible fallback icon", () => {
  for (const label of [
    "",
    "Uncategorized future discipline",
    "Quantum partnerships team 2070",
  ]) {
    assert.ok(getJobDepartmentIcon(label));
    assert.match(
      renderToStaticMarkup(createElement(getJobDepartmentIcon(label))),
      /<svg/,
    );
  }
  assert.equal(
    getJobDepartmentIcon("Uncategorized future discipline"),
    BriefcaseBusiness,
  );
});

const url = process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;
test(
  "every department/focus category in the database has an intentional, renderable icon",
  { skip: !url },
  async () => {
    const db = drizzle({ client: neon(url!) });
    const { rows } = await db.execute(buildJobCategoryInventoryQuery());
    assert.ok(rows.length > 0);
    const unmapped = rows
      .map((row) => String(row.label))
      .filter((label) => !hasSpecificJobDepartmentIcon(label));
    assert.deepEqual(
      unmapped,
      [],
      "Run audit:job-icons to map newly added categories",
    );
    for (const { label } of rows) {
      const html = renderToStaticMarkup(
        createElement(getJobDepartmentIcon(String(label)), {
          "aria-hidden": true,
        }),
      );
      assert.match(html, /<svg/, String(label));
    }
  },
);
