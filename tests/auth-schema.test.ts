import assert from "node:assert/strict";
import { test } from "node:test";
import { getAuthTables } from "@better-auth/core/db";
import { getTableColumns } from "drizzle-orm";
import * as schema from "../lib/db/auth-schema";

test("Drizzle auth tables satisfy the installed Better Auth core schema", () => {
  const core = getAuthTables({});
  for (const name of ["user", "session", "account", "verification"] as const) {
    const columns = getTableColumns(schema[name]);
    assert.ok(columns.id.primary, `${name} needs its primary key`);
    for (const [field, definition] of Object.entries(core[name].fields)) {
      const column = columns[field as keyof typeof columns];
      assert.ok(column, `${name}.${field} is required by Better Auth`);
      if (definition.required)
        assert.ok(column.notNull, `${name}.${field} must be non-null`);
      if (definition.unique)
        assert.ok(column.isUnique, `${name}.${field} must be unique`);
      assert.equal(
        column.dataType,
        definition.type === "date"
          ? "date"
          : definition.type === "boolean"
            ? "boolean"
            : "string",
        `${name}.${field} type`,
      );
    }
  }
});
