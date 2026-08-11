# Create Project Page — Premium Polish Design

**Date:** 2026-08-11
**Scope:** `app/(main)/create-project` — the "Add Repository" form (`src/features/projects/components/create-project/`)
**Approved:** Full-restraint motion pass

## Direction

The page keeps its GitVision DNA — the living git graph signature, terminal echo,
commit-step timeline, contribution-square credits — but is refined toward the
restraint of Linear/Vercel/Stripe. Motion is reserved for meaning. Amber becomes a
signal color rather than a fill used on every border and icon.

## Decisions

1. **Surface hierarchy.** Shared `.gv-card` utility in `globals.css`:
   page `#0A0B0F` → card `#14161F` with 1px inset top-light → inner cells `#1D2029`.
   Form card and right-rail panels all use it, replacing ad-hoc `bg-*/backdrop-blur`
   combinations.
2. **Typography.** H1 moves from `font-gv-mono` to `font-gv-display` (Bricolage
   Grotesque, already loaded), 28–32px/600, tight tracking. Headline copy becomes
   "Add a repository". Mono stays reserved for brows, labels, steps, URLs, data.
   Subhead becomes IBM Plex Sans 15px at ~52ch.
3. **Motion — full restraint.**
   - Remove the per-keystroke typewriter (retypes whole string at 33ms/char).
     Replace with a resolved terse echo (`git remote get-url origin → owner/repo`)
     that fades in once parsed; a blinking cursor shows only while parsing.
   - Remove `.gv-drift` (whole-canvas 8s float) from the background graph; drop
     desktop graph opacity 100% → ~70%, soften strokes.
   - Keep semantic moments: live branch draws when a project name is typed; ghost
     node + dashed wire when the URL parses; merge pulse + particles on submit;
     one-shot node pulse on validation.
   - Replace StepTimeline's perpetual `gv-head-pulse` with a crisp static halo.
4. **Form composition.** Inputs 44px tall, soft 3px focus ring (amber), raised cell
   surface. Precise disabled CTA. Fix missing `group` on SubmitButton so the arrow
   nudge works. `.gv-cta` transition gains `transform`.
5. **Right rail.** Analysis Target + Presets use `.gv-card`; status dot color is
   conditional on readiness; FeatureChips become a hairline "spec sheet" list.
6. **Loading state.** Branded quiet skeleton (dark page + form-card skeleton)
   instead of the generic loader.

## Not changed

7/5 column split, palette (ink-950/900/800, amber, moss, ember, wire), fonts,
ghost-node signature, copy meaning, interaction flow, validation schema.

## Files

- `app/globals.css` — `.gv-card`, `.gv-card` sheen, CTA transition tweak
- `src/features/projects/components/create-project/` — orchestrator + 11 components
- `app/(main)/create-project/loading.tsx` — branded skeleton

## Verification

`tsc --noEmit`, dev-server compile, and visual review of the four key states
(empty, typed name, valid URL, submitting).