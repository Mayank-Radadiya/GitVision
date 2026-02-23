"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
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
import CustomToggleButton from "@/shared/components/theme/mode-toggle";
import VerifyEmail from "../verify-email/verify-email";
import { useResetPasswordLogic } from "./use-resetPassword";

export default function ResetPassword() {
  const {
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
  } = useResetPasswordLogic();

  const {
    handleSubmit,
    register,
    formState: { errors },
  } = form;

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
    <div className="flex w-full flex-col items-center justify-center relative z-10 px-4 sm:px-0 mt-8 mb-8 md:mt-16">
      <div className="absolute right-4 top-4 flex items-center gap-2 z-10">
        <CustomToggleButton />
      </div>

      <Link
        href="/sign-in"
        className="absolute left-4 top-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 transition-colors hover:text-primary z-10"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to sign in</span>
      </Link>

      <div className="mb-8 z-10">
        <Link
          href="/"
          className="group flex items-center gap-3 transition-all duration-300"
        >
          <div className="relative flex h-12 w-12 items-center justify-center rounded-none bg-background ring-1 ring-border shadow-lg transition-all duration-300 group-hover:ring-primary/50">
            <Image
              src={"/Github.svg"}
              alt="Logo"
              width={36}
              height={36}
              className="relative z-10 transition-transform duration-300 group-hover:scale-110"
            />
          </div>
          <span className="text-2xl font-bold tracking-tighter text-foreground">
            Git<span className="text-primary">Vision</span>
          </span>
        </Link>
      </div>

      <div className="relative group perspective-1000 max-w-md w-full">
        {/* Deep layered background offsets */}
        <div className="absolute -inset-1.5 bg-gradient-to-br from-primary/30 to-background rounded-none blur-sm opacity-50 group-hover:opacity-100 transition duration-700" />
        <div className="absolute inset-0 bg-primary/10 translate-x-2 translate-y-2 border border-primary/20" />

        <Card className="relative border border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl sm:p-6 transition-all duration-500 rounded-none transform-style-3d group-hover:-translate-y-1 group-hover:-translate-x-1">
          {/* Accent line */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary/80 via-primary/40 to-transparent" />

          <CardHeader className="space-y-3 pb-8 text-left pt-4">
            <CardTitle className="text-3xl font-bold tracking-tighter text-foreground selection:bg-primary/30">
              Reset Password
            </CardTitle>
            <CardDescription className="text-muted-foreground/80 text-sm font-medium tracking-widest uppercase">
              Enter a new password
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form
              className="space-y-5"
              onSubmit={handleSubmit(handlePasswordReset)}
            >
              <div className="space-y-2 group/input">
                <Label
                  htmlFor="password"
                  className="text-foreground/80 font-bold text-[11px] uppercase tracking-wider group-focus-within/input:text-primary transition-colors cursor-pointer"
                >
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    required
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
                  </Button>
                </div>
                {errors.password && (
                  <p className="text-[11px] font-medium text-destructive mt-1.5 flex items-center gap-1.5">
                    <span className="w-1 h-1 bg-destructive rounded-none" />{" "}
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-2 group/input">
                <Label
                  htmlFor="confirmPassword"
                  className="text-foreground/80 font-bold text-[11px] uppercase tracking-wider group-focus-within/input:text-primary transition-colors cursor-pointer"
                >
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    {...register("confirmPassword")}
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    required
                    className="h-12 pr-10 bg-background/40 focus-visible:ring-0 focus-visible:border-primary/60 border border-border/40 transition-all font-medium rounded-none shadow-inner"
                    aria-invalid={!!errors.confirmPassword}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-12 w-12 rounded-none text-muted-foreground hover:text-foreground bg-transparent hover:bg-transparent cursor-pointer"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-[11px] font-medium text-destructive mt-1.5 flex items-center gap-1.5">
                    <span className="w-1 h-1 bg-destructive rounded-none" />{" "}
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="h-12 mt-4 rounded-none w-full font-bold uppercase tracking-widest text-[11px] transition-all duration-300 bg-primary hover:bg-primary/90 text-primary-foreground shadow-[4px_4px_0_hsl(var(--primary)/0.2)] hover:shadow-none hover:translate-y-1 hover:translate-x-1 cursor-pointer text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center pb-2 pt-4 border-t border-border/10 mt-2">
            <div className="text-xs font-medium text-muted-foreground/80 tracking-wide">
              Remember your password?{" "}
              <Link
                href="/sign-in"
                className="text-foreground font-semibold hover:text-primary transition-colors underline decoration-border hover:decoration-primary cursor-pointer underline-offset-4"
              >
                Sign in
              </Link>
            </div>
          </CardFooter>
        </Card>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="mt-8 p-4 border border-destructive/30 bg-destructive/5 shadow-[4px_4px_0_rgba(239,68,68,0.1)] rounded-none relative overflow-hidden"
          >
            <div className="absolute left-0 top-0 w-1 h-full bg-destructive" />
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-destructive pl-2">
              Password Reset Error
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
    </div>
  );
}
