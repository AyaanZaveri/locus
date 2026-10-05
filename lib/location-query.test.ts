import { test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  jobLocationPredicate,
  companyLocationPredicate,
} from "./location-query";

const dialect = new PgDialect();
test("location predicates use foreign-key links and parameterized aliases", () => {
  const q = dialect.sqlToQuery(
    jobLocationPredicate(sql`j.id`, sql`j.location`, "Sydney, Australia"),
  );
  assert.match(q.sql, /job_locations/);
  assert.match(q.sql, /location_aliases/);
  assert.ok(q.params.includes("sydney, nsw"));
  assert.ok(!q.sql.includes("Sydney"));
});
test("unknown input is a literal substring, not a SQL wildcard", () => {
  const q = dialect.sqlToQuery(
    companyLocationPredicate(
      sql`c.headquarters_location_id`,
      sql`c.location`,
      "%_'",
    ),
  );
  assert.match(q.sql, /strpos/);
  assert.ok(q.params.includes("%_'"));
  assert.ok(!q.sql.includes("%_'"));
});
