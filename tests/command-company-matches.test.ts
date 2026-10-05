import assert from "node:assert/strict";
import { test } from "node:test";
import { immediateCompanyMatches } from "../lib/command-company-matches";

const companies = [
  { name: "Cursor Tools", slug: "cursor-tools" },
  { name: "Cursor", slug: "cursor" },
  { name: "Browser Use", slug: "browser-use" },
];

test("company navigation is immediately available with exact-first literal ranking", () => {
  assert.deepEqual(
    immediateCompanyMatches(companies, " Cursor ").map((x) => x.slug),
    ["cursor", "cursor-tools"],
  );
  assert.deepEqual(
    immediateCompanyMatches(companies, "CUR").map((x) => x.slug),
    ["cursor", "cursor-tools"],
  );
  assert.equal(
    immediateCompanyMatches(companies, "Use")[0].slug,
    "browser-use",
  );
  assert.equal(
    immediateCompanyMatches(companies, "browser u")[0].slug,
    "browser-use",
  );
  assert.equal(immediateCompanyMatches(companies, "Cursor", 1).length, 1);
  for (const q of ["", ".*", "%", "unknown", "ursor"])
    assert.deepEqual(immediateCompanyMatches(companies, q), []);
});
