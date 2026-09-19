"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  markdown: string;
  className?: string;
};

/**
 * Renders agent-generated Markdown with the `.course-prose` typographic scale
 * (see globals.css). GFM enables tables, task lists and strikethrough, which
 * the Content Agent is prompted to use for option comparisons.
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
          // Prevent stray H1s in generated markdown from fighting the page title.
          h1: ({ children }) => <h2>{children}</h2>,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
