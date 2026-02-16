# PLAN-chat-ui-redesign

## 1. Context Analysis

**User Request**: "page design is very bad", "clean, professional, clean, smooth design".
**Current State**: The chat is split into a "Landing Page" (cards) and a "Chat Room" (messages). This separation feels "heavy" and unlike modern chat tools (ChatGPT, Claude, v0).
**Goal**: Create a unified, fluid interface that feels like a premium IDE/Chat hybrid.

## 2. Design Direction: "Enterprise Fluid"

We will adopt a **Linear/Vercel-inspired** aesthetic:

- **Typography**: Inter (already present). High contrast text hierarchy.
- **Colors**: Deep dark backgrounds (`#0A0A0A`), subtle borders (`white/5`), functional accents (Emerald/Blue).
- **Layout**: Sidebar-first approach. The "Landing Page" becomes the "New Chat" state of the main view.
- **Motion**: `framer-motion` for all state changes (sidebar toggle, message entry, thinking states).

## 3. Proposed Changes

### A. Layout Restructure

- **Unified Layout**: Remove separate `/chat` (landing) and `/chat/[id]` pages.
- **Sidebar**: Collapsible sidebar on the left for "Recent Chats" and "Project Context".
- **Main Area**:
  - **Empty State**: "Good evening, [Name]. What are we building?" (formerly Landing).
  - **Active Chat**: Message stream with sticky input at bottom.

### B. Visual Polish

- **Glassmorphism 2.0**: Use `backdrop-filter: blur(12px)` only on floating elements (Header, Input).
- **Input Area**: Floating capsule design instead of full-width sticky bar.
- **Typography**: Increase line-height for readability. Use `text-foreground/60` for secondary text.
- **Icons**: Lucide icons, stroke-width 1.5px (cleaner look).

### C. Interactions

- **Cancel Button**: Integrated into the input capsule (User requested this).
- **Thinking State**: Shimmer effect + "Thinking..." pulse.
- **Code Blocks**: Minimalist terminal look with copy/download actions.

## 4. Implementation Steps

### Phase 1: Core Layout (Structure)

- [ ] Create `ChatLayout` component with Sidebar.
- [ ] Move "Recent Chats" from Landing to Sidebar.
- [ ] Implement "New Chat" empty state.

### Phase 2: Component Refinement (Polish)

- [ ] Redesign `ChatInput` (Floating Capsule).
- [ ] Redesign `ChatMessage` (Clean avatar, better spacing).
- [ ] Redesign `ChatLanding` (Merge into "Empty State").

### Phase 3: Animations (Smoothness)

- [ ] Add `AnimatePresence` for route transitions.
- [ ] Add typing indicators.
- [ ] Add "Stop Generation" interaction.

## 5. Agent Assignments

- **`frontend-specialist`**: Component styling, layout, motion.
- **`code-cleaner`**: Removing deprecated files/routes.

## 6. Verification Checklist

- [ ] "Cancel" button works instantly.
- [ ] Animations run at 60fps (no layout thrashing).
- [ ] Mobile responsive (Sidebar drawer).
- [ ] Dark/Light mode perfect contrast.
