import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { signInZodSchema } from "@/features/auth/schemas/sign-in.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { ClerkAPIError } from "@clerk/types";
import { useSignIn } from "@clerk/nextjs/legacy";
import toast from "react-hot-toast";

export function useSignInLogic() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<ClerkAPIError[]>();
  const { signIn, isLoaded, setActive } = useSignIn();

  const form = useForm<z.infer<typeof signInZodSchema>>({
    resolver: zodResolver(signInZodSchema),
  });

  const handleSignIn = async (data: z.infer<typeof signInZodSchema>) => {
    setIsLoading(true);
    setError(undefined);

    if (!isLoaded) {
      toast.error("Clerk is not loaded yet. Please try again.");
      return;
    }

    try {
      const { email, password } = data;
      const signInAttempt = await signIn.create({
        identifier: email,
        password,
      });

      if (signInAttempt.status === "complete") {
        await setActive({ session: signInAttempt.createdSessionId });
        toast.success("Sign in successful!");
      } else {
        console.error(JSON.stringify(signInAttempt, null, 2));
        toast.error("Invalid credentials. Please try again.");
      }
    } catch (err) {
      if (isClerkAPIResponseError(err)) setError(err.errors);
      toast.error("Error signing in. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isLoaded || !signIn) {
      toast.error("Clerk is loading. Please try again in a moment.");
      return;
    }
    setIsLoading(true);
    setError(undefined);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/dashboard",
      });
    } catch (err) {
      console.error("Error signing in with Google:", err);
      if (isClerkAPIResponseError(err)) setError(err.errors);
      toast.error("Error signing in with Google. Please try again.");
      setIsLoading(false);
    }
  };

  return {
    form,
    isLoading,
    showPassword,
    setShowPassword,
    error,
    handleSignIn,
    handleGoogleSignIn,
  };
}
