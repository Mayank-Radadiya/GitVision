import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { passwordResetZodSchema } from "@/features/auth/schemas/password-reset.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { ClerkAPIError } from "@clerk/types";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import toast from "react-hot-toast";

export function useResetPasswordLogic() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<ClerkAPIError[]>();
  const [emailCode, setEmailCode] = useState("");
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const { signIn, isLoaded, setActive } = useSignIn();

  const form = useForm<z.infer<typeof passwordResetZodSchema>>({
    resolver: zodResolver(passwordResetZodSchema),
  });

  const handleVerify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(undefined);

    try {
      if (!isLoaded) {
        toast.error("Clerk is not loaded yet. Please try again.");
        return;
      }

      const completeReset = await signIn?.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: emailCode,
      });

      if (completeReset?.status === "needs_new_password") {
        toast.success(
          "Code verified successfully. Please set your new password.",
        );
      }
      setIsEmailVerified(true);
    } catch (err) {
      if (isClerkAPIResponseError(err)) {
        setError(err.errors);
      }
      toast.error("Error verifying email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (
    data: z.infer<typeof passwordResetZodSchema>,
  ) => {
    setIsLoading(true);
    setError(undefined);

    try {
      if (!isLoaded) {
        toast.error("Clerk is not loaded yet. Please try again.");
        return;
      }

      const result = await signIn?.resetPassword({
        password: data.password,
      });

      if (result?.status === "complete") {
        await setActive({ session: result.createdSessionId });
        toast.success("Password reset successful.");
        router.push("/sign-in");
      }
    } catch (err) {
      if (isClerkAPIResponseError(err)) {
        setError(err.errors);
      }
      toast.error("Error resetting password. Please try again.");
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
    error,
    emailCode,
    setEmailCode,
    isEmailVerified,
    handleVerify,
    handlePasswordReset,
  };
}
