"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";
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
import { Input } from "@/shared/components/ui/input";
import { ClerkAPIError } from "@clerk/types";
import CustomToggleButton from "@/shared/components/theme/mode-toggle";
import Image from "next/image";

interface VerifyEmailProps {
  emailCode: string[];
  setEmailCode: (code: string[]) => void;
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
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus the first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (index: number, value: string) => {
    // Update the emailCode array
    const newOtp = [...emailCode];
    newOtp[index] = value;
    setEmailCode(newOtp);

    // Move to the next input if value is entered
    if (value && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    // Move to the previous input on backspace if current input is empty
    if (
      e.key === "Backspace" &&
      !emailCode[index] &&
      index > 0 &&
      inputRefs.current[index - 1]
    ) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid-small-black/[0.2] dark:bg-grid-small-white/[0.05]"></div>
      <div className="absolute inset-0 bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
      <div className="absolute -left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px] dark:bg-primary/10"></div>
      <div className="absolute -right-1/4 bottom-0 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px] dark:bg-primary/10"></div>

      <div className="absolute right-4 top-4 flex items-center gap-2 z-10">
        <CustomToggleButton />
      </div>
      <Link
        href="/sign-up"
        className="absolute left-4 top-4 flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground z-10"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to sign up</span>
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
              src="/Github.svg"
              alt="GitVision Logo"
              width={36}
              height={36}
              className="relative z-10 transition-transform duration-300 group-hover:scale-110"
            />
          </div>
          <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-xl font-bold tracking-tight text-transparent">
            Git<span className="text-primary">Vision</span>
          </span>
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="w-full max-w-md z-10"
      >
        <Card className="border hover:border-white/30 transition-all duration-500 shadow-xl backdrop-blur-sm bg-background/80">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl w-full font-bold bg-gradient-to-br from-foreground via-foreground to-foreground/80 bg-clip-text text-transparent items-center ">
              Verify your email
            </CardTitle>
            <CardDescription className="text-muted-foreground/90">
              We&apos;ve sent a verification code to your email. Please enter it
              below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleVerify}>
              <div className="flex justify-center gap-2">
                {emailCode.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    className="h-14 w-14 text-center text-lg font-semibold bg-background/50 backdrop-blur-sm hover:border-primary/50 focus:border-primary transition-colors"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label={`Digit ${index + 1}`}
                  />
                ))}
              </div>
              <Button
                type="submit"
                className="h-11 w-full rounded-md shadow-md hover:shadow-lg transition-shadow duration-300 bg-gradient-to-r from-primary to-primary/90 font-medium relative overflow-hidden group mt-4"
                disabled={isLoading || emailCode.join("").length !== 6}
              >
                <span className="absolute top-0 -left-5 w-12 h-full bg-white/20 transform translate-x-[-100%] skew-x-[-20deg] group-hover:translate-x-[350%] transition-transform duration-3000"></span>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Email"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-3 pb-6">
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              <span>Didn&apos;t receive a code?</span>
              <Button
                variant="link"
                className="h-auto p-0 text-primary font-medium"
                disabled={isLoading}
              >
                Resend code
              </Button>
            </div>
            <div className="text-sm text-muted-foreground text-center">
              <Link
                href="/sign-in"
                className="font-medium text-primary underline-offset-4 hover:underline transition-colors"
              >
                Back to sign in
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
      </motion.div>
    </div>
  );
}

export default memo(VerifyEmail);
