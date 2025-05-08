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
import { signInZodSchema } from "@/zodSchema/signIn.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { ClerkAPIError } from "@clerk/types";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSignIn } from "@clerk/nextjs";

export default function SignInForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<ClerkAPIError[]>();
  const { signIn, isLoaded, setActive } = useSignIn();

  // react hook from
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<z.infer<typeof signInZodSchema>>({
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
        setActive({ session: signInAttempt.createdSessionId });
        toast.success("Sign in successful!");
        // Redirect to the dashboard or home page
        router.push("/dashboard");
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
        <Card className="border hover:border-white/30 transition-all duration-500 shadow-xl backdrop-blur-sm bg-background/50">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold bg-gradient-to-br from-foreground via-foreground to-foreground/80 bg-clip-text text-transparent">
              Welcome back
            </CardTitle>
            <CardDescription className="text-muted-foreground/90">
              Sign in to continue to GitVision
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form className="space-y-4" onSubmit={handleSubmit(handleSignIn)}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  {...register("email")}
                  type="email"
                  placeholder="name@example.com"
                  required
                  className="h-11 bg-background/50 backdrop-blur-sm hover:border-primary/50 focus:border-primary transition-colors"
                  aria-invalid={!!errors.email}
                />
                {errors.email && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-primary hover:underline underline-offset-4"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    required
                    className="h-11 pr-10 bg-background/50 backdrop-blur-sm hover:border-primary/50 focus:border-primary transition-colors"
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

              <div id="clerk-captcha" className="mt-5" />
              <Button
                type="submit"
                disabled={isLoading}
                className="h-10 w-full rounded-md shadow-md hover:shadow-lg transition-shadow duration-300 bg-gradient-to-r from-primary to-primary/90 font-medium relative overflow-hidden group mt-4"
              >
                {/* Background shimmer effects */}
                <span className="absolute top-0 w-12 h-full bg-white/20 transform translate-x-[-100%] skew-x-[-20deg] group-hover:translate-x-[750%] transition-transform duration-2000"></span>
                <span className="absolute top-0 -left-5 w-12 h-full bg-white/20 transform translate-x-[-100%] skew-x-[-20deg] group-hover:translate-x-[350%] transition-transform duration-3000"></span>

                {/* Button content */}
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
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
                <span className="bg-background/80 px-3 text-muted-foreground backdrop-blur-sm">
                  New to GitVision?
                </span>
              </div>
            </div>

            <div className="text-sm text-center text-muted-foreground">
              Don't have an account?{" "}
              <Link
                href="/sign-up"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Create account
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
          By signing in, you agree to our{" "}
          <Link
            href="/legal/terms-of-service"
            className="font-medium text-primary underline-offset-4 hover:underline transition-colors"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/legal/privacy-policy"
            className="font-medium text-primary underline-offset-4 hover:underline transition-colors"
          >
            Privacy Policy
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
