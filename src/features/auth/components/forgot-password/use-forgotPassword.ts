import { useRef, useState } from "react";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { ClerkAPIError } from "@clerk/types";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs/legacy";
import toast from "react-hot-toast";

export function useForgotPasswordLogic() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ClerkAPIError[]>();
  const { signIn, isLoaded } = useSignIn();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(undefined);

    try {
      if (!isLoaded) {
        toast.error("Clerk is not loaded yet. Please try again.");
        return;
      }

      const email = emailRef.current?.value;
      if (!email) {
        toast.error("Please enter a valid email address.");
        return;
      }

      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });

      toast.success("Code sent to your email. Please check your inbox.");
      router.push("/forgot-password/reset-password");
    } catch (err) {
      if (isClerkAPIResponseError(err)) {
        setError(err.errors);
        toast.error(err.errors[0]?.longMessage || "Error sending reset email");
      } else {
        toast.error("Error sending reset email. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    emailRef,
    isLoading,
    error,
    handleSubmit,
  };
}
