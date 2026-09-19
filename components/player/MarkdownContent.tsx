"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { stripEmDashes } from "@/lib/markdown-utils";

type Props = {
  markdown: string;
  className?: string;
};

/**
 * Renders generated Markdown with the `.course-prose` scale (see globals.css).
 * GFM enables tables, task lists and strikethrough. Em dashes are removed at
 * render time so older stored content follows the house style too.
 */
export function MarkdownContent({ markdown, className = "" }: Props) {
  return (
    <div className={`course-prose ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          // Stray H1s in generated markdown should not fight the page title.
          h1: ({ children }) => <h2>{children}</h2>,
        }}
      >
        {stripEmDashes(markdown)}
      </ReactMarkdown>
    </div>
  );
}
