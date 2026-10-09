/**
 * Code Viewer — insights derived from the file index.
 *
 * The viewer already has the data a repository overview would need; it just
 * never computed anything with it. These functions are the whole insight
 * surface, and they are pure and string-free of I/O on purpose: they read the
 * `files` array the viewer already fetched, so adding an insight costs no new
 * tRPC procedure, no SQL, and no migration. That constraint is what keeps this
 * a reader with a draw instead of a dashboard wearing a code view.
 *
 * Two honesty rules are structural here, not stylistic:
 *
 *   1. Every figure is a share of **stored** files. Ingestion drops files
 *      before insert, so "stored" is a strict subset of the repository. No
 *      function here knows the repository size, so none of them can phrase a
 *      result as repo coverage even by accident.
 *   2. Zero-token and unknown-status inputs degrade to shares of zero rather
 *      than throwing or returning NaN. The index is allowed to be incomplete;
 *      the arithmetic is not allowed to be.
 */

import type { FileEntry } from "./utils";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LanguageIndexRow {
  language: string;
  /** Display name for the row; falls back to the raw language key. */
  label: string;
  fileCount: number;
  lines: number;
  bytes: number;
  tokens: number;
  /** How many of `fileCount` have at least one indexed chunk. */
  searchableCount: number;
}

export interface TokenConcentrationRow {
  path: string;
  tokens: number;
  /** 0–1 share of the token total across all rows in the same result. */
  share: number;
}

export interface EntryPointCandidate {
  path: string;
  /** Why this file is offered — a reader deserves to know the rule. */
  reason: string;
  score: number;
}

// ─── Language labels ─────────────────────────────────────────────────────────

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  tsx: "TypeScript React",
  jsx: "JavaScript React",
  python: "Python",
  rust: "Rust",
  go: "Go",
  java: "Java",
  ruby: "Ruby",
  php: "PHP",
  c: "C",
  cpp: "C++",
  "c++": "C++",
  csharp: "C#",
  "c#": "C#",
  swift: "Swift",
  kotlin: "Kotlin",
  scala: "Scala",
  shell: "Shell",
  bash: "Shell",
  sql: "SQL",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  json: "JSON",
  yaml: "YAML",
  yml: "YAML",
  markdown: "Markdown",
  md: "Markdown",
  dockerfile: "Dockerfile",
  makefile: "Makefile",
  toml: "TOML",
  xml: "XML",
  vue: "Vue",
  svelte: "Svelte",
  dart: "Dart",
  elixir: "Elixir",
  erlang: "Erlang",
  haskell: "Haskell",
  lua: "Lua",
  perl: "Perl",
  r: "R",
  text: "Plain text",
};

const FALLBACK_LANGUAGE = "text";

export function languageLabel(language: string): string {
  const key = language.trim().toLowerCase();
  if (!key) return LANGUAGE_LABELS[FALLBACK_LANGUAGE];
  return LANGUAGE_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/** Normalizes a possibly-absent language to a stable bucket. */
export function bucketLanguage(language: string | undefined | null): string {
  const key = language?.trim().toLowerCase();
  return key && key.length > 0 ? key : FALLBACK_LANGUAGE;
}

// ─── Share math ─────────────────────────────────────────────────────────────

/**
 * Share as a 0–1 fraction. Total of 0 yields 0 rather than Infinity/NaN,
 * because an empty index is a normal state mid-ingestion.
 */
export function shareOf(value: number, total: number): number {
  if (value <= 0 || total <= 0) return 0;
  const share = value / total;
  return share > 1 ? 1 : share;
}

export function formatShare(share: number): string {
  if (share <= 0) return "0%";
  if (share < 0.001) return "<0.1%";
  return `${Math.round(share * 1000) / 10}%`;
}

// ─── Language index breakdown ────────────────────────────────────────────────

/**
 * Groups the stored files by language and reports, per language, how much of
 * the stored set is searchable. This is the one chart the viewer earns: a
 * reader who asks "why can't I query my Python?" immediately sees their
 * Python rows were never embedded while their TypeScript rows were.
 */
export function summarizeLanguageIndex(
  files: readonly FileEntry[],
): LanguageIndexRow[] {
  const byLanguage = new Map<string, LanguageIndexRow>();

  for (const file of files) {
    const language = bucketLanguage(file.language);
    let row = byLanguage.get(language);
    if (!row) {
      row = {
        language,
        label: languageLabel(language),
        fileCount: 0,
        lines: 0,
        bytes: 0,
        tokens: 0,
        searchableCount: 0,
      };
      byLanguage.set(language, row);
    }
    row.fileCount += 1;
    row.lines += file.lines ?? 0;
    row.bytes += file.bytes ?? 0;
    row.tokens += file.tokenCount ?? 0;
    if ((file.chunkCount ?? 0) > 0) row.searchableCount += 1;
  }

  // Token weight first: it is what retrieval actually looks at. Ties broken by
  // file count then name so the order is stable across renders.
  return [...byLanguage.values()].sort(
    (a, b) =>
      b.tokens - a.tokens ||
      b.fileCount - a.fileCount ||
      a.label.localeCompare(b.label),
  );
}

/** Searchable share of one language row, 0–1. */
export function languageSearchableShare(row: LanguageIndexRow): number {
  return shareOf(row.searchableCount, row.fileCount);
}

// ─── Token concentration ─────────────────────────────────────────────────────

/**
 * The files that dominate the index. A reader who knows that five files are a
 * third of the token budget knows where a question will actually be answered
 * from — which is the honest version of "where should I look".
 */
export function tokenConcentration(
  files: readonly FileEntry[],
  limit = 5,
): TokenConcentrationRow[] {
  const ranked = files
    .map((file) => ({ path: file.path, tokens: file.tokenCount ?? 0 }))
    .filter((entry) => entry.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens || a.path.localeCompare(b.path))
    .slice(0, Math.max(0, limit));

  const topTotal = ranked.reduce((sum, entry) => sum + entry.tokens, 0);
  const grandTotal = files.reduce(
    (sum, file) => sum + (file.tokenCount ?? 0),
    0,
  );

  return ranked.map((entry) => ({
    path: entry.path,
    tokens: entry.tokens,
    // Share of the *whole index*, not of the slice: the point is how much of
    // retrieval lives here, and a self-referential share would always be 100%.
    share: shareOf(entry.tokens, grandTotal),
  }));
}

/** Combined share held by the returned concentration rows, 0–1. */
export function concentrationTotal(
  rows: readonly TokenConcentrationRow[],
): number {
  return rows.reduce((sum, row) => sum + row.share, 0);
}

// ─── Entry-point candidates ──────────────────────────────────────────────────

/** Conventional names, shallowest first, in the order a human would check. */
const ENTRY_POINT_NAMES = [
  "readme",
  "index",
  "main",
  "app",
  "mod",
  "lib",
  "server",
  "cli",
  "package",
  "pyproject",
  "cargo",
  "go",
  "makefile",
  "dockerfile",
];

function baseName(path: string): string {
  const segments = path.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? path;
  const dot = last.lastIndexOf(".");
  return dot > 0 ? last.slice(0, dot) : last;
}

function depthOf(path: string): number {
  return path.split("/").filter(Boolean).length - 1;
}

/**
 * A named heuristic, not a ranking. It exists so the "nothing selected" state
 * can offer something better than "pick a file", and it says so in the UI.
 *
 * Preference order: README first (it is documentation, not source, and a
 * reader landing cold wants it), then shallow conventional names, then shallow
 * paths generally. Ties break on path so the list is deterministic.
 */
export function entryPointCandidates(
  files: readonly FileEntry[],
  limit = 3,
): EntryPointCandidate[] {
  const scored = files.map((file) => {
    const name = baseName(file.path);
    const lower = name.toLowerCase();
    const depth = depthOf(file.path);
    const nameRank = ENTRY_POINT_NAMES.indexOf(lower);
    const isReadme = lower === "readme";

    let score = 0;
    let reason = "";

    if (isReadme) {
      score = 100;
      reason = "Project documentation";
    } else if (nameRank >= 0) {
      score = 80 - nameRank;
      reason = "Conventional entry name";
    }

    // Shallower is better, but never enough to out-rank a conventional name.
    if (score > 0) score += Math.max(0, 10 - depth * 2);
    if (score === 0 && depth <= 1) {
      score = 20 - depth;
      reason = "Top-level file";
    }

    return { path: file.path, reason, score };
  });

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, Math.max(0, limit));
}

// ─── Compact formatters for figure columns ──────────────────────────────────

/** 1.2K / 45.6K / 1.1M — compact but never rounding to a bare 0. */
export function compactCount(value: number): string {
  if (value <= 0) return "0";
  if (value < 1000) return String(value);
  if (value < 1_000_000) {
    const k = Math.round((value / 1000) * 10) / 10;
    return `${k}K`;
  }
  const m = Math.round((value / 1_000_000) * 100) / 100;
  return `${m}M`;
}
