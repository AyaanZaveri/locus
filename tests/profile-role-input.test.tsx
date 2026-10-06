import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileRoleInput } from "../components/profile-role-input";
import {
  PROFILE_ROLES,
  getProfileRoleDepartment,
  searchProfileRoles,
} from "../lib/profile-roles";

test("role suggestions cover diverse teams and filter by title or discipline", () => {
  assert.ok(PROFILE_ROLES.length >= 90);
  assert.equal(
    new Set(PROFILE_ROLES.map((role) => role.label)).size,
    PROFILE_ROLES.length,
  );
  assert.ok(searchProfileRoles("backend").includes("Backend engineer"));
  assert.ok(searchProfileRoles("DESIGN").includes("Product designer"));
  assert.ok(searchProfileRoles("machine learning").includes("AI engineer"));
  assert.equal(getProfileRoleDepartment("Product designer"), "Design");
  assert.equal(
    getProfileRoleDepartment("Account executive"),
    "Sales & partnerships",
  );
});

test("custom and resume-supplied titles remain available without duplicate suggestions", () => {
  assert.ok(
    searchProfileRoles("Creative technologist").includes(
      "Creative technologist",
    ),
  );
  assert.ok(
    searchProfileRoles("", ["Engineer, developer experience"]).includes(
      "Engineer, developer experience",
    ),
  );
  assert.equal(
    searchProfileRoles("backend engineer").filter(
      (role) => role.toLowerCase() === "backend engineer",
    ).length,
    1,
  );
});

test("current role renders a single combobox with the matching team icon", () => {
  const markup = renderToStaticMarkup(
    <ProfileRoleInput
      id="currentRole"
      value="Product designer"
      onChange={() => {}}
    />,
  );
  assert.match(markup, /id="currentRole"/);
  assert.match(markup, /role="combobox"/);
  assert.match(markup, /lucide-pen-tool/);
  assert.doesNotMatch(markup, /data-slot="combobox-chip"/);
});

test("interested roles render as removable icon badges without splitting custom titles", () => {
  const markup = renderToStaticMarkup(
    <ProfileRoleInput
      id="desiredRoles"
      value=""
      onChange={() => {}}
      selectedValues={["Product designer", "Engineer, developer experience"]}
      onSelectedValuesChange={() => {}}
    />,
  );
  assert.equal((markup.match(/data-slot="combobox-chip"/g) ?? []).length, 2);
  assert.equal(
    (markup.match(/data-slot="combobox-chip-remove"/g) ?? []).length,
    2,
  );
  assert.match(markup, /lucide-pen-tool/);
  assert.match(markup, /Engineer, developer experience/);
  assert.match(markup, /Add role/);
  assert.match(markup, /id="desiredRoles"/);
});

test("role controls disable editing during resume extraction or saving", () => {
  for (const selectedValues of [undefined, ["Backend engineer"]]) {
    const markup = renderToStaticMarkup(
      <ProfileRoleInput
        id="roles"
        value=""
        onChange={() => {}}
        selectedValues={selectedValues}
        disabled
      />,
    );
    const input = markup.match(/<input\b[^>]*id="roles"[^>]*>/)?.[0];
    assert.ok(input);
    assert.match(input, /\sdisabled=""/);
  }
});
