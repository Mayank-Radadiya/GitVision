# Performance Fixes (Items 39–42) Design Specification

## Executive Summary
This document specifies the architectural design for remediating four core performance bottlenecks in GitVision:
1. **Item 39**: Server/Client layout boundary isolation (`(main)` layout).
2. **Item 40**: React Query cache freshness (elimination of 24h `localStorage` persistence).
3. **Item 41**: Real-time RAG retrieval phase streaming (`data-status`).
4. **Item 42**: On-demand dynamic loading of `highlight.js` theme CSS.

---

## 1. Understanding Summary
* **What is being built**: Comprehensive architectural optimization for layout bundling, cache hydration, chat retrieval feedback, and CSS payload delivery.
* **Why it exists**: To minimize initial JavaScript/CSS payloads, prevent stale cache hydration across sessions, and eliminate opaque waiting states during vector search.
* **Who it is for**: All users navigating the dashboard, chat, and codebase viewer.
* **Key constraints**:
  * No external dependency additions or removals.
  * Preserved visual design system, tRPC procedure contracts, and Clerk auth flow.
  * Next.js 16 App Router & Turbopack compatible.
* **Explicit non-goals**:
  * Modifying database models or tRPC route definitions.
  * Redesigning dashboard UI or chat message layouts.

---

## 2. Assumptions
* **RSC Prefetching**: RSC prefetching alongside React Query hydration provides sufficient performance without requiring client-side `localStorage` persistence.
* **Stream Compatibility**: AI SDK `createUIMessageStream` and `toUIMessageStream` support custom `data-status` payloads for real-time progress indicators.
* **Dynamic Styling**: Next.js chunking supports dynamic CSS `import()` calls inside `useEffect`.

---

## 3. Decision Log

| ID | Decision | Alternatives Considered | Rationale |
|---|:---|:---|:---|
| DEC-01 | **Server Layout + Client Shell** | Client-only layout component | Preserves Server Component benefits for sub-pages, shrinking client bundle size. |
| DEC-02 | **In-Memory QueryClient** | 24-hour `localStorage` persistence | Eliminates risk of hydrating stale project/chat state across user sessions. |
| DEC-03 | **UI Message Stream Phase Events** | Polling tRPC or blocking API call | Delivers instant phase status feedback (`rewriting`, `searching`, `ranking`) with zero latency overhead. |
| DEC-04 | **Dynamic `import()` for highlight.js CSS** | App-wide static CSS import | Defer CSS loading until a `CodeBlock` component is actually rendered. |

---

## 4. Final Architecture & Technical Design

### 4.1 Server Layout Boundary (`app/(main)/layout.tsx`)
* `app/(main)/layout.tsx` is defined as a thin Server Component.
* Client chrome logic (sidebar state `isCollapsed`, keyboard shortcut `Cmd+B`) is encapsulated in `DashboardShell` (`src/features/dashboard/components/dashboard-shell.tsx`).
* Sub-pages under `(main)` remain Server Components.

### 4.2 Query Client Caching (`src/shared/providers/app-provider.tsx`)
* `QueryClient` is initialized strictly in React state within `AppProvider`.
* Wholesale `localStorage` persistence (`persistQueryClient` / `createSyncStoragePersister`) is removed.
* Fresh state is supplied via RSC prefetching and hydrated into client caches per session.

### 4.3 RAG Phase Streaming (`app/api/chat/route.ts` & `chat-room.tsx`)
* The chat POST endpoint emits structured `data-status` progress payloads:
  * `rewriting`: Query expansion/rewriting.
  * `searching`: Vector database similarity search.
  * `ranking`: Context re-ranking and prompt assembly.
* `ChatRoom` consumes `data-status` payloads during pending states, displaying animated progress badges.

### 4.4 On-Demand highlight.js Theme (`code-block.tsx`)
* `src/features/chat/components/code-block.tsx` triggers dynamic CSS loading:
  ```tsx
  useEffect(() => {
    import("highlight.js/styles/github-dark-dimmed.min.css").catch(() => {});
  }, []);
  ```
* App-wide static imports of `highlight.js` CSS are removed.

---

## 5. Verification Plan
1. **Static Analysis**: Run `bunx tsc --noEmit` to verify type safety.
2. **Build Verification**: Run `bun run build` to verify Turbopack bundling, server/client boundaries, and lazy chunk generation.
3. **Runtime Verification**: Test `/api/chat` streaming endpoint and verify UI status indicator transitions.
