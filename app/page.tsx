import CtaSection from "@/features/landing/components/cta-section";
import FeaturesSection from "@/features/landing/components/features-section";
import Footer from "@/features/landing/components/footer";
import HeroSection from "@/features/landing/components/hero-section";
import LandingHeader from "@/features/landing/components/landing-header";
import PricingSection from "@/features/landing/components/pricing-section";

export default function Home() {
  return (
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
  );
}
