'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useState, type ComponentProps } from 'react';
import { Check, Copy } from 'lucide-react';

import 'katex/dist/katex.min.css';

function CodeBlock({ children, className, ...rest }: ComponentProps<'code'>) {
  const [copied, setCopied] = useState(false);

  // Detect language from class like "language-python"
  const langMatch = /language-(\w+)/.exec(className ?? '');
  const lang = langMatch?.[1] ?? '';

  // Inline code (no language) — render simply
  if (!lang) {
    return (
      <code className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[0.9em]" {...rest}>
        {children}
      </code>
    );
  }

  const code = String(children).replace(/\n$/, '');

  const onCopy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* noop */ }
  };

  return (
    <div className="my-2 rounded-lg overflow-hidden border border-white/10 dark:border-white/10 bg-[#1a1a1f]">
      <div className="flex items-center justify-between px-3 py-1 bg-[#0f0f12] text-[11px] font-mono">
        <span className="text-[#7f7f7f]">{lang}</span>
        <button
          onClick={onCopy}
          className="flex items-center gap-1 text-[#acacac] hover:text-[#dadada] transition-colors"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        language={lang}
        style={oneDark as Record<string, React.CSSProperties>}
        customStyle={{ margin: 0, padding: '12px 14px', fontSize: 13, background: 'transparent' }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export function MarkdownBody({ children }: { children: string }) {
  return (
    <div className="prose-nexus text-sm leading-relaxed [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_a]:text-sky-500 [&_a:hover]:underline [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:my-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:my-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:my-1.5 [&_table]:border-collapse [&_table]:my-2 [&_th]:border [&_th]:border-white/10 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-white/10 [&_td]:px-2 [&_td]:py-1 [&_blockquote]:border-l-2 [&_blockquote]:border-white/20 [&_blockquote]:pl-3 [&_blockquote]:opacity-70 [&_hr]:my-3 [&_hr]:border-white/10">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{ code: CodeBlock }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
