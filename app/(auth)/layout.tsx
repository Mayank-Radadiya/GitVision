"use client";
import { Loader } from "@/shared/components/feedback/loader";
import AuthLayout from "@/src/features/auth/components/authLayout";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const { isLoaded, user } = useUser();

  useEffect(() => {
    if (isLoaded && user) {
      router.push("/dashboard");
    }
  }, [isLoaded, user, router]);

  if (!isLoaded) return <Loader />; // optional: show a loader

  return (
    <>
      <AuthLayout>{children}</AuthLayout>
    </>
  );
}
