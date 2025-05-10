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
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signUpZodSchema } from "@/zodSchema/signUp.schema";
import VerifyEmail from "./verify-email";
import { ClerkAPIError } from "@clerk/types";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import toast from "react-hot-toast";

export default function SignUpForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [error, setError] = useState<ClerkAPIError[]>();
  const [emailCode, setEmailCode] = useState(["", "", "", "", "", ""]);
  const { signUp, isLoaded, setActive } = useSignUp();

  // Form
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof signUpZodSchema>>({
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

  const handleVerify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    if (!isLoaded) return;
    try {
      const result = await signUp?.attemptEmailAddressVerification({
        code: emailCode.join(""),
      });

      if (result?.status === "complete") {
        toast.success("Email verified successfully.");
        await setActive({ session: result.createdSessionId });
      }

      router.push("/dashboard");
    } catch (error) {
      if (isClerkAPIResponseError(error)) setError(error.errors);
      toast.error(
        "Error during verification. Please try again sign-up process."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {!verifying ? (
        <>
          <div className="flex min-h-screen flex-col items-center justify-center bg-background relative overflow-hidden">
            {/* Subtle gradient overlays */}
            <div className="absolute inset-0 bg-grid-small-black/[0.2] dark:bg-grid-small-white/[0.05]"></div>
            <div className="absolute inset-0 bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
            <div className="absolute -left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px] dark:bg-primary/10"></div>
            <div className="absolute -right-1/4 bottom-0 h-[500px] w-[500px] rounded-full bg-purple-500/5 blur-[120px] dark:bg-purple-500/10"></div>
            <div className="absolute left-1/3 bottom-0 h-[300px] w-[300px] rounded-full bg-blue-500/5 blur-[80px] dark:bg-blue-500/10"></div>

            <div className="absolute right-4 top-4 flex items-center gap-2 z-10">
              <CustomToggleButton />
            </div>

            <Link
              href="/"
              className="absolute left-4 top-4 flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground z-10"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Link>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-6 z-10"
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
              <Card className="border border-border/30 hover:border-white/40 shadow-xl  backdrop-blur-sm duration-500 transition-all  bg-background/50">
                <CardHeader className="space-y-1 pb-6">
                  <CardTitle className="text-2xl font-bold">
                    Create an account
                  </CardTitle>
                  <CardDescription className="text-muted-foreground/90">
                    Enter your information to get started
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <form
                    className="space-y-4"
                    onSubmit={handleSubmit(handleSignUp)}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        {...register("email")}
                        placeholder="name@example.com"
                        required
                        className="h-11 mt-1.5"
                      />
                      {errors.email?.message && (
                        <p className="text-sm text-red-400 mt-1">
                          {errors.email.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input
                          {...register("password")}
                          id="password"
                          type={showPassword ? "text" : "password"}
                          required
                          className="h-11 pr-10 mt-1.5"
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
                      {errors.password?.message && (
                        <p className="text-sm text-red-400 mt-1">
                          {errors.password.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm Password</Label>
                      <div className="relative">
                        <Input
                          {...register("confirmPassword")}
                          id="confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          required
                          className="h-11 pr-10 mt-1.5"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-11 w-11"
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                          <span className="sr-only">
                            {showConfirmPassword
                              ? "Hide password"
                              : "Show password"}
                          </span>
                        </Button>
                      </div>
                      {errors.confirmPassword?.message && (
                        <p className="text-sm text-red-400 mt-1">
                          {errors.confirmPassword.message}
                        </p>
                      )}
                    </div>
                    {/* This is required for Smart CAPTCHA */}
                    <div id="clerk-captcha" className="mt-5" />
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="relative w-full h-10 overflow-hidden bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white group mt-4"
                    >
                      {/* Background shimmer effects */}
                      <span className="absolute top-0  w-12 h-full bg-white/20 transform translate-x-[-100%] skew-x-[-20deg] group-hover:translate-x-[650%] transition-transform duration-1500"></span>

                      <span className="absolute top-0 -left-10  w-12 h-full bg-white/20 transform translate-x-[-100%] skew-x-[-20deg] group-hover:translate-x-[350%] transition-transform duration-1000"></span>

                      {/* Button content */}
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        "Sign Up"
                      )}
                    </Button>
                  </form>
                </CardContent>
                <CardFooter className="flex flex-col space-y-4 pt-0">
                  <div className="relative w-full">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border/50"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-card px-3 text-muted-foreground">
                        Already have an account?
                      </span>
                    </div>
                  </div>

                  <div className="text-sm text-center text-muted-foreground">
                    Already have an account?{" "}
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
                  className="mt-4 p-4 rounded-xl border border-destructive/30 dark:border-destructive/40 backdrop-blur-md bg-destructive/10 dark:bg-destructive/20/30 shadow-sm"
                >
                  <h3 className="text-sm font-semibold text-destructive dark:text-destructive/90">
                    Sign In Error:
                  </h3>
                  <div className="mt-2 space-y-1 list-disc list-inside">
                    {error.map((el, index) => (
                      <div
                        key={index}
                        className="text-sm text-destructive/80 dark:text-destructive/80"
                      >
                        {el.longMessage}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              <p className="text-center text-xs text-muted-foreground mt-6">
                By signing up, you agree to our{" "}
                <Link
                  href="/legal/terms-of-service"
                  className="underline underline-offset-4 hover:text-primary"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/legal/privacy-policy"
                  className="underline underline-offset-4 hover:text-primary"
                >
                  Privacy Policy
                </Link>
              </p>
            </motion.div>
            {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-4 p-4 rounded-xl border border-destructive/30 dark:border-destructive/40 backdrop-blur-md bg-destructive/10 dark:bg-destructive/20/30 shadow-sm"
          >
            <h3 className="text-sm font-semibold text-destructive dark:text-destructive/90">
              Sign In Error:
            </h3>
            <div className="mt-2 space-y-1 list-disc list-inside">
              {error.map((el, index) => (
                <div
                  key={index}
                  className="text-sm text-destructive/80 dark:text-destructive/80"
                >
                  {el.longMessage}
                </div>
              ))}
            </div>
          </motion.div>
        )}
          </div>
        </>
      ) : (
        <>
          <VerifyEmail
            emailCode={emailCode}
            setEmailCode={setEmailCode}
            handleVerify={handleVerify}
            isLoading={isLoading}
            error={error}
          />
        </>
      )}
    </>
  );
}
