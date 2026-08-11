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
    <div className="relative z-10 mt-8 mb-8 flex w-full flex-col items-center justify-center px-4 sm:px-0 md:mt-24">
      <div className="group perspective-1000 relative w-full max-w-md">
        {/* Deep layered background offsets */}
        <div className="from-primary/30 to-background absolute -inset-1.5 rounded-none bg-linear-to-br opacity-50 blur-sm transition duration-700 group-hover:opacity-100" />
        <div className="bg-primary/10 border-primary/20 absolute inset-0 translate-x-2 translate-y-2 border" />

        <Card className="border-border/50 bg-background/95 transform-style-3d relative rounded-none shadow-2xl backdrop-blur-xl transition-all duration-500 group-hover:-translate-x-1 group-hover:-translate-y-1 sm:p-6">
          {/* Accent line */}
          <div className="from-primary/80 via-primary/40 absolute inset-x-0 top-0 h-0.5 bg-linear-to-r to-transparent" />

          <CardHeader className="space-y-3 pt-4 pb-8 text-left">
            <CardTitle className="text-foreground selection:bg-primary/30 text-3xl font-bold tracking-tighter">
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
                      className="border-border bg-background h-12 w-12 rounded-none text-lg shadow-inner"
                    />
                    <InputOTPSlot
                      index={1}
                      className="border-border bg-background h-12 w-12 rounded-none text-lg shadow-inner"
                    />
                    <InputOTPSlot
                      index={2}
                      className="border-border bg-background h-12 w-12 rounded-none text-lg shadow-inner"
                    />
                    <InputOTPSlot
                      index={3}
                      className="border-border bg-background h-12 w-12 rounded-none text-lg shadow-inner"
                    />
                    <InputOTPSlot
                      index={4}
                      className="border-border bg-background h-12 w-12 rounded-none text-lg shadow-inner"
                    />
                    <InputOTPSlot
                      index={5}
                      className="border-border bg-background h-12 w-12 rounded-none text-lg shadow-inner"
                    />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-primary-foreground mt-4 h-12 w-full cursor-pointer rounded-none text-[11px] font-bold tracking-widest uppercase shadow-[4px_4px_0_hsl(var(--primary)/0.2)] transition-all duration-300 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
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
          <CardFooter className="border-border/10 mt-2 flex flex-col justify-center gap-4 border-t pt-4 pb-2">
            <div className="text-muted-foreground/80 flex items-center justify-center gap-2 text-xs font-medium tracking-wide">
              <span>Didn&apos;t receive a code?</span>
              <Button
                variant="link"
                className="text-foreground hover:text-primary decoration-border hover:decoration-primary h-auto cursor-pointer p-0 font-semibold underline underline-offset-4 transition-colors"
                disabled={isLoading}
              >
                Resend code
              </Button>
            </div>
            <div className="text-muted-foreground/80 text-xs font-medium tracking-wide">
              <Link
                href="/sign-in"
                className="text-foreground hover:text-primary decoration-border hover:decoration-primary cursor-pointer font-semibold underline underline-offset-4 transition-colors"
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
            className="border-destructive/30 bg-destructive/5 relative mt-8 overflow-hidden rounded-none border p-4 shadow-[4px_4px_0_rgba(239,68,68,0.1)]"
          >
            <div className="bg-destructive absolute top-0 left-0 h-full w-1" />
            <h3 className="text-destructive pl-2 text-[11px] font-bold tracking-wider uppercase">
              Verification Error
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

export default memo(VerifyEmail);
