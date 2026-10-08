import { HeroBackground } from "./hero-background";
import { HeroBadge } from "./hero-badge";
import { HeroHeader } from "./hero-header";
import { HeroSearchForm } from "./hero-search-form";
import { HeroCtas } from "./hero-ctas";
import { HeroStats } from "./hero-stats";
import { HeroProductMockup } from "./hero-product-mockup";
import { HeroMotionProvider } from "./hero-motion";

export default function HeroSection() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="gitvision-hero bg-background text-foreground relative isolate overflow-hidden pt-24 pb-16 sm:pt-28 sm:pb-24"
    >
      {/* The awaited stats query is streamed behind the existing route loader.
          Reveal its completed HTML when React cannot run the stream handoff. */}
      <noscript>
        <style>{`
          @layer base { [hidden]:has(.gitvision-hero) { display: contents !important; } }
          body:has(.gitvision-hero) [data-route-loading] { display: none !important; }
        `}</style>
      </noscript>
      <HeroMotionProvider>
        <HeroBackground />
        <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-6">
          <div className="text-center">
            <HeroBadge />
            <HeroHeader />
            <HeroSearchForm />
            <HeroCtas />
            <HeroStats />
          </div>
          <HeroProductMockup />
        </div>
      </HeroMotionProvider>
    </section>
  );
}
