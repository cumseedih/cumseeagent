"use client";

import React from "react";

/**
 * Tiny dependency-free markdown renderer for agent output.
 * Returns React nodes (never raw HTML), so agent text cannot inject markup.
 * Supports: fenced code, headings, lists, blockquotes, hr, inline code,
 * bold/italic, links, and autolinked URLs.
 */

export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="my-3 overflow-hidden rounded-md border border-border-faint bg-surface-floating">
      <div className="flex h-8 items-center justify-between border-b border-border-faint px-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">{lang || "text"}</span>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="text-[11px] text-text-muted transition-colors hover:text-text-tertiary"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-[420px] overflow-auto p-3 font-mono text-[12.5px] leading-[1.6] text-text-secondary">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // code | bold | italic | link | url
  const pattern =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)\s]+\))|(https?:\/\/[^\s)]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = pattern.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-i${i++}`;
    if (tok.startsWith("`")) {
      nodes.push(<code key={key}>{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("**")) {
      nodes.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("*")) {
      nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    } else if (tok.startsWith("[")) {
      const mm = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(tok);
      if (mm) {
        nodes.push(
          <a key={key} href={mm[2]} target="_blank" rel="noopener noreferrer">
            {mm[1]}
          </a>
        );
      }
    } else {
      nodes.push(
        <a key={key} href={tok} target="_blank" rel="noopener noreferrer">
          {tok}
        </a>
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ text }: { text: string }) {
  const lines = (text || "").replace(/\r\n/g, "\n").split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code
    const fence = /^\s*```(\w+)?\s*$/.exec(line);
    if (fence) {
      const lang = fence[1];
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++; // closing fence
      out.push(<CodeBlock key={`c${k++}`} code={buf.join("\n")} lang={lang} />);
      continue;
    }

    // Headings
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const content = inline(h[2], `h${k}`);
      out.push(
        level === 1 ? (
          <h1 key={`h${k++}`}>{content}</h1>
        ) : level === 2 ? (
          <h2 key={`h${k++}`}>{content}</h2>
        ) : (
          <h3 key={`h${k++}`}>{content}</h3>
        )
      );
      i++;
      continue;
    }

    // Lists
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ""));
        i++;
      }
      const list = items.map((it, idx) => <li key={idx}>{inline(it, `l${k}-${idx}`)}</li>);
      out.push(ordered ? <ol key={`l${k++}`}>{list}</ol> : <ul key={`l${k++}`}>{list}</ul>);
      continue;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ""));
      out.push(<blockquote key={`q${k++}`}>{inline(buf.join(" "), `q${k}`)}</blockquote>);
      continue;
    }

    // Horizontal rule
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      out.push(<hr key={`r${k++}`} className="my-4 border-border-faint" />);
      i++;
      continue;
    }

    // Blank line
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    // Paragraph (merge soft-wrapped lines)
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^\s*```/.test(lines[i]) &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i])
    ) {
      buf.push(lines[i++]);
    }
    out.push(<p key={`p${k++}`}>{inline(buf.join("\n"), `p${k}`)}</p>);
  }

  return <div className="agent-md text-sm text-text-secondary">{out}</div>;
}
