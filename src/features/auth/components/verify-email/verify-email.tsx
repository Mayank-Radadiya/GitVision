"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { memo } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/shared/components/ui/input-otp";
import { ClerkAPIError } from "@clerk/types";

interface VerifyEmailProps {
  emailCode: string;
  setEmailCode: (code: string) => void;
  handleVerify: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  isLoading: boolean;
  error: ClerkAPIError[] | undefined;
}

function VerifyEmail({
  emailCode,
  setEmailCode,
  handleVerify,
  isLoading,
  error,
}: VerifyEmailProps) {
  return (
    <div className="flex w-full flex-col items-center justify-center relative z-10 px-4 sm:px-0 mt-8 mb-8 md:mt-24">
      <div className="relative group perspective-1000 max-w-md w-full">
        {/* Deep layered background offsets */}
        <div className="absolute -inset-1.5 bg-gradient-to-br from-primary/30 to-background rounded-none blur-sm opacity-50 group-hover:opacity-100 transition duration-700" />
        <div className="absolute inset-0 bg-primary/10 translate-x-2 translate-y-2 border border-primary/20" />

        <Card className="relative border border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl sm:p-6 transition-all duration-500 rounded-none transform-style-3d group-hover:-translate-y-1 group-hover:-translate-x-1">
          {/* Accent line */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary/80 via-primary/40 to-transparent" />

          <CardHeader className="space-y-3 pb-8 text-left pt-4">
            <CardTitle className="text-3xl font-bold tracking-tighter text-foreground selection:bg-primary/30">
              Verify your email
            </CardTitle>
            <CardDescription className="text-muted-foreground/80 text-sm font-medium tracking-widest uppercase">
              We&apos;ve sent a verification code to your email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form className="space-y-6" onSubmit={handleVerify}>
              <div className="flex justify-center gap-2">
                <InputOTP
                  maxLength={6}
                  value={emailCode}
                  onChange={setEmailCode}
                  disabled={isLoading}
                >
                  <InputOTPGroup>
                    <InputOTPSlot
                      index={0}
                      className="w-12 h-12 text-lg rounded-none border-border bg-background shadow-inner "
                    />
                    <InputOTPSlot
                      index={1}
                      className="w-12 h-12 text-lg rounded-none border-border bg-background shadow-inner"
                    />
                    <InputOTPSlot
                      index={2}
                      className="w-12 h-12 text-lg rounded-none border-border bg-background shadow-inner"
                    />
                    <InputOTPSlot
                      index={3}
                      className="w-12 h-12 text-lg rounded-none border-border bg-background shadow-inner"
                    />
                    <InputOTPSlot
                      index={4}
                      className="w-12 h-12 text-lg rounded-none border-border bg-background shadow-inner"
                    />
                    <InputOTPSlot
                      index={5}
                      className="w-12 h-12 text-lg rounded-none border-border bg-background shadow-inner"
                    />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button
                type="submit"
                className="h-12 mt-4 rounded-none w-full font-bold uppercase tracking-widest text-[11px] transition-all duration-300 bg-primary hover:bg-primary/90 text-primary-foreground shadow-[4px_4px_0_hsl(var(--primary)/0.2)] hover:shadow-none hover:translate-y-1 hover:translate-x-1 cursor-pointer text-white"
                disabled={isLoading || emailCode.length !== 6}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying
                  </>
                ) : (
                  "Verify Email"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center pb-2 pt-4 border-t border-border/10 mt-2 flex-col gap-4">
            <div className="text-xs font-medium text-muted-foreground/80 tracking-wide flex items-center justify-center gap-2">
              <span>Didn&apos;t receive a code?</span>
              <Button
                variant="link"
                className="h-auto p-0 text-foreground font-semibold hover:text-primary transition-colors underline decoration-border hover:decoration-primary cursor-pointer underline-offset-4"
                disabled={isLoading}
              >
                Resend code
              </Button>
            </div>
            <div className="text-xs font-medium text-muted-foreground/80 tracking-wide">
              <Link
                href="/sign-in"
                className="text-foreground font-semibold hover:text-primary transition-colors underline decoration-border hover:decoration-primary cursor-pointer underline-offset-4"
              >
                Back to sign in
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
              Verification Error
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

export default memo(VerifyEmail);
