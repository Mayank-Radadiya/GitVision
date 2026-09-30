import CtaSection from "@/features/landing/components/cta-section";
import FeaturesSection from "@/features/landing/components/features-section";
import Footer from "@/features/landing/components/footer";
import HeroSection from "@/features/landing/components/hero-section";
import LandingHeader from "@/features/landing/components/landing-header";
import PricingSection from "@/features/landing/components/pricing-section";
import { prefetch, trpc, HydrateClient } from "@/src/lib/trpc/server";

// The nonce-based CSP in src/lib/csp.ts is per-request, so this route
// cannot be prerendered at build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  // The hero stats are real `COUNT(*)`s now, not literals. They have to be
  // fetched here rather than from the browser: `proxy.ts` runs `auth.protect()`
  // on the whole `/api/trpc` prefix, and a signed-out visitor on this page has
  // no session, so a client-side fetch of `getPublicStats` would be redirected
  // to sign-in instead of returning numbers. The server caller has no such
  // problem, and the landing page is already `force-dynamic`, so this costs
  // one query per request.
  //
  // Must settle before `HydrateClient` dehydrates, or `hero-stats.tsx` ships
  // an empty cache and refetches into the same wall.
  await prefetch(trpc.project.getPublicStats.queryOptions());

  return (
    <HydrateClient>
      <div className="flex min-h-screen flex-col">
        <LandingHeader />
        <main className="flex-1">
          <HeroSection />
          <FeaturesSection />
          <PricingSection />
          <CtaSection />
        </main>
        <Footer />
      </div>
    </HydrateClient>
  );
}
