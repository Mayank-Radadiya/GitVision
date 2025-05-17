"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "../ui/label";
import CustomToggleButton from "../custom/mode-toggle";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { passwordResetZodSchema } from "@/zodSchema/passwordReset.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { ClerkAPIError } from "@clerk/types";
import { useRouter } from "next/navigation";

import { useSignIn } from "@clerk/nextjs";
import VerifyEmail from "./verify-email";
import toast from "react-hot-toast";

export default function ResetPassword() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<ClerkAPIError[]>();
  const [emailCode, setEmailCode] = useState<string[]>([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const { signIn, isLoaded, setActive } = useSignIn();

  // Form validation
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<z.infer<typeof passwordResetZodSchema>>({
    resolver: zodResolver(passwordResetZodSchema),
  });

  // Handle email verification
  const handleVerify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(undefined);

    try {
      if (!isLoaded) {
        toast.error("Clerk is not loaded yet. Please try again.");
        return;
      }

      const code = emailCode.join("");

      const completeReset = await signIn?.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
      });

      if (completeReset?.status === "needs_new_password") {
        toast.success(
          "Code verified successfully. Please set your new password."
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

  // Handle password reset
  const handlePasswordReset = async (
    data: z.infer<typeof passwordResetZodSchema>
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

  // If not verified yet, show email verification screen
  if (!isEmailVerified) {
    return (
      <VerifyEmail
        emailCode={emailCode}
        setEmailCode={setEmailCode}
        handleVerify={handleVerify}
        isLoading={isLoading}
        error={error}
      />
    );
  }

  // Otherwise, show password reset form
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid-small-black/[0.2] dark:bg-grid-small-white/[0.05]"></div>
      <div className="absolute inset-0 bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
      <div className="absolute -left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px] dark:bg-primary/10"></div>
      <div className="absolute -right-1/4 bottom-0 h-[500px] w-[500px] rounded-full bg-purple-500/5 blur-[120px] dark:bg-purple-500/10"></div>
      <div className="absolute left-1/3 bottom-0 h-[300px] w-[300px] rounded-full bg-blue-500/5 blur-[80px] dark:bg-blue-500/10"></div>

      <div className="absolute right-4 top-4 flex items-center gap-2 z-10">
        <CustomToggleButton />
      </div>

      <Link
        href="/sign-in"
        className="absolute left-4 top-4 flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground z-10"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to sign in</span>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 z-10"
      >
        <Link
          href="/"
          className="group flex items-center gap-3 transition-all duration-300"
        >
          <div className="relative flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-background via-background to-background ring-1 ring-primary/20 backdrop-blur-sm overflow-hidden shadow-lg transition-all duration-300 group-hover:shadow-primary/10">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-80"></div>
            <Image
              src={"/Github.svg"}
              alt="Logo"
              width={36}
              height={36}
              className="relative z-10 transition-transform duration-300 group-hover:scale-110"
            />
          </div>
          <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
            Git<span className="text-primary">Vision</span>
          </span>
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="border-none shadow-xl backdrop-blur-sm bg-background/80">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold bg-gradient-to-br from-foreground via-foreground to-foreground/80 bg-clip-text text-transparent">
              Reset your password
            </CardTitle>
            <CardDescription className="text-muted-foreground/90">
              Enter a new password for your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form
              className="space-y-4"
              onSubmit={handleSubmit(handlePasswordReset)}
            >
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    required
                    className="h-11 pr-10 bg-background/50 backdrop-blur-sm hover:border-primary/50 focus:border-primary transition-colors mt-1.5"
                    aria-invalid={!!errors.password}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-11 w-11"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    <span className="sr-only">
                      {showPassword ? "Hide password" : "Show password"}
                    </span>
                  </Button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    {...register("confirmPassword")}
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    required
                    className="h-11 pr-10 bg-background/50 backdrop-blur-sm hover:border-primary/50 focus:border-primary transition-colors mt-1.5"
                    aria-invalid={!!errors.confirmPassword}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-11 w-11"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    <span className="sr-only">
                      {showConfirmPassword ? "Hide password" : "Show password"}
                    </span>
                  </Button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="h-11 w-full rounded-md shadow-md hover:shadow-lg transition-shadow duration-300 bg-gradient-to-r from-primary to-primary/90 font-medium relative overflow-hidden group mt-4"
              >
                {/* Background shimmer effects */}
                <span className="absolute top-0 w-12 h-full bg-white/20 transform translate-x-[-100%] skew-x-[-20deg] group-hover:translate-x-[750%] transition-transform duration-2000"></span>
                <span className="absolute top-0 -left-5 w-12 h-full bg-white/20 transform translate-x-[-100%] skew-x-[-20deg] group-hover:translate-x-[350%] transition-transform duration-3000"></span>

                {/* Button content */}
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="text-sm text-center text-muted-foreground">
              Remember your password?{" "}
              <Link
                href="/sign-in"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </div>
          </CardFooter>
        </Card>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-4 p-4 rounded-xl border bg-destructive/10 dark:bg-destructive/20 border-destructive/30 dark:border-destructive/40"
          >
            <h3 className="text-sm font-semibold text-destructive dark:text-destructive/90">
              Password Reset Error:
            </h3>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              {error.map((el, index) => (
                <li
                  key={index}
                  className="text-sm text-destructive/80 dark:text-destructive/80"
                >
                  {el.longMessage}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
