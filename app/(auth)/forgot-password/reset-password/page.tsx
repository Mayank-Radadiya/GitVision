import ResetPassword from "@/src/features/auth/components/reset-password/reset-password";

// The nonce-based CSP in src/lib/csp.ts is per-request, so this route
// cannot be prerendered at build time.
export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return <ResetPassword />;
}
