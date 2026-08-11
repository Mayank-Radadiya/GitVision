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
    <div className="relative z-10 mt-8 mb-8 flex w-full flex-col items-center justify-center px-4 sm:px-0 md:mt-16">
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <CustomToggleButton />
      </div>

      <Link
        href="/sign-in"
        className="text-muted-foreground/80 hover:text-primary absolute top-4 left-4 z-10 flex items-center gap-2 text-[11px] font-bold tracking-wider uppercase transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to sign in</span>
      </Link>

      <div className="z-10 mb-8">
        <Link
          href="/"
          className="group flex items-center gap-3 transition-all duration-300"
        >
          <div className="bg-background ring-border group-hover:ring-primary/50 relative flex h-12 w-12 items-center justify-center rounded-none shadow-lg ring-1 transition-all duration-300">
            <Image
              src={"/Github.svg"}
              alt="Logo"
              width={36}
              height={36}
              className="relative z-10 transition-transform duration-300 group-hover:scale-110"
            />
          </div>
          <span className="text-foreground text-2xl font-bold tracking-tighter">
            Git<span className="text-primary">Vision</span>
          </span>
        </Link>
      </div>

      <div className="group perspective-1000 relative w-full max-w-md">
        {/* Deep layered background offsets */}
        <div className="from-primary/30 to-background absolute -inset-1.5 rounded-none bg-linear-to-br opacity-50 blur-sm transition duration-700 group-hover:opacity-100" />
        <div className="bg-primary/10 border-primary/20 absolute inset-0 translate-x-2 translate-y-2 border" />

        <Card className="border-border/50 bg-background/95 transform-style-3d relative rounded-none shadow-2xl backdrop-blur-xl transition-all duration-500 group-hover:-translate-x-1 group-hover:-translate-y-1 sm:p-6">
          {/* Accent line */}
          <div className="from-primary/80 via-primary/40 absolute inset-x-0 top-0 h-0.5 bg-linear-to-r to-transparent" />

          <CardHeader className="space-y-3 pt-4 pb-8 text-left">
            <CardTitle className="text-foreground selection:bg-primary/30 text-3xl font-bold tracking-tighter">
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
              <div className="group/input space-y-2">
                <Label
                  htmlFor="password"
                  className="text-foreground/80 group-focus-within/input:text-primary cursor-pointer text-[11px] font-bold tracking-wider uppercase transition-colors"
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

              <div className="group/input space-y-2">
                <Label
                  htmlFor="confirmPassword"
                  className="text-foreground/80 group-focus-within/input:text-primary cursor-pointer text-[11px] font-bold tracking-wider uppercase transition-colors"
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
                    className="bg-background/40 focus-visible:border-primary/60 border-border/40 h-12 rounded-none border pr-10 font-medium shadow-inner transition-all focus-visible:ring-0"
                    aria-invalid={!!errors.confirmPassword}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground absolute top-0 right-0 h-12 w-12 cursor-pointer rounded-none bg-transparent hover:bg-transparent"
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
                  <p className="text-destructive mt-1.5 flex items-center gap-1.5 text-[11px] font-medium">
                    <span className="bg-destructive h-1 w-1 rounded-none" />{" "}
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground mt-4 h-12 w-full cursor-pointer rounded-none text-[11px] font-bold tracking-widest uppercase shadow-[4px_4px_0_hsl(var(--primary)/0.2)] transition-all duration-300 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
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
          <CardFooter className="border-border/10 mt-2 flex justify-center border-t pt-4 pb-2">
            <div className="text-muted-foreground/80 text-xs font-medium tracking-wide">
              Remember your password?{" "}
              <Link
                href="/sign-in"
                className="text-foreground hover:text-primary decoration-border hover:decoration-primary cursor-pointer font-semibold underline underline-offset-4 transition-colors"
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
            className="border-destructive/30 bg-destructive/5 relative mt-8 overflow-hidden rounded-none border p-4 shadow-[4px_4px_0_rgba(239,68,68,0.1)]"
          >
            <div className="bg-destructive absolute top-0 left-0 h-full w-1" />
            <h3 className="text-destructive pl-2 text-[11px] font-bold tracking-wider uppercase">
              Password Reset Error
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
    </div>
  );
}
