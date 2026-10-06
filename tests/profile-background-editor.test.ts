import assert from "node:assert/strict";
import test from "node:test";
import { MarkdownManager } from "@tiptap/markdown";
import {
  backgroundDocumentFromMarkdown,
  profileBackgroundExtensions,
} from "../lib/profile-background-editor";
import {
  EMPTY_USER_PROFILE,
  userProfileSchema,
  profilePromptContext,
  mergeResumeDetails,
} from "../lib/user-profile";

test("existing resume Markdown becomes headings, formatted text and lists without losing details", () => {
  const markdown =
    "## Experience\n\n**Acme — Engineer**, 2021–Present\n\n- Built APIs with **Go**; reduced latency 42%.\n- Project: [Search](https://example.com/search)\n\n## Education\n\nUniversity of Toronto, BSc 2021";
  const document = backgroundDocumentFromMarkdown(markdown);
  assert.equal(document.type, "doc");
  assert.equal(document.content?.[0].type, "heading");
  const parsed = userProfileSchema.parse({
    ...EMPTY_USER_PROFILE,
    about: markdown,
    backgroundDocument: document,
  });
  const exported = new MarkdownManager({
    extensions: profileBackgroundExtensions(),
  }).serialize(document);
  for (const detail of [
    "Acme",
    "2021–Present",
    "42%",
    "https://example.com/search",
    "University of Toronto",
    "BSc 2021",
  ])
    assert.ok(exported.includes(detail), detail);
  assert.ok(profilePromptContext(parsed).includes(JSON.stringify(markdown)));
  assert.doesNotMatch(profilePromptContext(parsed), /"type":"doc"/);
});

test("plain typed paragraphs and empty backgrounds remain supported", () => {
  for (const markdown of [
    "",
    "I build backend systems.\n\nI enjoy owning projects.",
  ]) {
    const document = backgroundDocumentFromMarkdown(markdown);
    assert.ok(
      userProfileSchema.safeParse({
        ...EMPTY_USER_PROFILE,
        about: markdown,
        backgroundDocument: document,
      }).success,
    );
  }
});

test("unsupported legacy code, tables and image labels retain their factual text", () => {
  const markdown =
    "Built `Go` APIs\n\n```\nImportant content\n```\n\n| School | Year |\n| --- | --- |\n| Toronto | 2021 |\n\n![Award](https://example.com/award.png)";
  const document = backgroundDocumentFromMarkdown(markdown);
  const exported = new MarkdownManager({
    extensions: profileBackgroundExtensions(),
  }).serialize(document);
  for (const detail of [
    "Go",
    "Important content",
    "Toronto",
    "2021",
    "Award",
    "https://example.com/award.png",
  ])
    assert.ok(exported.includes(detail), detail);
  assert.ok(
    userProfileSchema.safeParse({
      ...EMPTY_USER_PROFILE,
      about: exported,
      backgroundDocument: document,
    }).success,
  );
});

test("Focus receives saved professional links outside background", () => {
  const context = profilePromptContext({
    ...EMPTY_USER_PROFILE,
    github: "https://github.com/alex",
    linkedin: "https://linkedin.com/in/alex",
    portfolio: "https://alex.dev",
  });
  assert.match(context, /- GitHub: "https:\/\/github.com\/alex"/);
  assert.match(context, /- LinkedIn:/);
  assert.match(context, /- Portfolio:/);
  assert.doesNotMatch(context, /- Background:/);
});

test("autofill adds missing professional links but preserves authored links", () => {
  const merged = mergeResumeDetails(
    { ...EMPTY_USER_PROFILE, linkedin: "https://linkedin.com/in/authored" },
    {
      linkedin: "https://linkedin.com/in/imported",
      github: "https://github.com/alex",
      portfolio: "https://alex.dev",
    },
    ["linkedin", "github", "portfolio"],
  );
  assert.equal(merged.linkedin, "https://linkedin.com/in/authored");
  assert.equal(merged.github, "https://github.com/alex");
  assert.equal(merged.portfolio, "https://alex.dev");
});
