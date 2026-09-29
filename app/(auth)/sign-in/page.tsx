import SignInForm from "@/src/features/auth/components/sign-in/sign-in-form";
import { NextPage } from "next";

// The nonce-based CSP in src/lib/csp.ts is per-request, so this route
// cannot be prerendered at build time.
export const dynamic = "force-dynamic";

const Page: NextPage = ({}) => {
  return <SignInForm />;
};

export default Page;
