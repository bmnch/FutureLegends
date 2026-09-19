/**
 * Split a section of generated markdown into bite-sized chunks so the player
 * can show one idea at a time with a checkpoint between them.
 *
 * Rules:
 *  - Every `##` / `###` heading starts a new chunk (heading becomes the title).
 *  - Chunks longer than `maxChars` are split on blank lines, never inside a
 *    fenced code block, table or list.
 */

export type MarkdownChunk = {
  id: string;
  title: string | null;
  markdown: string;
};

const HEADING = /^(#{2,3})\s+(.+?)\s*#*\s*$/;

function splitParagraphs(markdown: string): string[] {
  const lines = markdown.split("\n");
  const paragraphs: string[] = [];
  let current: string[] = [];
  let inFence = false;

  const flush = () => {
    const text = current.join("\n").trim();
    if (text) paragraphs.push(text);
    current = [];
  };

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      current.push(line);
      continue;
    }
    if (inFence) {
      current.push(line);
      continue;
    }
    if (line.trim() === "") {
      flush();
      continue;
    }
    current.push(line);
  }
  flush();
  return paragraphs;
}

function isBlockContinuation(prev: string, next: string): boolean {
  // Keep lists and tables together even when separated by a blank line.
  const listLike = /^\s*([-*+]|\d+[.)])\s/;
  const tableLike = /^\s*\|/;
  return (listLike.test(prev) && listLike.test(next)) || (tableLike.test(prev) && tableLike.test(next));
}

function splitLong(markdown: string, maxChars: number): string[] {
  if (markdown.length <= maxChars) return [markdown];
  const paragraphs = splitParagraphs(markdown);
  const out: string[] = [];
  let buffer = "";
  for (const p of paragraphs) {
    const wouldOverflow = buffer.length > 0 && buffer.length + p.length + 2 > maxChars;
    const lastPara = buffer.split("\n\n").pop() ?? "";
    if (wouldOverflow && !isBlockContinuation(lastPara, p)) {
      out.push(buffer);
      buffer = p;
    } else {
      buffer = buffer ? `${buffer}\n\n${p}` : p;
    }
  }
  if (buffer) out.push(buffer);
  return out;
}

export function chunkMarkdown(
  markdown: string,
  idPrefix: string,
  options: { maxChars?: number } = {},
): MarkdownChunk[] {
  const maxChars = options.maxChars ?? 900;
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  const sections: Array<{ title: string | null; lines: string[] }> = [{ title: null, lines: [] }];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const heading = !inFence ? HEADING.exec(line) : null;
    if (heading) {
      sections.push({ title: heading[2]!.replace(/[*_`]/g, "").trim(), lines: [] });
      continue;
    }
    sections[sections.length - 1]!.lines.push(line);
  }

  const chunks: MarkdownChunk[] = [];
  for (const section of sections) {
    const body = section.lines.join("\n").trim();
    if (!body && !section.title) continue;
    const parts = body ? splitLong(body, maxChars) : [""];
    parts.forEach((part, i) => {
      chunks.push({
        id: `${idPrefix}:${chunks.length}`,
        title: i === 0 ? section.title : null,
        markdown: part,
      });
    });
  }

  // Merge a heading-only chunk into the one that follows it.
  const merged: MarkdownChunk[] = [];
  for (const chunk of chunks) {
    const prev = merged[merged.length - 1];
    if (prev && prev.markdown.trim() === "" && prev.title && !chunk.title) {
      merged[merged.length - 1] = { ...chunk, id: prev.id, title: prev.title };
    } else {
      merged.push(chunk);
    }
  }
  return merged.filter((c) => c.markdown.trim() !== "" || c.title);
}

/** Rough reading time in seconds at ~200 words per minute. */
export function readingSeconds(markdown: string): number {
  const words = markdown.split(/\s+/).filter(Boolean).length;
  return Math.max(10, Math.round((words / 200) * 60));
}
