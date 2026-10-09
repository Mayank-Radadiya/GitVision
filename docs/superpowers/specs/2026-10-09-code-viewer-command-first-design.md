# Code Viewer Command-First Redesign (Approach B)

Date: 2026-10-09
Status: approved for planning (user chose B, said "start working")
Scope: `/code-viewer` picker grid + `/code-viewer/[projectId]` detail. Fresh rethink ignoring T-101 spec; T-101 implementation in tree is the starting point, stripped back.

## 1. Problem

Explorer job is speed: find file, read it. Current tree (T-101) orients via dashboard band (instrument strip) above content + filter chips + curated sections. That chrome costs vertical space and decisions on every visit. For explore-structure job, fastest path wins over most informative dashboard.

## 2. Direction

Command-first browser. Finder hero, tree secondary, code maximal. No Atlas sections, no right rail, no overview band. Index awareness demoted to row adornment + Ask guard, not headline.

## 3. Picker

Dense list, not cards. Row: avatar dot + name + repo path + `N files · toplang` + synced age + chevron. Command input on top (`Jump to project…`, `/` focuses, Esc clears, arrows + Enter). Client `includes` on name/url. Sort: recent-synced default, name toggle. Skeleton rows match height. Empty keeps create-project CTA. No-match echoes query + clear.

## 4. Detail layout (lg+)

Thin header (back + avatar + name + repo link + synced + Ask-in-chat link). Command bar: finder input (`Go to file… (N files)`) + breadcrumb + Copy icon + Ask primary + overflow. Body: tree 260px collapsible + code flex-1. Status line under code: `path · N lines · X kB · lang · index pill`. Below lg: tree becomes left sheet (x + scrim, Esc), status wraps.

Finder: always-visible input, `⌘K`/`/` focuses (scoped to viewer, no global hijack except when viewer mounted). Fuzzy subsequence + boundary/consecutive/basename bonuses (existing `fuzzyPathMatch`, reuse). Dropdown `combobox/listbox/option`, `aria-expanded`, `aria-activedescendant`. Enter opens, Esc refocuses code. No new dep.

Tree: `role=tree`, roving tabindex, `data-path`, dirs-first alpha — untouched contract. Row: name + `12 L` + index dot (`aria-hidden`, state in row name). Directory aggregate dot only if unanimous, dimmed. No filter chips in UI; `applyIndexFilter` pure fn stays for tests.

Code panel: tab strip recent-8 sessionStorage validated/pruned (`tablist`, arrows, close active only) — keep. Breadcrumb folders narrow finder query to `prefix/`. Shiki singleton + LRU + virtualizer keep. File swap opacity 0→1 y8→0 150ms. `?file=&line=` deep link keep. Ask disabled + reason tooltip when not indexed + visually-hidden reason.

## 5. Data

No server change. Reuse `getIndexedFiles` payload + `getAll` as-is. Client derive only. `assertProjectOwnership` first, `NOT_FOUND` never `FORBIDDEN`. No `db.transaction()`. Layer `app→features→lib→db`.

## 6. Motion

`MotionConfig reducedMotion=user`, ease `[0.16,1,0.3,1]`. Finder dropdown 120ms, tree collapse 200ms, file swap 150ms, tabs 150ms, chips n/a. Nothing idle.

## 7. States

Loading: deterministic skeleton (command bar + tree rows at indent + code rows). Empty-no-files: stored-nothing vs ingesting + sync pointer. Empty-no-match: echoes query + clear. Error: shared `ErrorState` + retry; ownership → not-found copy. Processing: thin progress under command bar. Not-searchable: readable, Ask disabled + reason.

## 8. Copy / E2E pins

`Go to file…`, `Search paths` (finder filters paths). Status keeps raw whole-element `${stored} files` (regex `/^\d+ files?$/`, no `formatCount` on that element). `?file=` + `data-path` + tree roles preserved. `e2e/ingestion.spec.ts`, `rag-chat.spec.ts` must pass unmodified.

## 9. A11y

Tree, tabs, meter contracts untouched. Finder combobox pattern. Dot `aria-hidden`. Disabled Ask wrapper focusable + hidden reason. Axe `/code-viewer` fixme cleared or kept with note.

## 10. Files

New: `code-viewer/file-finder.tsx` (+ test). Modified: `code-viewer-project-grid.tsx`, `code-viewer/index.tsx`, `code-viewer/rail.tsx` (chips out, search + tree), `code-viewer/code-panel.tsx` (slim, status line), `code-viewer/tab-strip.tsx` (shortcuts passthrough if needed), both `loading.tsx`. Unchanged: `schema.ts`, migrations, server procedures, `coverage-meter.tsx`, `splitHighlightedLines`, `applyIndexFilter`/`filterViewerFiles`/`fuzzyPathMatch` logic.

## 11. Testing

New: `file-finder.test.ts` (rank, Enter, Esc, empty, no-match). Keep passing unmodified: `code-viewer-lines`, `file-tree-aria`, `section-rail` (default export), `code-viewer-search-state` (incl. `applyIndexFilter` grouping). Coverage gate holds.

## 12. Verification

`typecheck`, `lint`, `test`, `test:coverage`, `build`. E2E ingestion + rag-chat + axe note. Manual: 1k-file finder latency, mobile sheet, partial vs completed dots.
