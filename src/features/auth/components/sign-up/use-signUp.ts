import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signUpZodSchema } from "@/features/auth/schemas/sign-up.schema";
import { ClerkAPIError } from "@clerk/types";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import toast from "react-hot-toast";

export function useSignUpLogic() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [error, setError] = useState<ClerkAPIError[]>();
  const [emailCode, setEmailCode] = useState("");
  const { signUp, isLoaded, setActive } = useSignUp();

  const form = useForm<z.infer<typeof signUpZodSchema>>({
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
    resolver: zodResolver(signUpZodSchema),
  });

  const handleSignUp = async (data: z.infer<typeof signUpZodSchema>) => {
    if (!isLoaded) return;

    const { email, password } = data;
    if (!email && !password) {
      toast.error("Something went wrong. Please try again.");
      return;
    }

    try {
      setIsLoading(true);
      await signUp.create({
        emailAddress: email,
        password,
      });

      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });

      toast.success("Verification email sent. Please check your inbox.");
      setVerifying(true);
    } catch (error) {
      if (isClerkAPIResponseError(error)) setError(error.errors);
      toast.error("Error during sign up. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    if (!isLoaded) return;
    setIsLoading(true);
    signUp.authenticateWithRedirect({
      strategy: "oauth_google",
      redirectUrl: "/sso-callback",
      redirectUrlComplete: "/dashboard",
    });

    setIsLoading(false);
  };

  const handleVerify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    if (!isLoaded) return;
    try {
      const result = await signUp?.attemptEmailAddressVerification({
        code: emailCode,
      });

      if (result?.status === "complete") {
        await setActive({ session: result.createdSessionId });
        toast.success("Email verified successfully.");
        setVerifying(false);
        router.push("/dashboard");
      }
    } catch (error) {
      if (isClerkAPIResponseError(error)) setError(error.errors);
      toast.error(
        "Error during verification. Please try again sign-up process.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return {
    form,
    isLoading,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    verifying,
    error,
    emailCode,
    setEmailCode,
    handleSignUp,
    handleGoogleSignUp,
    handleVerify,
  };
}
