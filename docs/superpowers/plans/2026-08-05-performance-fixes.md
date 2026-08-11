# Performance Fixes (Review Items 39–42) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four performance issues: convert the client `(main)` layout to a server layout + client shell, remove wholesale React Query localStorage persistence, stream live phase statuses during RAG retrieval, and load the highlight.js theme CSS on demand.

**Architecture:** Each fix is an isolated, surgical change. `(main)/layout.tsx` becomes a thin server component that renders a new client `DashboardShell` (sidebar + content column), so pages stay server components. The query persister is deleted from the root provider. The chat API moves its slow RAG retrieval inside the UI-message-stream `execute()`, emitting `data-status` events per phase; the chat room renders the phase in its skeleton. highlight.js CSS moves from a static import to a dynamic `import()` inside the chat `CodeBlock`.

**Tech Stack:** Next.js 16.2.12 (Turbopack), React 19, TypeScript, tRPC + @tanstack/react-query, AI SDK v7.0.47 (`ai`, `@ai-sdk/google`, `@ai-sdk/react`), highlight.js 11.

## Global Constraints

- **No new dependencies.** Only existing packages may be used; two unused packages are *removed*.
- **No test framework exists in this repo** (no vitest/jest config). Verification is `bun run build`, `bunx tsc --noEmit`, `npx eslint .`, plus a manual smoke test of chat streaming.
- **Preserve UX and behavior.** Only the four listed performance changes; no layout, styling, copy, or API-shape changes beyond them.
- **Alias convention:** `@/` maps to the repo root (e.g. `@/src/features/...`). Follow it.
- **`app/(main)/error.tsx` and `app/(auth)/layout.tsx` are untouched** — error boundaries must stay client components.

---

### Task 1: Convert `(main)` layout to server layout + client `DashboardShell`

**Files:**
- Create: `src/features/dashboard/components/dashboard-shell.tsx`
- Modify: `app/(main)/layout.tsx` (replace entire file)

**Interfaces:**
- Produces: `DashboardShell` — default? No, **named** export `export function DashboardShell({ children }: { children: React.ReactNode })`. The layout imports it as `{ DashboardShell }`.
- Consumes: `Sidebar` (default export) from `./sidebar/sidebar`; `SIDEBAR_WIDTH_COLLAPSED`, `SIDEBAR_WIDTH_EXPANDED` from `./sidebar/sidebar.constants` (same imports the old layout used).
- The previously-exported `useSidebar` / `SidebarContext` from `app/(main)/layout.tsx` are **dead code** (verified: nothing imports them) and are removed.

- [ ] **Step 1: Create `src/features/dashboard/components/dashboard-shell.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import Sidebar from "./sidebar/sidebar";
import {
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_WIDTH_EXPANDED,
} from "./sidebar/sidebar.constants";

interface DashboardShellProps {
  children: React.ReactNode;
}

/**
 * Client chrome for the (main) route group. Owns the sidebar collapse state
 * and the Cmd/Ctrl+B shortcut, then composes the fixed Sidebar + content
 * column. `children` is a server-rendered page slot passed through untouched,
 * so pages under this shell stay server components and are not pulled into
 * the client bundle.
 */
export function DashboardShell({ children }: DashboardShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Handle keyboard shortcut (Cmd/Ctrl + B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setIsCollapsed((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const sidebarWidth = isCollapsed
    ? SIDEBAR_WIDTH_COLLAPSED
    : SIDEBAR_WIDTH_EXPANDED;

  return (
    <div className="relative min-h-screen">
      {/* The Sidebar renders both the fixed desktop rail and the mobile
          drawer internally — mounting it once avoids duplicated mobile
          triggers/overlays. */}
      <Sidebar
        isCollapsed={isCollapsed}
        onToggle={() => setIsCollapsed(!isCollapsed)}
      />

      {/* Main content - desktop padding only; none on mobile (the sidebar is
          hidden below md, so a static paddingLeft would push content
          off-screen). The width is injected via CSS var so it stays in sync
          with SIDEBAR_WIDTH_* constants. */}
      <main
        className="min-h-screen transition-all duration-300 md:pl-(--sidebar-w)"
        style={{ "--sidebar-w": `${sidebarWidth}px` } as React.CSSProperties}
      >
        <div className="h-full">{children}</div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Replace `app/(main)/layout.tsx`**

Full new file content (no `"use client"` directive):

```tsx
import { DashboardShell } from "@/src/features/dashboard/components/dashboard-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
```

- [ ] **Step 3: Type-check and lint**

Run: `bunx tsc --noEmit`
Expected: PASS with no errors.
Run: `npx eslint app/\(main\)/layout.tsx src/features/dashboard/components/dashboard-shell.tsx`
Expected: no errors. (If `dashboard-shell.tsx` reports the unused-var `DashboardShellProps` style rules, they are type-level only and safe.)

- [ ] **Step 4: Production build**

Run: `bun run build`
Expected: PASS. All `(main)` routes (dashboard, chat, code-viewer, create-project) compile; no client-boundary errors.

- [ ] **Step 5: Commit**

```bash
git add app/\(main\)/layout.tsx src/features/dashboard/components/dashboard-shell.tsx
git commit -m "perf: make (main) layout a server component via client DashboardShell"
```

---

### Task 2: Remove React Query localStorage persistence

**Files:**
- Modify: `src/shared/providers/app-provider.tsx` (replace entire file)
- Modify: `package.json` (remove two dependencies)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `Provider` (default export) — same contract as before: a client component wrapping `children` in `ClerkProvider` → `MotionConfig` → `trpc.Provider` → `ThemeProvider`. No `PersistQueryClientProvider`, no storage persister.
- The persister packages `@tanstack/query-sync-storage-persister` and `@tanstack/react-query-persist-client` are used **only** in this file (verified) and are removed.

- [ ] **Step 1: Replace `src/shared/providers/app-provider.tsx`**

Full new file content:

```tsx
"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { Toaster } from "react-hot-toast";
import { memo, useEffect, useState } from "react";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "@/src/lib/trpc/client";
import { makeQueryClient } from "@/src/lib/trpc/query-client";
import { MotionConfig } from "framer-motion";

interface ProviderProps {
  children: React.ReactNode;
}

// Memoized Toaster component to prevent unnecessary re-renders
const MemoizedToaster = memo(() => (
  <Toaster
    position="bottom-right"
    toastOptions={{
      style: {
        background: "var(--toast-bg, #fff)",
        color: "var(--toast-text, #333)",
        boxShadow: "0 3px 10px rgba(0, 0, 0, 0.2)",
        borderRadius: "8px",
        padding: "6px",
        paddingLeft: "10px",
        fontSize: "15px",
        fontWeight: "500",
        lineHeight: "1.5",
        transition: "all 0.3s ease",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "0.5px solid rgba(255, 255, 255, 0.2)",
        zIndex: 99,
      },
      success: {
        duration: 4000,
      },
      error: {
        duration: 6000,
      },
    }}
  />
));
MemoizedToaster.displayName = "MemoizedToaster";

const Provider = ({ children }: ProviderProps) => {
  // Create a client using the factory to ensure consistent configuration
  // (transformers, etc.). Query data is NOT persisted to localStorage — pages
  // prefetch fresh data server-side (RSC) and hydrate, so a persisted cache
  // would only risk hydrating stale project/chat data.
  const [queryClient] = useState(() => makeQueryClient());

  // Create tRPC client
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
        }),
      ],
    }),
  );

  // Keep the toast theme CSS vars in sync with the active theme class.
  useEffect(() => {
    const updateToastThemeVars = () => {
      const isDark = document.documentElement.classList.contains("dark");
      document.documentElement.style.setProperty("--toast-bg", "transparent");
      document.documentElement.style.setProperty(
        "--toast-text",
        isDark ? "#fff" : "#333",
      );
    };

    updateToastThemeVars();
    const observer = new MutationObserver(updateToastThemeVars);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <ClerkProvider>
      <MotionConfig reducedMotion="user">
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            enableColorScheme
            disableTransitionOnChange={false}
          >
            <MemoizedToaster />
            {children}
          </ThemeProvider>
        </trpc.Provider>
      </MotionConfig>
    </ClerkProvider>
  );
};
export default Provider;
```

- [ ] **Step 2: Remove the two persister dependencies from `package.json`**

In the `dependencies` block, delete these two lines:
- `"@tanstack/query-sync-storage-persister": "^5.101.4",`
- `"@tanstack/react-query-persist-client": "^5.101.4",`

Then run: `bun install`
Expected: lockfile updates; `bunx tsc --noEmit` still passes.

- [ ] **Step 3: Verify no lingering imports**

Run: `grep -rn "query-sync-storage-persister\|react-query-persist-client" app src --include="*.ts" --include="*.tsx" | grep -v node_modules`
Expected: no output (the only two usages were removed).

- [ ] **Step 4: Type-check and lint**

Run: `bunx tsc --noEmit`
Expected: PASS.
Run: `npx eslint src/shared/providers/app-provider.tsx`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/providers/app-provider.tsx package.json bun.lock
git commit -m "perf: drop wholesale React Query localStorage persistence"
```

---

### Task 3: Load highlight.js theme CSS on demand

**Files:**
- Modify: `src/features/chat/components/chat-message.tsx` (delete one import line)
- Modify: `src/features/chat/components/code-block.tsx` (add one effect)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `CodeBlock` (named export, unchanged signature `{ children, language, className }`) that triggers a lazy `import()` of the theme CSS on first mount. `ChatMessage` no longer statically imports the CSS.
- Behavior: rehype-highlight still adds `hljs-*` classes to code spans during markdown processing (unchanged); the theme CSS arrives just-in-time when the first code block mounts.

- [ ] **Step 1: Remove the static CSS import from `chat-message.tsx`**

Delete this line (line 5):

```tsx
import "highlight.js/styles/github-dark-dimmed.min.css";
```

- [ ] **Step 2: Add on-demand CSS loading to `code-block.tsx`**

Change the import at the top from:

```tsx
import { useState, type ReactNode } from "react";
```

to:

```tsx
import { useEffect, useState, type ReactNode } from "react";
```

Add this effect inside the `CodeBlock` component body, right after the existing `useState` hooks:

```tsx
  // Load the highlight.js theme CSS only when a code block actually renders.
  // Next.js emits the CSS import as a lazy chunk, so pages that never render
  // a chat code block never download it.
  useEffect(() => {
    import("highlight.js/styles/github-dark-dimmed.min.css").catch(() => {
      // Theme CSS is optional — code stays readable without it.
    });
  }, []);
```

- [ ] **Step 3: Type-check and lint**

Run: `bunx tsc --noEmit`
Expected: PASS.
Run: `npx eslint src/features/chat/components/chat-message.tsx src/features/chat/components/code-block.tsx`
Expected: no errors (the `.catch(() => {})` empty block is intentional and safe; ESLint `no-empty` does not flag `.catch` callbacks with a comment).

- [ ] **Step 4: Production build**

Run: `bun run build`
Expected: PASS. The chat route's client chunks no longer include the highlight.js theme CSS statically; it appears as a lazy chunk.

- [ ] **Step 5: Commit**

```bash
git add src/features/chat/components/chat-message.tsx src/features/chat/components/code-block.tsx
git commit -m "perf: load highlight.js theme CSS on demand"
```

---

### Task 4: Stream live phase statuses during RAG retrieval

**Files:**
- Modify: `app/api/chat/route.ts` (restructure the `POST` handler body)
- Modify: `src/features/chat/components/chat-room.tsx` (status type, state, `onData`, skeleton)

**Interfaces:**
- Consumes: all existing helper functions in `app/api/chat/route.ts` unchanged — `buildSmallProjectSystemPrompt`, `buildRagSystemPrompt`, `rewriteQueryForRetrieval`, `retrieveContext`, `isSmallProject`, `getAllProjectFilesForContext`, `getProjectContext`, `getRecentChatHistoryForContext`, `spendCredit`. All helpers keep their existing signatures.
- Produces: a `data-status` event contract with values `"rewriting" | "searching" | "ranking"`, matching the existing `data-status` event shape (`{ type: "data-status", data: { type: "status", value } }`). The client `StatusEvent` type is widened to those three values; `ChatRoom` renders the current phase in `RetrievalSkeleton`.
- Error semantics preserved: `assertProjectOwnership` still runs **before** the stream is created, so ownership failures return a real 404; credit spend still happens before streaming.

- [ ] **Step 1: Restructure the `POST` handler in `app/api/chat/route.ts`**

Replace the entire `export async function POST(req: Request) { ... }` body (currently lines 318–566) with:

```ts
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    // Per-user cap on LLM-backed chat messages (20/min)
    const rl = await rateLimit(keys.chat(userId), 20, 60);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please slow down." }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const { messages, chatId, projectId, mode = "general" } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages required" }), {
        status: 400,
      });
    }

    const userMessage = messages[messages.length - 1]?.content as
      | string
      | undefined;
    if (!userMessage) {
      return new Response(JSON.stringify({ error: "Empty message" }), {
        status: 400,
      });
    }

    // Verify chat ownership and store user message
    if (chatId) {
      const [chat] = await db
        .select({ userId: projectChats.userId })
        .from(projectChats)
        .where(eq(projectChats.id, chatId))
        .limit(1);

      if (!chat || chat.userId !== userId) {
        return new Response(JSON.stringify({ error: "Chat not found" }), {
          status: 404,
        });
      }

      await db.insert(chatMessages).values({
        chatId,
        role: "user",
        content: userMessage,
        createdAt: new Date(),
      });
    }

    // Enforce the credit budget — atomic spend, 402 when exhausted.
    // Spent after validation so invalid requests don't burn credits.
    const remaining = await spendCredit(userId);
    if (remaining === null) {
      return new Response(
        JSON.stringify({
          error: "You're out of credits. Please top up to continue chatting.",
        }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      );
    }

    // Fast project metadata read — kept OUTSIDE the stream so ownership
    // errors still return a real 404 and the response starts streaming
    // immediately. The slow retrieval work happens inside execute() below so
    // the client receives live phase statuses instead of a silent wait.
    let projectInfo: {
      projectName: string;
      embeddingStatus: string | null;
      estimatedTokens: number | null;
    } | null = null;

    if (mode === "project" && projectId) {
      // Tenant isolation — the requesting user must own this project.
      // Throws ProjectAccessError → 404 via the outer catch (no fallback).
      await assertProjectOwnership(projectId, userId);

      const [project] = await db
        .select({
          projectName: projectTables.projectName,
          embeddingStatus: projectTables.embeddingStatus,
          estimatedTokens: projectTables.estimatedTokens,
        })
        .from(projectTables)
        .where(eq(projectTables.id, projectId))
        .limit(1);

      projectInfo = project ?? null;
    }

    const stream = createUIMessageStream({
      async execute({ writer }) {
        let systemPrompt = SYSTEM_PROMPT_GENERAL;
        let relatedFiles: string[] = [];

        if (mode === "project" && projectId && projectInfo) {
          if (projectInfo.embeddingStatus !== "completed") {
            systemPrompt = `You are GitVision AI. The project "${
              projectInfo.projectName
            }" has not been fully indexed yet (status: ${
              projectInfo.embeddingStatus ?? "unknown"
            }). Please let the user know that embeddings need to be generated before codebase-aware chat can work. You can still answer general programming questions.`;
          } else {
            // Conversation history for both prompts and query rewrite
            let conversationHistory = "No previous conversation.";
            if (chatId) {
              try {
                conversationHistory = await getRecentChatHistoryForContext(
                  chatId,
                  4,
                );
              } catch (historyError) {
                console.warn(
                  "[RAG] Failed to load conversation history, proceeding without it:",
                  historyError,
                );
              }
            }

            // --------------------------------------------------------------
            // FAST PATH: small project — dump entire codebase into context
            // --------------------------------------------------------------
            if (isSmallProject(projectInfo.estimatedTokens)) {
              writer.write({
                type: "data-status",
                data: { type: "status", value: "searching" },
              });

              const fullContext = await getAllProjectFilesForContext(projectId);
              systemPrompt = buildSmallProjectSystemPrompt(
                projectInfo.projectName,
                fullContext,
                conversationHistory,
              );
            } else {
              // --------------------------------------------------------------
              // RAG PATH: large project — rewrite query → classify → retrieve
              // --------------------------------------------------------------
              writer.write({
                type: "data-status",
                data: { type: "status", value: "rewriting" },
              });

              // Rewrite only when there's real history (skips the LLM call on
              // first message, saving ~100ms)
              const standaloneQuery = await rewriteQueryForRetrieval(
                userMessage,
                conversationHistory,
              );

              writer.write({
                type: "data-status",
                data: { type: "status", value: "searching" },
              });

              const { context, relatedFiles: files } = await retrieveContext(
                projectId,
                userMessage,
                standaloneQuery,
              );
              relatedFiles = files;

              writer.write({
                type: "data-status",
                data: { type: "status", value: "ranking" },
              });

              const projectStats = await getProjectContext(projectId);

              systemPrompt = buildRagSystemPrompt(
                projectInfo.projectName,
                context,
                projectStats,
                conversationHistory,
              );
            }
          }
        }

        // Once sources are known, send them (resolved above before the LLM
        // token stream starts)
        if (relatedFiles.length > 0) {
          writer.write({
            type: "data-sources",
            data: { type: "sources", files: relatedFiles },
          });
        }

        // Stream LLM tokens
        const result = streamText({
          model: google("gemini-2.5-flash"),
          system: systemPrompt,
          messages,
          onFinish: async ({ text }) => {
            if (!chatId) return;

            await Promise.all([
              db.insert(chatMessages).values({
                chatId,
                role: "assistant",
                content: text,
                relatedFiles,
                createdAt: new Date(),
              }),
              db
                .update(projectChats)
                .set({ updatedAt: new Date() })
                .where(eq(projectChats.id, chatId)),
            ]);

            // Auto-generate title from first message
            const [chat] = await db
              .select({ title: projectChats.title })
              .from(projectChats)
              .where(eq(projectChats.id, chatId))
              .limit(1);

            if (
              chat?.title === "General Chat" ||
              chat?.title === "Project Chat" ||
              chat?.title === "New Chat"
            ) {
              await db
                .update(projectChats)
                .set({ title: userMessage.slice(0, 80).trim() })
                .where(eq(projectChats.id, chatId));
            }
          },
        });

        writer.merge(toUIMessageStream({ stream: result.stream }));
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error("Chat API error:", error);
    return new Response(JSON.stringify({ error: "Something went wrong" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
```

- [ ] **Step 2: Type-check the route**

Run: `bunx tsc --noEmit`
Expected: PASS. (The `execute` callback is `async` — the AI SDK's `execute: (options: { writer }) => Promise<void> | void` accepts it. `writer.merge` returns `void`, so no `await` on it.)

- [ ] **Step 3: Widen the status type and add phase state in `chat-room.tsx`**

Change the `StatusEvent` interface from:

```ts
interface StatusEvent {
  type: "data-status";
  data: { type: "status"; value: "searching" };
}
```

to:

```ts
interface StatusEvent {
  type: "data-status";
  data: { type: "status"; value: "rewriting" | "searching" | "ranking" };
}
```

Change the `RetrievalSkeleton` function signature and label. Replace:

```tsx
function RetrievalSkeleton() {
```

with:

```tsx
const RETRIEVAL_PHASE_LABELS: Record<"rewriting" | "searching" | "ranking", string> = {
  rewriting: "Rewriting query...",
  searching: "Searching codebase...",
  ranking: "Ranking results...",
};

function RetrievalSkeleton({
  phase = "searching",
}: {
  phase?: "rewriting" | "searching" | "ranking";
}) {
```

And inside the skeleton, replace the hardcoded label line:

```tsx
            <span className="text-xs text-muted-foreground/60 animate-pulse">
              Searching codebase...
            </span>
```

with:

```tsx
            <span className="text-xs text-muted-foreground/60 animate-pulse">
              {RETRIEVAL_PHASE_LABELS[phase]}
            </span>
```

- [ ] **Step 4: Add phase state and handle status events in `chat-room.tsx`**

Add state next to the existing `liveSources` state:

```tsx
  // Latest retrieval phase reported by the server data stream
  const [retrievalPhase, setRetrievalPhase] = useState<
    "rewriting" | "searching" | "ranking"
  >("searching");
```

Extend `onData` to handle both event types. Replace:

```ts
    onData(event: any) {
      if (event.type === "data-sources" && Array.isArray(event.data?.files)) {
        setLiveSources(event.data.files);
      }
    },
```

with:

```ts
    onData(event: any) {
      if (event.type === "data-status" && event.data?.type === "status") {
        const value = event.data.value;
        if (value === "rewriting" || value === "searching" || value === "ranking") {
          setRetrievalPhase(value);
        }
      }
      if (event.type === "data-sources" && Array.isArray(event.data?.files)) {
        setLiveSources(event.data.files);
      }
    },
```

Reset the phase on (re)generation. In the `reload` function, after `setLiveSources([])`, add:

```ts
    setRetrievalPhase("searching");
```

And in `onSubmit`, after `setHasFirstToken(false)`, add:

```ts
    setRetrievalPhase("searching");
```

- [ ] **Step 5: Render the phase in the skeleton**

In the render block, replace:

```tsx
                  <RetrievalSkeleton />
```

with:

```tsx
                  <RetrievalSkeleton phase={retrievalPhase} />
```

- [ ] **Step 6: Type-check and lint**

Run: `bunx tsc --noEmit`
Expected: PASS.
Run: `npx eslint app/api/chat/route.ts src/features/chat/components/chat-room.tsx`
Expected: no errors.

- [ ] **Step 7: Production build**

Run: `bun run build`
Expected: PASS.

- [ ] **Step 8: Manual smoke test of retrieval statuses**

Run: `bun run dev`
Then in the browser:
1. Open a project chat (`/chat/<chatId>` for a large project, or create one).
2. Send a follow-up question (so the query-rewrite LLM call runs).
3. Confirm the skeleton label advances through "Rewriting query..." → "Searching codebase..." → "Ranking results..." before the first token, then streams the reply.
4. Confirm the related-files badges still appear and the assistant message is persisted (reload the page to check the message is in history).

- [ ] **Step 9: Commit**

```bash
git add app/api/chat/route.ts src/features/chat/components/chat-room.tsx
git commit -m "perf: stream live RAG retrieval phase statuses to chat UI"
```

---

## Full-Run Verification (after all tasks)

Run, in order:
1. `bunx tsc --noEmit` — no errors.
2. `npx eslint .` — no errors.
3. `bun run build` — succeeds.
4. `grep -rn "query-sync-storage-persister\|react-query-persist-client" app src --include="*.ts" --include="*.tsx"` — no output.
5. `grep -rn 'import "highlight.js/styles' app src` — no output (CSS no longer statically imported).
6. Manual: dashboard renders with sidebar toggle (Cmd/Ctrl+B) working; chat streams with live phases.
