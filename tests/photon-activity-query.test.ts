import assert from "node:assert/strict";
import { test } from "node:test";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import {
  activityQuerySchema,
  buildActivityQuery,
  activityQueryResult,
} from "../lib/ai/entity-queries";
import { companySource, fixtureCompanies } from "./query-fixtures";

const url = process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;
test(
  "Photon regression: October 1 funding and product events appear in latest, not September-only queries",
  { skip: !url },
  async () => {
    const db = drizzle({ client: neon(url!) });
    const fixture = {
      ...fixtureCompanies[0],
      slug: "photon",
      name: "Photon",
      profile: {
        activity: [
          {
            type: "funding",
            dateTime: "2026-10-01",
            title: "Photon raises $4.5M seed round",
            sourceUrl: "https://example.com/funding",
          },
          {
            type: "product",
            dateTime: "2026-10-01",
            title: "Ditto brings matchmaking to iMessage with Photon",
            sourceUrl: "https://example.com/ditto",
          },
        ],
      },
    };
    const run = async (input: Record<string, unknown>) => {
      const parsed = activityQuerySchema.parse(input);
      return activityQueryResult(
        (
          await db.execute(
            buildActivityQuery(parsed, "2026-10-02", companySource([fixture])),
          )
        ).rows,
        parsed,
        "2026-10-02",
      );
    };
    assert.equal((await run({ companySlugs: ["photon"] })).totalMatches, 2);
    const product = await run({ type: "product", limit: 3 });
    assert.equal(product.activity[0].slug, "photon");
    assert.equal(product.activity[0].date, "2026-10-01");
    assert.equal(
      (await run({ after: "2026-09-01", before: "2026-09-30" })).totalMatches,
      0,
    );
  },
);
