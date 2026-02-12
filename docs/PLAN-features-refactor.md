# Features Section — Structural Refactor Plan

Decompose `features-section.tsx` (229 lines) into a folder structure matching the `hero-section/` and `landing-header/` patterns.

## Proposed Structure

```
features-section/
├── index.ts                    # Re-export
├── features-section.tsx        # Orchestrator (~40 lines)
├── features-header.tsx         # Section header (pill + headline + subtitle)
├── features-grid.tsx           # Bento grid rendering + cards
├── feature-card.tsx            # Individual feature card component
├── commit-visual.tsx           # Git diff visual for large cards
├── constants.ts                # Feature data array
└── variants.ts                 # containerVariants, itemVariants
```

## File Responsibilities

| File                   | Lines | Responsibility                                                       |
| ---------------------- | ----- | -------------------------------------------------------------------- |
| `index.ts`             | 1     | Re-export default                                                    |
| `features-section.tsx` | ~35   | `useRef` + `useInView`, composes children, background + ambient orbs |
| `features-header.tsx`  | ~35   | Announcement pill, headline, subtitle — pure presentational          |
| `features-grid.tsx`    | ~30   | Maps features → `FeatureCard`, bottom tagline                        |
| `feature-card.tsx`     | ~40   | Single card with icon, title, arrow, description, optional visual    |
| `commit-visual.tsx`    | ~25   | Git diff mockup JSX (extracted from inline data)                     |
| `constants.ts`         | ~50   | Feature data array with icons, colors, size                          |
| `variants.ts`          | ~15   | `containerVariants`, `itemVariants`                                  |

## Import Path

`app/page.tsx` imports `@/features/landing/components/features-section` → `index.ts` re-export keeps this stable.

## Verification

1. `npx tsc --noEmit` — zero new errors
2. Visual render identical on `localhost:3000/#features`
