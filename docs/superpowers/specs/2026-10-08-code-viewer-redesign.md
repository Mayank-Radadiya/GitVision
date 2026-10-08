# Code Viewer Redesign — an index-aware reading surface

Date: 2026-10-08
Status: approved, ready for planning
Scope: the shared `CodeViewer` component, both of its mount sites, the `/code-viewer` picker grid, and one new server procedure.

---

## 1. Problem Statement

The Code Viewer answers the question "show me this file." It cannot answer the question that
actually matters on this product: **"what can I ask about?"**

A user opens `/code-viewer/<id>`, scrolls a file tree, opens a file, and reads it. Nothing on the
screen tells them whether the AI they are paying credits to query has ever seen the file in front of
them. They discover the answer only after spending a credit on a chat that returns "I couldn't find
anything about that." That is the product's core loop failing at its one moment of greatest
ambiguity, and the surface that could have prevented it is the surface that knows nothing.

Three concrete defects, all reproducible:

1. **The viewer's data layer cannot express index state at all.** `project.getFiles` selects
   `{id, fileName}` and nothing else (`projectService.ts:549`). The join to `code_embeddings` —
   the only table that knows what was actually embedded — is never made. The per-file chunk count
   and token count that would answer "is this worth asking about, and how much does it cost to
   answer" do not exist in the client.
2. **The layout contradicts the product.** A fixed `80vh` box (`code-viewer/index.tsx`) holding a
   sidebar with a single text input and a code panel. When mounted as the workspace's `files` tab
   (`project-page.tsx:252`), that 80vh box is nested inside an already-tall tab panel, so the page
   scrolls to reveal a viewer that is itself a scrolling box — two scrollbars, one of them
   redundant. The standalone route additionally reimplements a project header that
   `project-header.tsx` already owns inside the workspace.
3. **The states are unfinished.** The error state is a bare red-bordered `AlertTriangle` with no
   retry. The search input filters by `String.includes`, so `uspr` does not find `user-profile.ts`.
   The loading shimmer calls `Math.random()`, which makes it non-deterministic under test and
   visibly jitters on every re-render. `escapeHtml` is duplicated between `code-panel.tsx` and
   `utils.ts`.

The opportunity is larger than the fix. The overview tab already answers "is my index healthy" at
the project level via `describeIndexHealth`. The viewer can answer **the same question per file**,
which is strictly more useful: it is the project-level answer localized to the thing the user is
currently looking at.

### Non-goals

- **Per-line or per-chunk highlighting.** `chunkIndex` is a chunk ordinal, not a line number, and
  nothing in the schema maps chunks onto line ranges. Deriving "the AI can see line 412" would be
  fabrication. Rejected at the design stage.
- **An "index this file" action.** It would require a new mutation, a new Inngest step, a credit
  spend with a latched refund path, and live-updating coverage that races the 500-file cap
  bookkeeping. The viewer will *explain* why a file is not searchable and stop there.
- **A ⌘K command palette.** `cmdk` is installed but unused here. Fuzzy search plus three filter
  chips cover the same ground with less surface.
- **A per-file `index_state` column.** The existing status vocabulary is sufficient to derive the
  three states truthfully (see §3). Adding a column would create a fourth writer of indexing
  vocabulary and require edits to both ingest paths plus a backfill.

---

## 2. Design Direction

**The viewer is a reading surface that happens to be index-aware, not a dashboard that happens to
show code.**

The distinction has concrete consequences. A dashboard puts metrics above the content and makes the
content a tab beneath them. A reading surface puts the content first and attaches the metrics to the
thing they describe. So:

- The **per-file** facts — lines, bytes, chunks, tokens, index state — live in a facts row welded to
  the file being read, not in a project-level table somewhere above it.
- The **project-level** instrument strip exists, but it is four figures in a 44px band, and its
  counts are computed from the same per-file rows as the dots. Strip and dots cannot disagree
  because they are the same numbers.
- The rail's job is orientation ("where am I, what else is here"), so it gets search, index-state
  filtering, and one dot per row. Nothing else.

Every figure answers a question a reader actually has. `chunks: 47 / tokens: 6,102` on a file tells
you the chunker packed it densely enough to retrieve well. `lines: 412 / bytes: 18.3 kB` tells you
how big it is. An amber dot tells you the AI never read it. A `Star: 2.4k` figure would tell you
nothing you can act on inside this surface, and it does not appear here.

### One deliberate departure from the overview

`overview/index-health.tsx:200-202` derives coverage from **pipeline counters** —
`embedded = indexedFileCount`, `skipped = totalFileCount - embedded`,
`unconsidered = totalFiles - totalFileCount`. Those are values the pipeline *reported* about its own
work.

The viewer derives from `code_embeddings` — **what is actually in the table**. When a project is
capped at 500 files, `indexedFileCount` is 500, but the number of rows carrying chunks is also 500;
when a resync deletes embeddings for a file without updating the counter, the counter is stale and
the table is not.

**The viewer is the more authoritative surface for per-file facts, so it reads the table.** The
overview keeps its counter-derived framing because that is what its own copy already promises. The
two are not reconciled, because reconciling them would mean the overview changing its story in the
same commit. The viewer's copy says "searchable" and never "coverage", which sidesteps the
collision entirely. If the counts ever disagree on a real project, that divergence is a bug report,
not a design flaw — and it is now *visible* rather than buried.

---

## 3. Data Layer

### 3.1 The query

One procedure, one round trip. The instrument strip, the coverage meter, the filter chips, and the
per-file dots all read this single payload.

```sql
SELECT
  f.id,
  f."fileName",
  f.language,
  length(f.code) - length(replace(f.code, E'\n', '')) + 1  AS line_count,
  octet_length(f.code)                                     AS byte_count,
  COALESCE(e.chunk_count, 0)                               AS chunk_count,
  COALESCE(e.token_count, 0)                               AS token_count
FROM project_files f
LEFT JOIN (
  SELECT "fileId",
         count(*)::int              AS chunk_count,
         COALESCE(sum("tokenCount"), 0)::int AS token_count
  FROM code_embeddings
  WHERE "projectId" = $1
  GROUP BY "fileId"
) e ON e."fileId" = f.id
WHERE f."projectId" = $1
```

Three decisions in that SQL that are load-bearing:

**The embeddings subquery is filtered by `projectId`, not left unfiltered.** `code_embeddings` has
a `(project_id, file_id)` index but the `fileId` join alone would still be a per-row lookup across
the whole table for every file in the project. Pre-aggregating once and hash-joining is the
difference between one index scan and N of them.

**The line formula is `length - length(replace) + 1`, not `array_length(string_to_array(...))`.**
Both count lines, but they disagree on newline-terminated files: `"a\nb\n".split("\n").length` is 3
in JavaScript, and `string_to_array` would return 2. The panel renders `content.split("\n")`, so the
figure has to count what is rendered or the line number in the gutter will disagree with the count
in the facts row. The formula above matches the renderer exactly, including for the empty string
(0 − 0 + 1 = 1, and `"".split("\n").length` is 1).

**`octet_length`, not `length`.** `length` counts characters, so a file with emoji or non-Latin
CJK would report a size in characters next to a "kB" label. `octet_length` is bytes, which is what
`formatBytes` formats.

`project.getFiles` is **not** modified. It has one caller and the picker does not need these fields;
two procedures with two purposes is cheaper than one procedure every caller pays for.

### 3.2 The index-state contract

```ts
// src/lib/file-index-state.ts
export type FileIndexState = "indexed" | "skipped" | "not-indexed";

fileIndexState(chunkCount, status):
  chunkCount > 0                          -> "indexed"
  chunkCount === 0 && status === "completed" -> "skipped"
  chunkCount === 0 && status !== "completed" -> "not-indexed"
```

**Why the status changes the label.** `src/lib/inngest/functions.ts:191` puts
`.limit(MAX_EMBEDDING_FILES)` in the **SELECT**, not in a post-filter. Under `partial`, the
over-cap files were never handed to the chunker. Calling them "skipped" would assert the pipeline
examined them and declined, which is false — it never looked. Only under `completed` is "the run
considered this file and produced nothing" a provable statement, which is exactly what
`src/lib/indexing-status.ts:29` promises that status means.

The module is pure, has no database or Inngest imports, and is browser-importable — the same
contract `indexing-status.ts` sets. It sits beside that module and imports it, rather than
re-declaring the `"completed"` literal.

### 3.3 Why not a stored column

A `project_files.index_state` column would be exact in all cases. It is rejected because:

- `project_files` is written by `github/services/files.ts` (tarball insert) and `resync.ts`
  (incremental upsert). Adding a third writer of indexing state means the vocabulary now lives in
  `indexing-status.ts`, `embedding-progress.ts`, a DB CHECK, and a column comment — which is the
  exact duplication `indexing-status.ts` was written to end.
- Backfill is lossy by necessity: existing rows can be classified `indexed` or `unknown`, never
  `skipped`, because nothing recorded why.
- The honest version of the column needs the *chunker's* skip reason plumbed through the embed step,
  which is a change to `inngest/functions.ts` well beyond a viewer redesign.

### 3.4 Payload

```ts
interface IndexedProjectFiles {
  project: {
    status: IndexingStatus;
    /** Files GitHub reported at import. May exceed `storedFiles` — see below. */
    repoFileCount: number | null;
    estimatedTokens: number | null;
  };
  files: Array<{
    id: string;
    path: string;          // "/"-prefixed, matching the existing convention
    language: string | null;
    lines: number;
    bytes: number;
    chunkCount: number;
    tokenCount: number;
    indexState: FileIndexState;
  }>;
}
```

`assertProjectOwnership` runs first and throws `NOT_FOUND`, never `FORBIDDEN` — existence of another
tenant's project must not be observable.

### 3.5 The honesty constraint on copy

`isIgnoredPath` (`github/utils.ts:120`) and `GITHUB_CONFIG.MAX_FILE_BYTES` (`files.ts:234`) drop
files **before insert**. Those files are not in `project_files`, so they cannot appear in the tree
at all.

Therefore the strip measures **searchable out of stored files**, never coverage of the repository.
`projects.totalFiles` (GitHub's count at import) is carried in the payload for exactly one honest
use: a secondary "N of M stored" figure, which is a true statement about what ingestion kept.
Coverage vocabulary — "X% of your repo is indexed" — is banned from this surface. The store's
`estimatedTokens` is `null` when unknown, and `null` renders as "—" with a tooltip, never as `0`.

---

## 4. Architecture

### 4.1 Layout at `lg` and above

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ▏Code Viewer                                        synced 3d ago          │  ← page head
├──────────────────────────────────────────────────────────────────────────────┤
│ ╭────────────────────────────────────────────────────────────────────────╮ │
│ │ 1201 files  ·  1,043 searchable   184 skipped   0 not indexed            │ │  ← instrument strip
│ │ ████████████████████░░░░░░░░                                       │ │
│ │ 412,908 lines   ·   18.4 MB   ·   38.1M tokens                      │ │
│ ╰────────────────────────────────────────────────────────────────────────╯ │
├────────────────────────────────┬─────────────────────────────────────────────┤
│ ╭─ EXPLORER ─────────── 1,201 ▾╮│ ┌ src/features/projects/components/… ─ ─ ─ ┐│
│ │ [⌕ fuzzy path…          ]   ││ │ src › features › projects › components       ││ ← breadcrumb
│ │ (All 1,201)(Searchable 1,043)││ │ ─────────────────────────────────────────── ││ ← facts row
│ │ (Not indexed 158)            ││ │ 412 lines · 18.3 kB · 47 chunks · 6.1k tok  ││
│ ├──────────────────────────────┤│ │ ● indexed            [Ask] [Copy] […]      ││
│ │ ▾ 📁 src                     ││ ├────────────────────────────────────────────┤│
│ │   ▾ 📁 features              ││ │ ▓ src/app/globals.css                    ││
│ │     ● 📄 layout.tsx    128 L ││ │ ▓  1  @import "tailwindcss";              ││
│ │     ● 📄 root.tsx      41 L  ││ │ ▓  2                                    ││
│ │     ○ 📄 legacy.ts     88 L  ││ │ ▓  3  :root {                             ││
│ │ ▸ 📁 docs                   ││ │ ▓  …                                      ││
│ └──────────────────────────────┘└─┴────────────────────────────────────────────┘│
└────────────────────────────────┴─────────────────────────────────────────────┘
```

### 4.2 Layout below `lg`

The rail becomes a left sheet that slides over the code, dismissed by scrim click or Escape. The
instrument strip wraps to two rows. The tab strip scrolls horizontally. Code fills the viewport
height.

```
┌────────────────────────────┐
│ Code Viewer      [☰ Files] │
│ ██████████░░░░░░           │
│ 1,201 files · 18.4 MB      │
├────────────────────────────┤
│ src › features › …    [⋯]  │
│ 412 lines · 47 chunks      │
├────────────────────────────┤
│▓ src/app/globals.css     │
│▓ 1 @import "tailwindcss"; │
└────────────────────────────┘
        ░░ sheet slides in ░░
```

### 4.3 Component tree

```
code-viewer/
  index.tsx                  orchestrator; one useReducer, owns no layout
  reducer.ts                 NEW  viewer state machine (pure, unit-tested)
  highlight.ts               NEW  shiki singletons, theme cache, LRU — moved out of code-panel
  file-stats.ts              NEW  instrument strip + strip/row count derivation (pure)
  file-index-state.ts        NEW  per-file dot + reason copy (component wrapper, thin)
  tab-strip.tsx              NEW  recently-viewed files, sessionStorage-backed
  code-panel.tsx             layout + virtualizer + ask/copy; no shiki internals
  file-tree.tsx              unchanged ARIA contract, gains the dot
  index-dot.tsx              NEW  the dot, its tooltip, and the not-searchable reason
  utils.ts                   gains fuzzyMatch; keeps splitHighlightedLines + buildFileTree
```

`utils.ts` keeps `splitHighlightedLines`, `buildFileTree`, `CODE_THEMES`, `EXTENSION_MAP`, and
`escapeHtml`. `code-panel.tsx` stops exporting a second copy of `escapeHtml` — the duplicate goes.

### 4.4 Viewer state

`index.tsx` currently holds five independent `useState`s whose interactions are non-trivial: a
file path is both the selection and the deep-link target, filtering must not deselect a hidden
file, and the tab strip must dedupe against the current file. That is a state machine wearing a
`useState` costume.

```ts
type ViewerState = {
  query: string;
  filter: "all" | "searchable" | "not-indexed";
  selectedPath: string | null;
  recent: string[];           // most-recent-first, capped at 8
  railOpen: boolean;
};
```

Actions: `setQuery`, `setFilter`, `select`, `closeRail`, `toggleRail`.

Two rules the reducer enforces, both currently implicit and both worth a test:

1. **Filtering never changes the selection.** If the selected file stops matching the query, the
   panel keeps showing it. A user who types to explore does not expect the file under their cursor
   to be replaced by a different one.
2. **`select` prepends to `recent` and caps at 8.** Deep-linking to `?file=` from a chat citation
   must land in the strip, because arriving from a citation and continuing to read is the same act.

`recent` is mirrored to `sessionStorage` under `gitvision:viewer-recent:{projectId}` so the strip
survives navigation between the workspace tab and the standalone route. `sessionStorage`, not
`local`: a user returning next week should not inherit a stale workspace.

Because the stored paths can outlive a resync that renamed or deleted files, **every entry is
validated against the current file list on load and pruned if absent.** An unreadable or
non-array value is discarded rather than parsed defensively — a corrupt storage key must not be
able to break the viewer, and there is nothing worth recovering from it.

---

## 5. Components

### 5.1 Instrument strip

One bordered block with hairline dividers — the `bg-border grid gap-px` idiom from
`metric-strip.tsx:107`, not the component itself. `metric-strip.tsx` is hardcoded to commits /
contributors / open items / footprint and is not reusable here; what is borrowed is the *technique*
and its rationale, which is the right thing to take.

Top row: the raw `${storedCount} files` caption (§3.5 constraint below), then the three band counts
— `1,043 searchable · 184 skipped · 0 not indexed` — each in its band color. Second row: the
`CoverageMeter` bar. Third row: the summed figures, all `tabular-nums` and monospace — **lines**
· **bytes** (`formatBytes`) · **tokens** (`formatTokens`, "—" when `null`).

Where `repoFileCount` (GitHub's count at import) is available and exceeds the stored count, a muted
secondary caption reads `X of Y stored` — the one honest use of the repo-level number, and a
formatted `formatCount` string because no test matches it.

The coverage meter is `CoverageMeter` (`charts/coverage-meter.tsx`) with DB-derived bands:

```tsx
<CoverageMeter
  bands={{
    embedded: counts.indexed,     // rows with chunkCount > 0
    skipped: counts.skipped,      // 0 chunks under "completed"
    unconsidered: counts.notIndexed, // 0 chunks under any other status
  }}
  showLegend={false}              // the strip's own tiles are the legend
/>
```

`CoverageMeter` already treats `unconsidered` as the un-drawn track, which is precisely what
"stored but not searchable" should look like. Reusing it means the viewer and the overview cannot
disagree about how a 0.4% band is drawn — the reason `bandWidth` was factored out in the first place.

Figures, in order, all `tabular-nums` and monospace: **lines** (summed from rows) · **bytes**
(`formatBytes`) · **tokens** (`formatTokens`, "—" when `null`).

Two constraints on this strip that are easy to violate accidentally:

**The stored-file caption must stay unformatted.** `e2e/ingestion.spec.ts:176` matches
`/^\d+ files?$/` against a whole element's text. That element reads `` `${storedCount} files` `` with
the raw integer — no `formatCount`, no separator. It sits as the strip's leading caption. Every other
figure in the strip is formatted normally; this one is not, and the asymmetry is deliberate.

**`showLegend={false}` because the top row is the legend.** `CoverageMeter`'s own legend would
print the same three counts a second time.

### 5.2 Rail

**Fuzzy search.** `String.includes` becomes a subsequence match with three bonuses: consecutive
runs, matches at a path-segment boundary, and matches in the basename. `fuzzyMatch` is pure and
exported from `utils.ts` for unit tests. No dependency — a hand-rolled 30-line scorer that we own
beats an unmaintained 30 kB one we do not, and it is fully covered by tests.

**Filter chips.** Three toggles carrying counts: `All` / `Searchable` / `Not indexed`. Rendered as
a single-select segmented control, not three independent checkboxes, because they are mutually
exclusive by construction and three checkboxes would let a user select a contradictory pair.

**Index dot.** One dot per file row, right-aligned before the line count:
`bg-gv-moss` indexed · `bg-gv-amber` skipped · `bg-muted-foreground/30` not-indexed.

Directory rows aggregate: a dot appears on a directory only when **every** file beneath it shares
that state, and it is rendered at reduced opacity. A dot on a mixed directory would assert
something untrue about a group of files.

`file-tree.tsx`'s roving tabindex, `role="tree"` structure, and `data-path` attributes are
**untouched**. `file-tree-aria.test.tsx` must pass without modification — that is the regression
guard for this whole redesign.

### 5.3 Code panel chrome

Three stacked rows above the code, replacing the current single header:

1. **Tab strip** — recently viewed files, horizontally scrollable below `lg`. Close button on the
   active tab only, `role="tablist"`, arrow-key navigation.
2. **Breadcrumb** — clickable folder segments, each narrowing the tree. The last segment is the
   file name in `text-foreground`; ancestors are `text-muted-foreground` with hover.
3. **Facts row** — `412 lines · 18.3 kB · 47 chunks · 6.1k tokens`, then the index-state pill, then
   the actions: `Ask`, `Copy`, and an overflow `⋯` holding the theme picker and "Copy path".

**Copy / theme / ask** collapse into the overflow because three always-visible controls on a
narrow panel is what forced the current layout to be awkward. `Ask` stays visible because it is the
conversion action — and it **disables** on a non-indexed file, with the tooltip naming the reason.

Line numbers widen from `w-8` to `w-11` and stay `sticky left-0`, which matters once the file names
in the rail carry line counts and the two number columns are on screen together.

### 5.4 Not-searched affordance

When the active file is not `indexed`:

- the facts row shows an amber `Not searchable` pill;
- `Ask` is `disabled` with a tooltip stating the specific reason — *"The run stopped at the
  500-file cap before reaching this file"*, *"This file produced no indexable chunks"*, or
  *"This project has no usable index"* depending on status;
- nothing else changes. The file is fully readable. Being unsearchable is a fact about the index,
  not about the code.

No mutation, no credit spend, no new endpoint.

### 5.5 Picker grid

Card hierarchy inverts. Today: stars, forks, commits, contributors, then a date. New order:

1. **Searchable file count** — the headline figure, with the `CoverageMeter` beneath it.
2. **GitHub-language bar** — `composition.tsx`'s `colorFor` logic, extracted and shared rather than
   reimplemented.
3. **Indexed tokens** and **last synced** — the two recency/footprint figures.
4. **Stars / forks** — demoted to a single small meta line. They are GitHub's numbers about the
   repository, not about this product's index, and they were previously given the most prominent
   position on a surface whose purpose is reading indexed code.

`getAllProjects` gains four columns (`indexedFileCount`, `totalFileCount`, `estimatedTokens`,
`lastSyncedAt`) in its existing `select`. Additive, no new procedure.

---

## 6. States

| State | Trigger | Treatment |
|---|---|---|
| Loading | Query in flight | Skeleton mirrors the real layout: strip, then rail rows at the right indent, then code rows. Deterministic widths — no `Math.random()`. |
| Empty — no files stored | `files.length === 0` | Explains that ingestion stored nothing, distinguishes "still ingesting" from "nothing matched", points at the sync action. Does not reuse the generic `EmptyState`, whose CTA is "add repo" and wrong here. |
| Empty — no match | `query` or `filter` yields nothing | Distinct from the above: reports what was searched and offers to clear the filter. A zero-result tree must not read as an empty project. |
| Error | Procedure throws | Reuses `project-error.tsx`'s `ErrorState` with retry. Ownership failures surface as "not found", matching the 404 convention. |
| In flight | `embeddingStatus === "processing"` | Strip shows `embeddingProgress`; a hairline progress rule under the meter. No polling, no spinner theatre. |
| Not indexed | Active file not `indexed` | §5.4. Fully readable, Ask disabled with reason. |

---

## 7. Motion Design

`MotionConfig reducedMotion="user"` with `transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}`,
matching `project-page.tsx`. Motion explains a state change or it does not ship.

| Element | Change | Motion | Duration |
|---|---|---|---|
| Rail | collapse / expand | width + opacity | 200ms |
| Rail sheet (< `lg`) | open / close | x-translate + scrim fade | 200ms |
| Code panel | file swap | opacity 0→1, y 8→0 | 150ms |
| Coverage meter | first paint | width 0→target | 500ms, `[0.16,1,0.3,1]` |
| Filter chip | selection | background + color | 120ms |
| Tree row | hover / focus | background | 120ms |
| Tab strip | add / remove | width + opacity | 150ms |

Nothing animates while idle. No springs, no magnetic hover, no scanline sweep, no pulsing dots on
files that are simply not indexed — a file that will never become indexed does not get an attention
animation. `globals.css:475`'s `prefers-reduced-motion` block continues to disable
`gv-wire-pulse` / `gv-scanline-sweep`; `MotionConfig` handles the rest.

---

## 8. Visual Environment

**Color.** The index dot is the only new color role, and it uses tokens that already exist:
`--gv-moss` (indexed), `--gv-amber` (skipped), `--gv-wire` → `text-muted-foreground` at 30%
(not-indexed). This is deliberately the same vocabulary `CoverageMeter` uses, so the dot and the
band it sums into are the same color.

Primary blue is reserved for interactive affordance only — selection, focus rings, the `Ask`
button. An index dot is not interactive, so it does not wear the interactive color.

**Typography.** `--font-gv-mono` for every figure: line counts, byte counts, chunk counts, token
counts, and the breadcrumb. `--font-gv-display` for the page title, `--font-gv-body` for prose and
the facts-row labels. All figures `tabular-nums` so the strip does not shimmer as digits change
during a re-render. Facts row at 12px; code at 13px (unchanged — it is already correct).

**Spacing.** 4px base. Facts row 12px vertical / 16px horizontal between figures. Rail rows 20px
vertical. Gutters 16px. The instrument strip is 44px tall at `lg`; it is a band, not a panel, and
must not grow a shadow.

**Surfaces.** Two, per `overview/index.tsx`'s doctrine: the instrument strip is one bordered block,
and the viewer shell is one bordered block. No card nested inside a card. The rail and code panel
are two panes of one surface, separated by a hairline, not two cards.

---

## 9. Copy Changes

| Surface | From | To | Why |
|---|---|---|---|
| Section header | `1201 files` | `1201 files` *(unchanged, moved)* | **This exact string is load-bearing and must not be reformatted.** `e2e/ingestion.spec.ts:176` locates it with `page.getByText(/^\d+ files?$/)` — a whole-element match with no thousands separator permitted. It renders today as `{data?.totalFiles || 0} files` (`code-viewer/index.tsx:165`), i.e. the raw number. `formatCount(1201)` returns `"1,201"`, which does **not** match, so passing it through `formatCount` breaks E2E with no visible symptom in the component. The redesign relocates this element into the instrument strip and leaves it raw; §5.1 states the constraint. |
| Facts row | (none) | `412 lines · 18.3 kB · 47 chunks · 6.1k tokens` | New surface. |
| Dot tooltip | (none) | `Indexed · 47 chunks, 6,102 tokens` / `Skipped — produced no indexable chunks` / `Not indexed — past the 500-file cap` | New surface. |
| `Ask` disabled | (none) | Reason, per status | A disabled button with no explanation is a dead end. |
| Search | `Search files` | `Search paths` | It filters paths, not contents. The old label overpromised. |
| Picker card | `2.4k ★ 180 forks 340 commits` | `1,043 searchable` + coverage + tokens + synced | Inverts the hierarchy toward the product's own index. |
| Empty result | `No files` | `No paths match "uspr". Clear the filter?` | Distinguishes zero-result from zero-file. |

---

## 10. Accessibility

- The tree keeps `role="tree"` / `treeitem` / `group`, roving tabindex, and `data-path` on every
  row. `file-tree-aria.test.tsx` passes unmodified.
- The dot is `aria-hidden`; the file's index state is announced in the row's accessible name
  (`"layout.tsx, 128 lines, indexed"`), so it is available to a screen reader without relying on
  color alone.
- The coverage meter keeps `role="img"` with a full-sentence `aria-label`.
- Filter chips are a single-select group with `aria-pressed`, not a `tablist` — they filter the
  tree, they do not navigate between panels.
- The tab strip is a real `tablist` with roving tabindex and a close button labelled
  `"Close <name> tab"`.
- Every disabled control has a tooltip; the tooltip is reachable by keyboard focus on the wrapper,
  since a `disabled` button cannot receive focus. The reason text is also rendered as
  visually-hidden prose adjacent to the facts row, so it is in the accessibility tree regardless.
- The `Ask` button remains the only element that spends credits; disabling it is a cost guard, not
  a permissions boundary, and no authorization decision changes.
- `e2e/accessibility.spec.ts` currently `test.fixme`s `/code-viewer` for pre-existing
  `color-contrast` (serious) and `button-name` (critical) findings under T-087. This redesign is
  expected to clear both — the amber dot at 30% opacity is the risk, and it must meet 4.5:1 against
  `--color-card`. If it does not, the not-indexed dot moves to a shape-plus-color treatment. That
  check is part of Verification, not an assumption.

---

## 11. Files

### New

| Path | Purpose |
|---|---|
| `src/lib/file-index-state.ts` | `FileIndexState`, `fileIndexState()`, reason copy. Pure, browser-importable. |
| `src/__tests__/unit/file-index-state.test.ts` | Derivation truth table + reason strings. |
| `.../code-viewer/reducer.ts` | Viewer state machine. |
| `.../code-viewer/file-stats.ts` | Strip figures + strip/row count derivation. |
| `.../code-viewer/index-dot.tsx` | Dot + tooltip + accessible name fragment. |
| `.../code-viewer/tab-strip.tsx` | Recently-viewed strip, sessionStorage-backed. |
| `.../code-viewer/highlight.ts` | Shiki singletons, theme cache, LRU, from `code-panel.tsx`. |
| `src/__tests__/unit/code-viewer-reducer.test.ts` | Selection-survives-filter, recent cap. |
| `src/__tests__/unit/fuzzy-path.test.ts` | Subsequence matching, bonuses, empty query. |

### Modified

| Path | Change |
|---|---|
| `.../services/projectService.ts` | Add `getIndexedProjectFiles`. Extend `getAllProjects` select by 4 columns. |
| `.../router/project.ts` | Add `getIndexedFiles` procedure. |
| `.../hooks/use-project.ts` | Add `useIndexedProjectFiles`. |
| `.../code-viewer/index.tsx` | `useReducer`; strip + tabs + sheet; drop the fixed `80vh`. |
| `.../code-viewer/code-panel.tsx` | Shiki internals out; chrome in; wider gutter. |
| `.../code-viewer/file-tree.tsx` | Dot, line count, aggregated directory dot. |
| `.../code-viewer/utils.ts` | Add `fuzzyMatch`. Single `escapeHtml`. |
| `.../code-viewer/loading.tsx` | Deterministic layout-matched skeleton. |
| `code-viewer-project-grid.tsx` | Index-first card. |
| `app/(main)/code-viewer/[projectId]/page.tsx` | Drop the duplicated header; own the height. |
| `app/(main)/code-viewer/loading.tsx` | Match the new card shape. |

### Unchanged (deliberately)

`db/schema.ts` and `db/migrations/**` — no migration. `project.getFiles` — untouched.
`charts/coverage-meter.tsx` and `charts/segmented-bar.tsx` — reused, not forked.
`overview/index-health.tsx` — its counter-derived framing is a different question.

---

## 12. Testing

New pure functions carry new tests; existing tests are regression guards and must not be edited to
pass.

- `file-index-state.test.ts` — all three states across all five statuses; `chunkCount > 0` wins
  regardless of status; unknown status string degrades to `not-indexed`, never throws.
- `code-viewer-reducer.test.ts` — filter does not deselect; `select` prepends and caps `recent` at
  8; re-selecting moves to front rather than duplicating.
- `fuzzy-path.test.ts` — `uspr` → `user-profile.ts`; segment-boundary bonus ranks `app/page.tsx`
  above `application.tsx`; empty query returns everything; no-subsequence returns nothing.
- `code-viewer-lines.test.ts` — **must pass unmodified.** `splitHighlightedLines` is moving files but
  its contract (one `<span class="line">` per line, no `</span>\n`) is what keeps the deep-link
  tint selector working.
- `file-tree-aria.test.tsx` — **must pass unmodified.**
- `section-rail.test.tsx` — **must pass unmodified**; mocks the viewer default export, so the
  export shape must stay a default export.
- New: `file-stats.test.ts` for the strip's count derivation, since the strip and the dots must be
  provably the same numbers.

No integration test without `TEST_DATABASE_URL`; if one is available, assert the procedure returns
zero chunks (not a missing row) for an unembedded file — the `COALESCE` is the thing most likely to
be dropped by a future edit.

---

## 13. Verification

Run in CI order. A change is done when all six pass locally.

```bash
bun run typecheck
bun run lint
bun run test
bun run test:coverage    # the gate
bun run build
```

Beyond the gates:

- [ ] `bun run test:coverage` — global 35/28/27/36 and `src/lib/**` 54/49/59/55 hold. The new
      `src/lib/file-index-state.ts` is pure logic with a test file, so it should land well above the
      floor; the risk is the rewritten components dragging `src/features/**` down, which has no
      per-directory floor.
- [ ] `e2e/ingestion.spec.ts` — `N files` still reachable on `/code-viewer/<id>`.
- [ ] `e2e/rag-chat.spec.ts` — citation `?file=` still resolves to a real `data-path`.
- [ ] `e2e/accessibility.spec.ts` — re-run axe on `/code-viewer` and record whether the
      `color-contrast` finding is cleared. If cleared, un-`fixme` it and update T-087.
- [ ] Manual: a project at `partial` and one at `completed` with an unchunkable file, to confirm
      the two different amber/muted readings are both correct.