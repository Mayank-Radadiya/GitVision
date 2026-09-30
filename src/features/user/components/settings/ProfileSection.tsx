"use client";

/**
 * Profile & Accounts.
 *
 * Everything identity-related is Clerk's job — email verification, password,
 * OAuth connections, MFA — so this section is the vendor component rather than
 * a reimplementation. `routing="hash"` keeps it on `/settings` instead of
 * routing to Clerk's hosted pages.
 */

import { UserProfile } from "@clerk/nextjs";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

export default function ProfileSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile &amp; Accounts</CardTitle>
        <CardDescription>
          Your name, email, password and connected sign-in methods.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <UserProfile routing="hash" />
      </CardContent>
    </Card>
  );
}
