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
  // fetched here for the initial HTML. `proxy.ts` also allowlists the exact
  // public stats endpoint, so signed-out visitors can refetch when stale.
  // The landing page is already `force-dynamic`: one query per request.
  //
  // Must settle before `HydrateClient` dehydrates, or `hero-stats.tsx` ships
  // an empty cache and needs another request for the first numbers.
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
