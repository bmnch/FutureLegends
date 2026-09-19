/**
 * Small, dependency-free markdown helpers shared by the generation pipeline
 * (server) and the course player (client).
 */

function normalizeHeadingText(s: string): string {
  return s
    .toLowerCase()
    .replace(/^\s*(?:\d+[.)]|[a-z][.)]|part\s+\d+[:.]?)\s*/i, "") // "1." / "a)" / "Part 2:"
    .replace(/[*_`~]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * The Content Agent is asked to use `##` headings inside sections, and it often
 * opens the section with a heading that repeats the section title. The player
 * already renders the section title as a heading, so drop a leading heading
 * that duplicates it (ignoring numbering, emphasis and punctuation).
 */
export function stripLeadingTitleHeading(markdown: string, title: string): string {
  const trimmed = markdown.trimStart();
  const match = /^(#{1,6})\s+(.+?)\s*#*\s*(?:\r?\n|$)/.exec(trimmed);
  if (!match) return markdown;
  const heading = normalizeHeadingText(match[2]);
  const wanted = normalizeHeadingText(title);
  if (!heading || !wanted) return markdown;
  const duplicate =
    heading === wanted ||
    (heading.length > 12 && (heading.startsWith(wanted) || wanted.startsWith(heading)));
  return duplicate ? trimmed.slice(match[0].length).trimStart() : markdown;
}

/** Render `**bold**`, `*italic*` and `` `code` `` inline without a full markdown parser. */
export function splitInlineMarkdown(
  text: string,
): Array<{ kind: "text" | "strong" | "em" | "code"; value: string }> {
  const out: Array<{ kind: "text" | "strong" | "em" | "code"; value: string }> = [];
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_)/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ kind: "text", value: text.slice(last, m.index) });
    if (m[2] ?? m[3]) out.push({ kind: "strong", value: m[2] ?? m[3] });
    else if (m[4]) out.push({ kind: "code", value: m[4] });
    else out.push({ kind: "em", value: m[5] ?? m[6] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}
