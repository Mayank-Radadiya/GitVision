import ForgotPassword from "@/src/features/auth/components/forgot-password/forgot-password";
import { NextPage } from "next";

// The nonce-based CSP in src/lib/csp.ts is per-request, so this route
// cannot be prerendered at build time.
export const dynamic = "force-dynamic";

const Page: NextPage = () => {
  return (
    <>
      <ForgotPassword />
    </>
  );
};

export default Page;
