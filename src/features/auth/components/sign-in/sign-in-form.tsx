"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Image from "next/image";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useSignInLogic } from "@/src/features/auth/components/sign-in/use-signIn";

export default function SignInForm() {
  const {
    form,
    isLoading,
    showPassword,
    setShowPassword,
    error,
    handleSignIn,
    handleGoogleSignIn,
  } = useSignInLogic();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  return (
    <div className="relative z-10 flex w-full flex-col px-4 sm:px-0">
      <div className="group perspective-1000 relative">
        {/* Deep layered background offsets */}
        <div className="from-primary/30 to-background absolute -inset-1.5 rounded-none bg-linear-to-br opacity-50 blur-sm transition duration-700 group-hover:opacity-100" />
        <div className="bg-primary/10 border-primary/20 absolute inset-0 translate-x-2 translate-y-2 border" />

        <Card className="border-border/50 bg-background/95 transform-style-3d relative rounded-none shadow-2xl backdrop-blur-xl transition-all duration-500 group-hover:-translate-x-1 group-hover:-translate-y-1 sm:p-6">
          {/* Accent line */}
          <div className="from-primary/80 via-primary/40 absolute inset-x-0 top-0 h-0.5 bg-linear-to-r to-transparent" />

          <CardHeader className="space-y-3 pt-4 pb-8 text-left">
            <CardTitle className="text-foreground selection:bg-primary/30 text-3xl font-bold tracking-tighter">
              Welcome back
            </CardTitle>
            <CardDescription className="text-muted-foreground/80 text-sm font-medium tracking-widest uppercase">
              Sign in to GitVision
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button
              type="button"
              variant="outline"
              className="bg-background/50 hover:bg-muted/80 border-border/60 hover:border-primary/50 text-foreground group/btn relative h-12 w-full cursor-pointer overflow-hidden rounded-none border font-semibold transition-all duration-300"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              <div className="from-primary/0 via-primary/5 to-primary/0 absolute inset-0 -translate-x-full bg-linear-to-r transition-transform duration-1000 group-hover/btn:translate-x-full" />
              <Image
                src="/Google.svg"
                alt="Google"
                width={18}
                height={18}
                className="mr-3"
              />
              Continue with Google
            </Button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="border-border/40 dashed w-full border-t" />
              </div>
              <div className="relative flex justify-center text-[10px] font-bold tracking-[0.2em] uppercase">
                <span className="bg-background text-muted-foreground/60 px-4">
                  Or continue with email
                </span>
              </div>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit(handleSignIn)}>
              <div className="group/input space-y-2">
                <Label
                  htmlFor="email"
                  className="text-foreground/80 group-focus-within/input:text-primary cursor-pointer text-[11px] font-bold tracking-wider uppercase transition-colors"
                >
                  Email address
                </Label>
                <Input
                  id="email"
                  {...register("email")}
                  type="email"
                  placeholder="name@example.com"
                  required
                  disabled={isLoading}
                  className="bg-background/40 focus-visible:border-primary/60 border-border/40 placeholder:text-muted-foreground/30 h-12 rounded-none border font-medium shadow-inner transition-all focus-visible:ring-0"
                  aria-invalid={!!errors.email}
                />
                {errors.email && (
                  <p className="text-destructive mt-1.5 flex items-center gap-1.5 text-[11px] font-medium">
                    <span className="bg-destructive h-1 w-1 rounded-none" />{" "}
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div className="group/input space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="password"
                    className="text-foreground/80 group-focus-within/input:text-primary cursor-pointer text-[11px] font-bold tracking-wider uppercase transition-colors"
                  >
                    Password
                  </Label>
                  <Link
                    href="/forgot-password"
                    className="text-muted-foreground/80 hover:text-primary cursor-pointer text-[11px] font-semibold tracking-wide transition-colors duration-200"
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
                    disabled={isLoading}
                    className="bg-background/40 focus-visible:border-primary/60 border-border/40 h-12 rounded-none border pr-10 font-medium shadow-inner transition-all focus-visible:ring-0"
                    aria-invalid={!!errors.password}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground absolute top-0 right-0 h-12 w-12 cursor-pointer rounded-none bg-transparent hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {errors.password && (
                  <p className="text-destructive mt-1.5 flex items-center gap-1.5 text-[11px] font-medium">
                    <span className="bg-destructive h-1 w-1 rounded-none" />{" "}
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div id="clerk-captcha" />
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground mt-4 h-12 w-full cursor-pointer rounded-none text-[11px] font-bold tracking-widest uppercase shadow-[4px_4px_0_hsl(var(--primary)/0.2)] transition-all duration-300 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating
                  </>
                ) : (
                  "Sign In to Workspace"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="border-border/10 mt-2 flex justify-center border-t pt-4 pb-2">
            <div className="text-muted-foreground/80 text-xs font-medium tracking-wide">
              Don&apos;t have an account?{" "}
              <Link
                href="/sign-up"
                className="text-foreground hover:text-primary decoration-border hover:decoration-primary cursor-pointer font-semibold underline underline-offset-4 transition-colors hover:underline-offset-6"
              >
                Create account
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="border-destructive/30 bg-destructive/5 relative mt-8 overflow-hidden rounded-none border p-4 shadow-[4px_4px_0_rgba(239,68,68,0.1)]"
        >
          <div className="bg-destructive absolute top-0 left-0 h-full w-1" />
          <h3 className="text-destructive pl-2 text-[11px] font-bold tracking-wider uppercase">
            Authentication Error
          </h3>
          <div className="mt-2 space-y-1 pl-2">
            {error.map((el, index) => (
              <div
                key={index}
                className="text-destructive/90 flex items-start gap-2 text-xs font-medium"
              >
                <span className="mt-1 text-[8px] opacity-70">◆</span>{" "}
                {el.longMessage}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
