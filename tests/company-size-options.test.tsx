import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CompanySizeOptions } from "../components/company-size-options";

test("company sizes use the team buttons, not checkbox controls", () => {
  const markup = renderToStaticMarkup(
    <CompanySizeOptions value={[]} onValueChange={() => {}} />,
  );
  assert.equal((markup.match(/<button/g) ?? []).length, 6);
  assert.equal((markup.match(/aria-pressed="false"/g) ?? []).length, 6);
  assert.doesNotMatch(markup, /role="checkbox"|type="checkbox"/);
  assert.equal((markup.match(/style="width:0px"/g) ?? []).length, 6);
  assert.match(markup, /dark:bg-input\/30/);
  assert.match(markup, /active:not-aria-\[haspopup\]:scale-\[0\.98\]/);
});

test("selected sizes use filled buttons with a checkmark", () => {
  const markup = renderToStaticMarkup(
    <CompanySizeOptions value={["11–50", "51–200"]} onValueChange={() => {}} />,
  );
  assert.equal((markup.match(/aria-pressed="true"/g) ?? []).length, 2);
  assert.equal((markup.match(/data-selected="true"/g) ?? []).length, 2);
  assert.equal((markup.match(/style="width:22px"/g) ?? []).length, 2);
  assert.match(markup, /bg-primary text-primary-foreground/);
});

test("size buttons are disabled during saving or extraction", () => {
  const markup = renderToStaticMarkup(
    <CompanySizeOptions value={[]} disabled onValueChange={() => {}} />,
  );
  assert.equal((markup.match(/\sdisabled=""/g) ?? []).length, 6);
});
