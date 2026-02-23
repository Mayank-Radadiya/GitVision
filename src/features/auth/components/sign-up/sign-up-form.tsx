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
import dynamic from "next/dynamic";
import { Loader } from "@/shared/components/feedback/loader";
import { useSignUpLogic } from "@/src/features/auth/components/sign-up/use-signUp";

const VerifyEmail = dynamic(() => import("../verify-email/verify-email"), {
  loading: () => <Loader />,
});

export default function SignUpForm() {
  const {
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
  } = useSignUpLogic();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  return (
    <>
      {!verifying ? (
        <div className="flex w-full flex-col relative z-10 px-4 sm:px-0">
          <div className="relative group perspective-1000">
            {/* Deep layered background offsets */}
            <div className="absolute -inset-1.5 bg-gradient-to-br from-primary/30 to-background rounded-none blur-sm opacity-50 group-hover:opacity-100 transition duration-700" />
            <div className="absolute inset-0 bg-primary/10 translate-x-2 translate-y-2 border border-primary/20" />

            <Card className="relative border border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl sm:p-6 transition-all duration-500 rounded-none transform-style-3d group-hover:-translate-y-1 group-hover:-translate-x-1">
              {/* Accent line */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary/80 via-primary/40 to-transparent" />

              <CardHeader className="space-y-3 pb-8 text-left pt-4">
                <CardTitle className="text-3xl font-bold tracking-tighter text-foreground selection:bg-primary/30">
                  Create an account
                </CardTitle>
                <CardDescription className="text-muted-foreground/80 text-sm font-medium tracking-widest uppercase">
                  Enter your information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 bg-background/50 hover:bg-muted/80 border border-border/60 hover:border-primary/50 transition-all duration-300 font-semibold text-foreground relative overflow-hidden rounded-none cursor-pointer group/btn"
                  onClick={handleGoogleSignUp}
                  disabled={isLoading}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000" />
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
                    <span className="w-full border-t border-border/40 dashed" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em] font-bold">
                    <span className="bg-background px-4 text-muted-foreground/60">
                      Or continue with email
                    </span>
                  </div>
                </div>

                <form
                  className="space-y-5"
                  onSubmit={handleSubmit(handleSignUp)}
                >
                  <div className="space-y-2 group/input">
                    <Label
                      htmlFor="email"
                      className="text-foreground/80 font-bold text-[11px] uppercase tracking-wider group-focus-within/input:text-primary transition-colors cursor-pointer"
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
                      className="h-12 bg-background/40 focus-visible:ring-0 focus-visible:border-primary/60 border border-border/40 transition-all placeholder:text-muted-foreground/30 font-medium rounded-none shadow-inner"
                      aria-invalid={!!errors.email}
                    />
                    {errors.email?.message && (
                      <p className="text-[11px] font-medium text-destructive mt-1.5 flex items-center gap-1.5">
                        <span className="w-1 h-1 bg-destructive rounded-none" />{" "}
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 group/input">
                    <Label
                      htmlFor="password"
                      className="text-foreground/80 font-bold text-[11px] uppercase tracking-wider group-focus-within/input:text-primary transition-colors cursor-pointer"
                    >
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        {...register("password")}
                        type={showPassword ? "text" : "password"}
                        required
                        disabled={isLoading}
                        className="h-12 pr-10 bg-background/40 focus-visible:ring-0 focus-visible:border-primary/60 border border-border/40 transition-all font-medium rounded-none shadow-inner"
                        aria-invalid={!!errors.password}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-12 w-12 rounded-none text-muted-foreground hover:text-foreground bg-transparent hover:bg-transparent cursor-pointer"
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
                      <p className="text-[11px] font-medium text-destructive mt-1.5 flex items-center gap-1.5">
                        <span className="w-1 h-1 bg-destructive rounded-none" />{" "}
                        {errors.password.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 group/input">
                    <Label
                      htmlFor="confirm-password"
                      className="text-foreground/80 font-bold text-[11px] uppercase tracking-wider group-focus-within/input:text-primary transition-colors cursor-pointer"
                    >
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        {...register("confirmPassword")}
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        disabled={isLoading}
                        className="h-12 pr-10 bg-background/40 focus-visible:ring-0 focus-visible:border-primary/60 border border-border/40 transition-all font-medium rounded-none shadow-inner"
                        aria-invalid={!!errors.confirmPassword}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-12 w-12 rounded-none text-muted-foreground hover:text-foreground bg-transparent hover:bg-transparent cursor-pointer"
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
                      <p className="text-[11px] font-medium text-destructive mt-1.5 flex items-center gap-1.5">
                        <span className="w-1 h-1 bg-destructive rounded-none" />{" "}
                        {errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  <div id="clerk-captcha" className="mt-5" />

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="h-12 mt-4 rounded-none w-full font-bold uppercase tracking-widest text-[11px] transition-all duration-300 bg-primary hover:bg-primary/90 text-primary-foreground shadow-[4px_4px_0_hsl(var(--primary)/0.2)] hover:shadow-none hover:translate-y-1 hover:translate-x-1 cursor-pointer text-white"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account
                      </>
                    ) : (
                      "Sign Up"
                    )}
                  </Button>
                </form>
              </CardContent>
              <CardFooter className="flex justify-center pb-2 pt-4 border-t border-border/10 mt-2">
                <div className="text-xs font-medium text-muted-foreground/80 tracking-wide">
                  Already have an account?{" "}
                  <Link
                    href="/sign-in"
                    className="text-foreground font-semibold hover:text-primary transition-colors underline decoration-border hover:decoration-primary cursor-pointer underline-offset-4"
                  >
                    Sign in
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
              className="mt-8 p-4 border border-destructive/30 bg-destructive/5 shadow-[4px_4px_0_rgba(239,68,68,0.1)] rounded-none relative overflow-hidden"
            >
              <div className="absolute left-0 top-0 w-1 h-full bg-destructive" />
              <h3 className="text-[11px] uppercase tracking-wider font-bold text-destructive pl-2">
                Sign Up Error
              </h3>
              <div className="mt-2 space-y-1 pl-2">
                {error.map((el, index) => (
                  <div
                    key={index}
                    className="text-xs font-medium text-destructive/90 flex items-start gap-2"
                  >
                    <span className="mt-1 text-[8px] opacity-70">◆</span>{" "}
                    {el.longMessage}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      ) : (
        <VerifyEmail
          emailCode={emailCode}
          setEmailCode={setEmailCode}
          handleVerify={handleVerify}
          isLoading={isLoading}
          error={error}
        />
      )}
    </>
  );
}
