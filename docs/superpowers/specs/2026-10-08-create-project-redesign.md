# Create Project — Full Redesign Spec

**Date:** 2026-10-08  
**Scope:** `app/(main)/create-project` — complete UX + visual redesign  
**Path:** Architectural  
**Approved:** Yes (all three design decisions confirmed)

---

## Problem Statement

The existing Create Project page is a dual-pane form that functions correctly but doesn't feel premium or production-ready. Specific problems:

1. **Layout is too wide and lacks focus** — max-w-6xl spreads information thinly
2. **Dual-pane roles are unclear** — both panels contain credit ledgers; neither has a single clear purpose
3. **Credits info is duplicated** — appears in both the form card footer and the right-rail
4. **No progressive disclosure** — all fields and panels are visible at once, creating cognitive load
5. **Background decoration is vestigial** — dot grid and radial glow add visual noise with no purpose
6. **The right panel has 3 cards** with overlapping info (Blueprint, Credit Ledger, Pipeline Checklist)
7. **Preset buttons are understyled** — look like secondary items when they're a key accelerator
8. **Header copy is over-technical** — "AST directory tree, vector embeddings" as subtext

---

## Design Direction

**Single-column progressive reveal** — centered, max ~580px. The URL field is the primary input; everything else reveals from it. A clean context section below the form shows presets when idle and repo confirmation when URL validates.

Aesthetic reference: Linear, Vercel, Stripe — clean surfaces, tight type scale, intentional spacing, minimal motion.

---

## Architecture

### Layout

```
┌─────────────────────────────────────────┐
│  ← Back to Projects                     │
│                                         │
│  GitVision · New Project                │  ← breadcrumb pill
│                                         │
│  Add a repository                       │  ← H1
│  Connect a public GitHub repo...        │  ← subtext (1 line)
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 🐙  https://github.com/...   [✓] │  │  ← URL field (hero)
│  └───────────────────────────────────┘  │
│  [Paste ⌘V] [×]         ✓ owner/repo   │  ← helper row
│                                         │
│  ── or try a sample ──────────────────  │  ← preset pills (horizontal)
│  [React] [TypeScript] [Tailwind CSS]    │
│                                         │
│  ── (revealed after URL validates) ──   │
│                                         │
│  Project name          [Auto] [wand]    │  ← name field (revealed)
│  ┌───────────────────────────────────┐  │
│  │ 📁  Project Name                  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌─────────────── Confirmation ──────┐  │  ← context block (revealed)
│  │ facebook/react · Ready to index   │  │
│  │ 50 → −10 → 40 credits             │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Index Repository →      ⌘↵       │  │  ← CTA
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

### Component Structure

```
CreateNewProjectForm (add-repo.tsx — orchestrator)
├── BackLink            (unchanged)
├── PageHeader          (new: replaces FormHeader, tighter)
├── RepositoryUrlField  (redesigned: no change to props)
│   ├── input + status indicator
│   └── helper row (paste / clear / verified display)
├── PresetPills         (new: replaces LiveRepoPreview standby mode)
│   └── 3 horizontal pills with keyboard hint
├── AnimatePresence gate — reveals when repoValid:
│   ├── ProjectNameField (redesigned: animated reveal)
│   ├── ConfirmationCard (new: replaces right-rail active mode)
│   │   ├── owner/repo pill + GitHub link
│   │   └── cost ledger strip (Current → −10 → Remaining)
│   └── SubmitButton    (redesigned: inline credits + keyboard hint)
└── (no more right rail / LiveRepoPreview)
```

### Removed Components / Patterns

- `LiveRepoPreview.tsx` — replaced by `PresetPills` (idle) + `ConfirmationCard` (active)
- `CreditsGauge.tsx` — credit info moves into `ConfirmationCard` as a simple ledger strip
- `FormHeader.tsx` — replaced by leaner `PageHeader` directly in orchestrator
- `FeatureChips.tsx` — removed (pipeline detail was noise, not decision-useful info)
- `StepTimeline.tsx` — not currently used in the page; can stay in repo but not rendered

---

## States

| State | URL field | Name section | Context block | CTA |
|-------|-----------|--------------|---------------|-----|
| Empty | Unfocused, placeholder | Hidden | Hidden (presets visible below URL) | Hidden |
| Typing URL | Focused, amber ring | Hidden | Hidden (presets visible) | Hidden |
| URL valid | Valid indicator (✓ green) | Reveals (slide-in) | Reveals (repo card + ledger) | Reveals |
| URL invalid | Error indicator + message | Hidden | Hidden (presets visible) | Hidden |
| All valid | — | Filled | Confirmed | Active (amber) |
| Submitting | Disabled | Disabled | Unchanged | Loading state |
| No credits | — | — | Shows warning | Disabled |

---

## Motion Design

All animations are semantic — they communicate state change, not decoration.

| Trigger | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Input focus | Border amber transition | 120ms | ease-out |
| URL validates | Status icon fade-in (✓) | 150ms | ease-out |
| URL validates | Name field reveal: `y:8→0, opacity:0→1` | 220ms | cubic-bezier(0.16,1,0.3,1) |
| URL validates | Confirmation card reveal: same as name | 240ms | cubic-bezier(0.16,1,0.3,1) |
| URL clears/invalid | Name + confirmation fade out: `y:0→4, opacity:1→0` | 150ms | ease-in |
| Preset selected | URL field value changes instantly | — | — |
| CTA activates | Amber fill transition on button | 200ms | ease-out |
| Submitting | Spinner replaces arrow, scanline sweep | — | existing `gv-scanline-sweep` |

**No perpetual animations.** No pulsing elements in idle state. The `animate-pulse` on the green dot in the current implementation is removed.

---

## Visual Environment

- **Page background**: `#0A0B0F` (gv-void). No dot grid, no radial glow.
- **Single atmospheric texture**: A very faint `bg-grid-small-white` pattern at ~4% opacity — purely atmospheric, not a design statement.
- **Card surface**: existing `.gv-card` with standard shadow and top-light inset.
- **Container**: `max-w-[600px]` centered, comfortable left/right padding.
- **Vertical layout**: 24px gap between sections. No excessive padding.

---

## Typography

- **Breadcrumb pill**: `font-gv-mono text-[11px]` — existing pattern, unchanged
- **H1 "Add a repository"**: `font-gv-display text-3xl font-bold tracking-tight` — unchanged
- **Subtext**: `font-gv-body text-sm text-gv-fog` — 1 line max, no technical jargon
- **Field labels**: `font-gv-mono text-[11px] uppercase tracking-wider text-gv-fog` — unchanged
- **Input values**: `font-gv-mono text-sm text-gv-bone` for URL; `font-gv-body text-sm` for name
- **Helper text**: `font-gv-mono text-xs text-gv-fog/70`
- **Preset labels**: `font-gv-mono text-xs font-semibold`

---

## Copy Changes

| Element | Old | New |
|---------|-----|-----|
| H1 | "Add a repository" | "Add a repository" *(unchanged)* |
| Subtext | "Connect a public GitHub repository. GitVision will analyze its AST directory tree, index commit history..." | "Connect a public GitHub repo. GitVision indexes the commit history, code structure, and embeddings for AI-powered exploration." |
| URL label | "GitHub Repository URL" | "GitHub URL" |
| URL placeholder | `https://github.com/organization/repository` | `https://github.com/owner/repo` |
| URL helper | "Paste any public GitHub repository link to begin indexing." | "Public repositories only. Private repos are not supported." |
| Preset section | "Quick-Start Repositories / Keys [1-3] or Click" | "Try a sample →" |
| Name label | "Project Name" | "Project name" |
| Name hint | "Workspace identifier displayed across project tabs and chat." | "Used across project tabs, search, and chat." |
| CTA active | "Connect & Index Repository" | "Index Repository" |
| CTA loading | "Connecting & queueing background sync…" | "Indexing…" |

---

## Accessibility

- All inputs have `aria-label`, `aria-invalid`, and `aria-describedby` (unchanged)
- Focus ring: 2px amber at 40% opacity, 2px offset
- Error messages: red text with icon, linked to input via `aria-describedby`
- `useReducedMotion` respected for all reveals and transitions
- `role="status"` on the URL validation message for screen readers
- Keyboard: Tab order is URL → Name → CTA; Presets accessible via Enter/Space

---

## Files

### Modified

| File | Change |
|------|--------|
| `add-repo.tsx` | Layout restructure: single-column, progressive reveal. Remove LiveRepoPreview, CreditsGauge imports. |
| `components/FormHeader.tsx` | Inline into orchestrator as `PageHeader`. Tighter copy. |
| `components/RepositoryUrlField.tsx` | Keep props identical. Clean up status indicator micro-interactions. |
| `components/ProjectNameField.tsx` | No prop changes. Animated reveal handled by parent. |
| `components/SubmitButton.tsx` | Keep props. Update copy ("Index Repository"). |
| `components/BackLink.tsx` | Unchanged. |
| `app/(main)/create-project/loading.tsx` | New skeleton matching single-column layout. |

### New

| File | Purpose |
|------|---------|
| `components/PresetPills.tsx` | Horizontal preset pills. Props: `onSelectPreset`, `repoInfo` (for selected state). |
| `components/ConfirmationCard.tsx` | Repo info + cost ledger shown after URL validates. Props: `repoInfo`, `credits`. |

### Removed / Replaced

| File | Fate |
|------|------|
| `components/LiveRepoPreview.tsx` | Delete — replaced by `PresetPills` + `ConfirmationCard` |
| `components/CreditsGauge.tsx` | Delete — inline credit display in `ConfirmationCard` |
| `components/FeatureChips.tsx` | Delete — was noise |
| `components/index.ts` | Update exports |
| `components/StepTimeline.tsx` | Not rendered, can remain but unused |

---

## Verification

1. `tsc --noEmit` — no type errors
2. Dev-server compile — no build errors
3. Visual test of all 7 states listed in the States table
4. Mobile responsive at 375px and 768px breakpoints
5. `?url=` deep link still works (URL auto-populates from search param)
6. Keyboard shortcuts: `⌘↵` submits, `1/2/3` triggers presets
7. `useReducedMotion` — no animations, all states still work
8. No credit scenario — CTA shows disabled state
