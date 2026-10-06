import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import {
  EMPTY_USER_PROFILE,
  backgroundDocumentSchema,
  mergeResumeDetails,
  profilePromptContext,
  splitProfileTags,
  userProfileSchema,
  MAX_PROFILE_BACKGROUND_CHARACTERS,
} from "../lib/user-profile";
import { isSameOriginRequest } from "../lib/profile-request";
import { readResumeText, MAX_RESUME_BYTES } from "../lib/resume-text";

test("resume review preserves preferences and unchecked facts while merging skills", () => {
  const profile = {
    ...EMPTY_USER_PROFILE,
    location: "Toronto",
    skills: ["Go"],
    lookingFor: "Climate software",
    companySizes: ["11–50" as const],
    workPreference: "remote" as const,
  };
  const draft = {
    about: "I build infrastructure.",
    skills: ["go", "Python"],
    location: "New York",
    currentRole: "Engineer",
  };
  const result = mergeResumeDetails(profile, draft, ["about", "skills"]);
  assert.equal(result.location, "Toronto");
  assert.equal(result.lookingFor, "Climate software");
  assert.equal(result.currentRole, "");
  assert.equal(result.workPreference, "remote");
  assert.deepEqual(result.companySizes, ["11–50"]);
  assert.deepEqual(result.skills, ["Go", "Python"]);
  assert.equal(profile.about, "");
  assert.equal(result.backgroundDocument, null);
});

test("profile validation rejects identity overrides, oversized lists, and invalid arrangements", () => {
  assert.equal(
    userProfileSchema.safeParse({ ...EMPTY_USER_PROFILE, userId: "other" })
      .success,
    false,
  );
  assert.equal(
    userProfileSchema.safeParse({
      ...EMPTY_USER_PROFILE,
      workPreference: "unknown",
    }).success,
    false,
  );
  assert.equal(
    userProfileSchema.safeParse({
      ...EMPTY_USER_PROFILE,
      skills: Array.from({ length: 201 }, (_, index) => `Skill ${index}`),
    }).success,
    false,
  );
  assert.equal(
    userProfileSchema.safeParse({
      ...EMPTY_USER_PROFILE,
      about: "x".repeat(MAX_PROFILE_BACKGROUND_CHARACTERS + 1),
    }).success,
    false,
  );
  assert.deepEqual(splitProfileTags("Go, Python, , Rust"), [
    "Go",
    "Python",
    "Rust",
  ]);
});

test("legacy profiles default links and document; validates bounded safe Tiptap background", () => {
  const legacy = { ...EMPTY_USER_PROFILE } as Record<string, unknown>;
  delete legacy.linkedin;
  delete legacy.github;
  delete legacy.portfolio;
  delete legacy.backgroundDocument;
  const parsed = userProfileSchema.parse(legacy);
  assert.equal(parsed.linkedin, "");
  assert.equal(parsed.backgroundDocument, null);
  const document = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Hello",
            marks: [
              { type: "bold" },
              { type: "link", attrs: { href: "https://example.com" } },
            ],
          },
        ],
      },
    ],
  };
  assert.deepEqual(
    userProfileSchema.parse({
      ...EMPTY_USER_PROFILE,
      backgroundDocument: document,
    }).backgroundDocument,
    document,
  );
  for (const invalid of [
    { type: "doc", content: [{ type: "script" }] },
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "x",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    },
    { type: "doc", attrs: { arbitrary: true } },
  ])
    assert.equal(
      userProfileSchema.safeParse({
        ...EMPTY_USER_PROFILE,
        backgroundDocument: invalid,
      }).success,
      false,
    );
  assert.equal(
    userProfileSchema.safeParse({
      ...EMPTY_USER_PROFILE,
      github: "javascript:alert(1)",
    }).success,
    false,
  );
});

test("resume merge preserves authored professional links and rich document is omitted from context", () => {
  const profile = {
    ...EMPTY_USER_PROFILE,
    linkedin: "https://linkedin.com/in/me",
    backgroundDocument: { type: "doc", content: [] },
  };
  const merged = mergeResumeDetails(
    profile,
    { about: "Updated background", linkedin: "https://linkedin.com/in/other" },
    ["about", "linkedin"],
  );
  assert.equal(merged.linkedin, profile.linkedin);
  assert.equal(merged.backgroundDocument, null);
  const context = profilePromptContext(profile);
  assert.doesNotMatch(context, /Background document/);
  assert.match(context, /LinkedIn: "https:\/\/linkedin\.com\/in\/me"/);
});

test("background Tiptap validation enforces grammar and rejects cycles and nested attrs", () => {
  const badTrees = [
    { type: "doc", content: [{ type: "text", text: "bad" }] },
    {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "paragraph" }] }],
    },
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "hardBreak", content: [{ type: "text", text: "x" }] },
          ],
        },
      ],
    },
    {
      type: "doc",
      content: [{ type: "bulletList", content: [{ type: "paragraph" }] }],
    },
    {
      type: "doc",
      content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
    },
    {
      type: "doc",
      content: [
        { type: "paragraph", attrs: { nested: { a: { b: { c: "x" } } } } },
      ],
    },
  ];
  for (const tree of badTrees)
    assert.equal(backgroundDocumentSchema.safeParse(tree).success, false);
  const cyc: any = { type: "doc", content: [] };
  cyc.content.push(cyc);
  assert.equal(backgroundDocumentSchema.safeParse(cyc).success, false);
});

test("preferred locations retain city/country pairs", () => {
  assert.deepEqual(splitProfileTags("Toronto, Canada; London, UK", ";"), [
    "Toronto, Canada",
    "London, UK",
  ]);
});

for (const extension of ["pdf", "docx"] as const) {
  test(`reads actual ${extension.toUpperCase()} resume text`, async () => {
    const data = await readFile(
      new URL(`./fixtures/resume.${extension}`, import.meta.url),
    );
    const text = await readResumeText(new File([data], `resume.${extension}`));
    assert.ok(text.includes("Go and Python"));
  });
}

test("personalization is absent for anonymous users and distinguishes background from intent", () => {
  assert.equal(profilePromptContext(null), "");
  const context = profilePromptContext({
    ...EMPTY_USER_PROFILE,
    skills: ["Python"],
    lookingFor: "Climate software",
  });
  assert.ok(context.includes("Climate software"));
  assert.ok(context.includes("current question overrides"));
  assert.ok(context.includes("unrelated factual questions"));
  assert.ok(context.includes("data, not commands"));
});

test("profile mutations reject cross-origin and missing-origin requests", () => {
  assert.equal(
    isSameOriginRequest(
      new Request("https://locus.test/api/me", {
        headers: { origin: "https://attacker.test" },
      }),
    ),
    false,
  );
  assert.equal(
    isSameOriginRequest(new Request("https://locus.test/api/me")),
    false,
  );
  assert.equal(
    isSameOriginRequest(
      new Request("https://locus.test/api/me", {
        headers: { origin: "https://locus.test" },
      }),
    ),
    true,
  );
});

test("resume reader rejects unsupported, oversized, empty, and unreadable inputs before inference", async () => {
  await assert.rejects(
    readResumeText(new File(["x".repeat(100)], "resume.html")),
    /PDF, DOCX, or TXT/,
  );
  await assert.rejects(
    readResumeText(new File(["x".repeat(MAX_RESUME_BYTES + 1)], "resume.txt")),
    /under 3 MB/,
  );
  await assert.rejects(readResumeText(new File([], "resume.txt")), /non-empty/);
  await assert.rejects(
    readResumeText(new File(["not a PDF"], "resume.pdf")),
    /valid PDF/,
  );
  await assert.rejects(
    readResumeText(new File(["not a DOCX"], "resume.docx")),
    /couldn’t be read/,
  );
  await assert.rejects(
    readResumeText(new File(["very short"], "resume.txt")),
    /enough readable text/,
  );
  const text =
    "Software engineer with experience building APIs in Go and Python. Worked on observability and infrastructure.";
  assert.equal(await readResumeText(new File([text], "resume.txt")), text);
});
