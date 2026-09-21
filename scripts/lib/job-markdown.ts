/**
 * Shared Markdown sanitizing for job descriptions.
 *
 * Every ATS mangles emphasis differently: some emit `**Job: **`, some emit
 * empty `****` pairs, and some wrap headings in bold. These rules are applied
 * both when syncing a board and when normalizing existing profiles, so the two
 * paths can never drift.
 */

const namedEntities: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
  middot: "·",
  trade: "™",
  reg: "®",
  copy: "©",
};

const malformedStrongEmphasis = /(\*\*|__)(?=\S)((?:(?!\1)[^\n])*?\S)[ \t]+\1/g;

/** Returns strong-emphasis runs that CommonMark will render as literal text. */
export function malformedStrongEmphasisRuns(markdown: string) {
  return [...markdown.matchAll(malformedStrongEmphasis)].map((match) =>
    match[0].replace(/\s+/g, " "),
  );
}

export function decodeEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&([a-z]+);/gi, (match, name: string) => {
      const resolved = namedEntities[name.toLowerCase()];
      return resolved ?? match;
    });
}

export function sanitizeJobMarkdown(markdown: string) {
  return (
    decodeEntities(markdown)
      .replace(/[\u200b\ufeff]/g, "")
      // A stray tag the HTML pass missed (e.g. `</aside>`).
      .replace(/<[^>]+>/g, "")
      // `## **The role:**` -> `## The role`
      .replace(
        /^##\s+\*\*([^*\n]+?)\s*\*\*:?/gm,
        (_, heading: string) => `## ${heading.replace(/:$/, "").trim()}`,
      )
      // `**Job: **` -> `**Job:**` (the bug that leaks literal asterisks).
      .replace(/\*\*([^*\n]+?):[ \t]+\*\*/g, "**$1:**")
      .replace(/\*\*([^*\n]+?):\*\*(?=[^\s])/g, "**$1:** ")
      // Repair word spacing accidentally lost by an earlier broad emphasis pass.
      // A lowercase word immediately followed by a capitalized bold term is prose,
      // not an intentional intraword emphasis boundary.
      .replace(/([\p{Ll}\p{N}])\*\*(?=[\p{Lu}\d])/gu, "$1 **")
      // CommonMark cannot close a strong run after whitespace:
      // `**Innovate with courage. **Lead` -> `**Innovate with courage.** Lead`.
      .replace(
        malformedStrongEmphasis,
        (
          match,
          delimiter: string,
          text: string,
          offset: number,
          source: string,
        ) => {
          const nextCharacter = source[offset + match.length];
          const needsSpace =
            nextCharacter !== undefined &&
            !/[\s.,;:!?)}\]]/.test(nextCharacter);
          return `${delimiter}${text}${delimiter}${needsSpace ? " " : ""}`;
        },
      )
      // Empty emphasis runs: `** **`, `****`.
      .replace(/\*\*[ \t]*\*\*/g, "")
      // A short bold-only line is a heading, unless it reads as a label.
      .replace(
        /^[ \t]*\*\*([^*\n]{2,60}?)\*\*[ \t]*$/gm,
        (whole, text: string) =>
          /[.:;,]$/.test(text.trim())
            ? `**${text.trim()}**`
            : `## ${text.trim()}`,
      )
      // Pay-transparency legalese; the range lives in `compensation.salary`.
      .replace(
        /##\s*Compensation\s*\n+(?=We offer competitive compensation packages\.)[\s\S]*?consistent with applicable law\.?/gi,
        "",
      )
      .replace(
        /We offer competitive compensation and benefits packages\.[\s\S]*?consistent with applicable law\.?/gi,
        "",
      )
      .replace(/\n##\s*Compensation\s*$/gim, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
