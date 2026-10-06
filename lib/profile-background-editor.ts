import StarterKit from "@tiptap/starter-kit";
import { Extension } from "@tiptap/core";
import { Markdown, MarkdownManager } from "@tiptap/markdown";

// A writing field, not a document builder. Keep import and editing identical.
export function profileBackgroundExtensions() {
  return [
    StarterKit.configure({
      blockquote: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
      underline: false,
      link: {
        openOnClick: false,
        protocols: ["http", "https"],
        isAllowedUri: (url) => /^https?:\/\//i.test(url),
      },
    }),
    // Unsupported legacy formatting must never silently discard resume facts.
    ...["codespan", "code", "table", "image", "html"].map((tokenName) =>
      Extension.create({
        name: `backgroundImport_${tokenName}`,
        markdownTokenName: tokenName,
        parseMarkdown: (token, helpers) => {
          const text =
            tokenName === "image"
              ? [token.text, token.href].filter(Boolean).join(" — ")
              : tokenName === "table" || tokenName === "html"
                ? token.raw
                : token.text;
          const content = text ? [helpers.createTextNode(String(text))] : [];
          return tokenName === "codespan" ||
            tokenName === "image" ||
            (tokenName === "html" && !token.block)
            ? content
            : helpers.createNode("paragraph", undefined, content);
        },
      }),
    ),
    Markdown,
  ];
}

export function backgroundDocumentFromMarkdown(markdown: string) {
  const document = new MarkdownManager({
    extensions: profileBackgroundExtensions(),
  }).parse(markdown);
  // Markdown may promote a standalone image to an inline root token.
  document.content = document.content?.map((node) =>
    node.type === "text" || node.type === "hardBreak"
      ? { type: "paragraph", content: [node] }
      : node,
  );
  const cleanLinks = (node: import("@tiptap/core").JSONContent) => {
    node.marks = node.marks?.filter(
      (mark) =>
        mark.type !== "link" ||
        (typeof mark.attrs?.href === "string" &&
          /^https?:\/\//i.test(mark.attrs.href)),
    );
    node.content?.forEach(cleanLinks);
  };
  cleanLinks(document);
  return document;
}
