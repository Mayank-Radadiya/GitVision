/**
 * Settings Page — Server Component
 *
 * A layout only. Every section is a client component because each one reads
 * live account state through tRPC, and none of that is worth prefetching into
 * the RSC payload for a page most sessions open once.
 *
 * The surrounding element is a `div`, not a `main`: `app/(main)/layout.tsx`
 * already owns the page's `main` landmark, and two of them is an a11y error.
 */

import CreditsUsageSection from "@/features/user/components/settings/CreditsUsageSection";
import DangerZoneSection from "@/features/user/components/settings/DangerZoneSection";
import ProfileSection from "@/features/user/components/settings/ProfileSection";
import ThemePreferenceSection from "@/features/user/components/settings/ThemePreferenceSection";

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your account, appearance and usage.
        </p>
      </header>

      <div className="space-y-6">
        <ProfileSection />
        <ThemePreferenceSection />
        <CreditsUsageSection />
        <DangerZoneSection />
      </div>
    </div>
  );
}
