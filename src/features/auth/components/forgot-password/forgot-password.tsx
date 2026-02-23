"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {  Loader2 } from "lucide-react";
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
              Password Reset
            </CardTitle>
            <CardDescription className="text-muted-foreground/80 text-sm font-medium tracking-widest uppercase">
              Enter your email to receive a code
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2 group/input">
                <Label
                  htmlFor="email"
                  className="text-foreground/80 font-bold text-[11px] uppercase tracking-wider group-focus-within/input:text-primary transition-colors cursor-pointer"
                >
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  ref={emailRef}
                  placeholder="name@example.com"
                  required
                  className="h-12 bg-background/40 focus-visible:ring-0 focus-visible:border-primary/60 border border-border/40 transition-all placeholder:text-muted-foreground/30 font-medium rounded-none shadow-inner"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="h-12 mt-4 rounded-none w-full font-bold uppercase tracking-widest text-[11px] transition-all duration-300 bg-primary hover:bg-primary/90 text-primary-foreground shadow-[4px_4px_0_hsl(var(--primary)/0.2)] hover:shadow-none hover:translate-y-1 hover:translate-x-1 cursor-pointer text-white"
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
              Error
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
