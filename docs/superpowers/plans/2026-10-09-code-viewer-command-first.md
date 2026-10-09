# Code Viewer Command-First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Code Viewer picker + detail as command-first browser (finder hero, tree secondary, code maximal).

**Architecture:** Client-only UI reshaping over unchanged `getAll` / `getIndexedFiles` payloads; one new `FileFinder` component, chips/strip removed, E2E pins preserved.

**Tech Stack:** Next.js 15, React, tRPC + TanStack Query, Tailwind, framer-motion, Shiki (existing singleton).

**Spec:** `docs/superpowers/specs/2026-10-09-code-viewer-command-first-design.md`

## Global Constraints

- Layering `app → features → lib → db`; no `db.transaction()`; ownership guards return 404 never 403.
- Raw whole-element `${stored} files` string preserved (no `formatCount` on that element) for `e2e/ingestion.spec.ts` `/^\d+ files?$/`.
- `?file=` + `?line=` deep links, `data-path` attributes, `role=tree` roving tabindex preserved for `rag-chat.spec.ts` + `file-tree-aria.test.tsx`.
- `CodeViewer` keeps default export (`section-rail.test.tsx` mocks it).
- `applyIndexFilter` / `filterViewerFiles` / `fuzzyPathMatch` logic untouched (`code-viewer-search-state.test.ts`).
- `splitHighlightedLines` contract untouched (`code-viewer-lines.test.ts`).
- `MotionConfig reducedMotion="user"`, ease `[0.16,1,0.3,1]`; no idle animation.
- bun package manager; verify with `bun run typecheck`, `bun run lint`, `bun run test`, `bun run test:coverage`, `bun run build`.

## Review Focus

- 1k-file repo finder keystroke stays <100ms (memoized filter, capped dropdown at 30 rows).
- Stale `sessionStorage` recent paths pruned against current file list, corrupt JSON fails closed.
- `⌘K`/`/` shortcuts scoped to viewer, never hijack typing in chat inputs outside viewer.
- Finder dropdown keyboard: arrows move active option, Enter opens, Esc refocuses input.
- Mobile sheet: scrim click + Esc close, focus returns to toggle button.

---

### Task 1: Fix TreeNode line-count type error

**Files:**
- Modify: `src/features/projects/components/project-view/code-viewer/utils.ts`
- Test: `src/__tests__/unit/code-viewer-search-state.test.ts` (existing, must pass)

**Interfaces:**
- Consumes: `FileEntry { lines?, bytes? }`
- Produces: `TreeNode { lines?: number; bytes?: number }` carried from file entries; `buildFileTree` populates them.

- [ ] **Step 1: Add failing typecheck proof**

Run: `bun run typecheck`
Expected: FAIL on `file-tree.tsx` `node.lines` (3 errors).

- [ ] **Step 2: Add `lines?`/`bytes?` to `TreeNode` and populate in `buildFileTree`**

Extend interface + file-node spread in `utils.ts` (normalize via existing `toNonNegativeCount`).

- [ ] **Step 3: Run typecheck for the viewer**

Run: `bunx tsc --noEmit -p tsconfig.json`
Expected: PASS (no `file-tree` errors).

- [ ] **Step 4: Run existing search-state tests**

Run: `bunx vitest run src/__tests__/unit/code-viewer-search-state.test.ts`
Expected: PASS.

### Task 2: New FileFinder component + tests

**Files:**
- Create: `src/features/projects/components/project-view/code-viewer/file-finder.tsx`
- Test: `src/__tests__/unit/file-finder.test.ts`

**Interfaces:**
- Consumes: `filterViewerFiles(files, query)` from `./utils`; `FileEntry[]`.
- Produces: `FileFinder({ files, query, onQuery, onSelect, autoFocusKey })` — combobox input + capped ranked dropdown (30), `aria-expanded`, `aria-activedescendant`, Enter/Esc/arrow handling.

- [ ] **Step 1: Write failing test**

```tsx
// file-finder.test.ts: ranks basename boundary hit first, Enter selects top, Esc clears, empty query shows nothing dropdown
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `bunx vitest run src/__tests__/unit/file-finder.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `FileFinder` in `file-finder.tsx`**

Reuse `filterViewerFiles`, slice 30, memoize; keyboard per spec.

- [ ] **Step 4: Run test, verify PASS**

Run: `bunx vitest run src/__tests__/unit/file-finder.test.ts`
Expected: PASS.

### Task 3: Rail — remove chips, keep search + tree

**Files:**
- Modify: `src/features/projects/components/project-view/code-viewer/rail.tsx`

**Interfaces:**
- Consumes: `query, onQuery, tree, hasFiles, selectedPath, onSelect, indexStatus`.
- Produces: `ViewerRail` without `filter`/`onFilter`/`counts` props (props removed; `applyIndexFilter` stays in utils for tests).

- [ ] **Step 1: Remove `FILTER_CHIPS` UI + props, keep empty-state copy**

- [ ] **Step 2: Typecheck + unit**

Run: `bun run typecheck && bunx vitest run src/__tests__/unit/code-viewer-search-state.test.ts src/__tests__/unit/file-tree-aria.test.tsx`
Expected: PASS.

### Task 4: Detail layout — finder-first, strip out, status line

**Files:**
- Modify: `src/features/projects/components/project-view/code-viewer/index.tsx`

**Interfaces:**
- Consumes: `FileFinder`, `ViewerRail` (new props), `CodePanel`, `ViewerTabStrip`, `useIndexedProjectFiles`.
- Produces: command bar (finder + breadcrumb mini + toggle) + tree + code + raw `${stored} files` status element; `filter` state removed (always `all`).

- [ ] **Step 1: Drop `InstrumentStrip` import/render, drop filter state, wire `FileFinder`**

- [ ] **Step 2: Add status line with raw stored caption + `⌘K`/`/` focus shortcut scoped to viewer**

- [ ] **Step 3: Typecheck + related tests**

Run: `bun run typecheck && bunx vitest run src/__tests__/unit/code-viewer-search-state.test.ts src/__tests__/unit/section-rail.test.tsx`
Expected: PASS.

### Task 5: Picker — dense list + command

**Files:**
- Modify: `src/features/projects/components/code-viewer-project-grid.tsx`, `app/(main)/code-viewer/loading.tsx`

**Interfaces:**
- Consumes: `trpc.project.getAll`.
- Produces: list rows (avatar + name + path + `N files · toplang` + synced + chevron) + top command input (`/ `focus, Esc clear, arrows + Enter).

- [ ] **Step 1: Replace card grid with list + command filter**

- [ ] **Step 2: Update `loading.tsx` skeleton to list rows**

- [ ] **Step 3: Typecheck + lint changed files**

Run: `bun run typecheck && bunx eslint src/features/projects/components/code-viewer-project-grid.tsx app/\(main\)/code-viewer/loading.tsx`
Expected: PASS, 0 errors.

### Task 6: Full verification

- [ ] **Step 1: Run gates in CI order**

Run: `bun run typecheck && bun run lint && bun run test && bun run test:coverage && bun run build`
Expected: all PASS; coverage thresholds hold; build compiles `(main)` routes.
