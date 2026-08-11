"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, FileCode2 } from "lucide-react";

interface CodeBlockProps {
  children: ReactNode;
  language?: string;
  className?: string;
}

function extractText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in node) {
    const el = node as { props: { children?: ReactNode } };
    return extractText(el.props.children);
  }
  return "";
}

export function CodeBlock({ children, language, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  // Load the highlight.js theme CSS only when a code block actually renders.
  // Next.js emits the CSS import as a lazy chunk, so pages that never render
  // a chat code block never download it.
  useEffect(() => {
    import("highlight.js/styles/github-dark-dimmed.min.css").catch(() => {
      // Theme CSS is optional — code stays readable without it.
    });
  }, []);

  const lang = language || className?.replace("language-", "") || "";
  const textContent = extractText(children);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group/code relative my-3 overflow-hidden rounded-xl border border-white/6 bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/6 bg-white/2 px-4 py-2">
        <div className="flex items-center gap-2 text-[11px] text-white/40">
          <FileCode2 className="h-3.5 w-3.5" />
          <span className="font-mono tracking-wider uppercase">
            {lang || "code"}
          </span>
        </div>
        <button
          onClick={handleCopy}
          aria-label={copied ? "Code copied to clipboard" : "Copy code block"}
          className="flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] text-white/30 transition-all hover:bg-white/6 hover:text-white/60"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <div className="overflow-x-auto p-4 text-sm leading-[1.7]">
        <pre className="font-mono">
          <code className={`text-[#e6edf3] ${className || ""}`}>
            {children}
          </code>
        </pre>
      </div>
    </div>
  );
}
