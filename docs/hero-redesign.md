# GitVision hero redesign

## Design rationale

The hero uses a clear hierarchy: announcement, a two-line display headline, repository entry, actions, real usage totals, and a product workspace. Thin borders, a faint precision grid, and one brand accent provide depth. The wide workspace demonstrates the product through code and cited answers, with syntax colors confined to that example. Mobile keeps the diff and chat readable while removing the file tree. Examples and validation share reserved space, and the scripted answer keeps its complete layout throughout the animation. Server-rendered copy stays visible before hydration; motion enhances it without gating the headline.

Headline alternatives:

- Know the code. Understand the change.
- Your codebase, explained with evidence.
- Find answers where your code lives.

## Implemented architecture

All hero files are in `src/features/landing/components/hero-section/`.

| File | Boundary and responsibility |
| --- | --- |
| `hero-section.tsx` | Server composition, section landmark, no-JavaScript streaming fallback |
| `hero-badge.tsx` | Server announcement link to `#features` |
| `hero-header.tsx` | Server headline and subheadline |
| `hero-search-form.tsx` | Client form, validation, examples, slash shortcut, navigation |
| `hero-ctas.tsx` | Client magnetic controls containing real links |
| `hero-stats.tsx` | Client hydrated tRPC counts, compact display, full accessible values |
| `hero-product-mockup.tsx` | Client demo, viewport lifecycle, pause/resume, tilt and parallax |
| `hero-background.tsx` | Client spotlight motion values and static grid/noise |
| `hero-motion.tsx` | Client LazyMotion provider, preference handling, visible entrances |
| `motion-tokens.ts` | Shared durations, easing, distances and springs |
| `normalize-repo-url.ts` | Pure typed URL normalization |
| `constants.ts` | Headline, stats labels, illustrative diff and answer |

Static copy is passed through client wrappers as server-rendered children. The headline always renders at full opacity. The existing awaited prefetch and `HydrateClient` boundary are retained.

Motion uses a 400ms entrance, 70ms stagger, 180ms headline transform, 150ms feedback, 350ms border sweep, 0.98 press scale, 6px magnetic limit, ±6° tilt, ±3px float over 6s, 20px parallax, and 600ms counts. Query characters use 30ms, answer words 45ms, citations 120ms, followed by a 3s hold and 250ms reset. Reduced motion disables movement and the demo, including when the OS preference changes after page load.

## Interfaces, dependencies, and decisions

No new dependencies, global `@theme` tokens, routes, or migrations. Hero-local CSS aliases derive from the existing theme and syntax palette.

- Both authentication states retain “Get started for free” → `/sign-up` and “See how it works” → `#features`.
- The badge links to `#features`; the trust link reuses the configured GitHub repository URL.
- Analyzer input normalizes to an HTTPS GitHub repository root before URL encoding. It rejects credentials, ports, other hosts/schemes and deep links. Valid root URL query strings/fragments are discarded.
- The approved shared-validator change permits dotted names such as `next.js`.
- The approved stats-query change counts assistant messages. The `messagesCount` field and hydration interface are unchanged.
- The demonstration is explicitly illustrative and does not call Gemini or initiate indexing.
- The create-project handoff only prefills the form. It does not submit or spend credits.
- Signed-out post-login return handling remains outside this change.

## Verification

The implementation was checked with focused Vitest coverage, ESLint, TypeScript, a production build, and the public hero Playwright suite. Tests cover URL parsing, invalid feedback, keyboard exclusions, single navigation, compact and accessible stats, zero/loading/error states, once-only counts, assistant-only aggregation, and hydration without an immediate network fetch.

Browser tests cover 375, 768, 1280 and 1920px in dark and light mode, WCAG AA rules via axe, overflow, focus rings, 44px targets, non-focusable mockup content, reduced motion, touch, mouse tilt, demo pause/resume, and the no-JavaScript fallback. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` optionally selects a locally installed Chromium browser; otherwise the suite uses Playwright's standard browser.

Final measurements and the self-review checklist are recorded below after the browser run.
