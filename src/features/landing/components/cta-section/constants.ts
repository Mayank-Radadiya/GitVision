// Every one of these is a claim a visitor can check. "Open Source" used to
// sit in slot 0 and was false — README.md:256 records that the repository is
// private with no LICENSE file, all rights reserved — so it now says what the
// product actually does instead. The rest are paid for by
// `app/api/webhooks/clerk/route.ts:71` and `src/lib/credits.ts`.
export const TRUST_SIGNALS = [
  "Works with Public Repos",
  "No Credit Card Required",
  "AI-Powered",
  "100 Free Credits",
] as const;
