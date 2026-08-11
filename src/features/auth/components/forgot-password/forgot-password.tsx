"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
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
import { useForgotPasswordLogic } from "./use-forgotPassword";

export default function ForgotPassword() {
  const { emailRef, isLoading, error, handleSubmit } = useForgotPasswordLogic();

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
              Password Reset
            </CardTitle>
            <CardDescription className="text-muted-foreground/80 text-sm font-medium tracking-widest uppercase">
              Enter your email to receive a code
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="group/input space-y-2">
                <Label
                  htmlFor="email"
                  className="text-foreground/80 group-focus-within/input:text-primary cursor-pointer text-[11px] font-bold tracking-wider uppercase transition-colors"
                >
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  ref={emailRef}
                  placeholder="name@example.com"
                  required
                  className="bg-background/40 focus-visible:border-primary/60 border-border/40 placeholder:text-muted-foreground/30 h-12 rounded-none border font-medium shadow-inner transition-all focus-visible:ring-0"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground mt-4 h-12 w-full cursor-pointer rounded-none text-[11px] font-bold tracking-widest uppercase shadow-[4px_4px_0_hsl(var(--primary)/0.2)] transition-all duration-300 hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Code
                  </>
                ) : (
                  "Send Reset Code"
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
              Error
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
