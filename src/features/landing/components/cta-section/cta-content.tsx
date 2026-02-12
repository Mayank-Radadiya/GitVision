import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { GlowingButton } from "@/shared/components/effects/glowing-button";

interface CtaContentProps {
  isInView: boolean;
}

export function CtaContent({ isInView }: CtaContentProps) {
  return (
    <>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.5 }}
        className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl"
      >
        Ready to understand your{" "}
        <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">
          repositories
        </span>
        ?
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-10 text-lg text-muted-foreground max-w-2xl mx-auto"
      >
        Join thousands of developers who use GitVision to make sense of code
        changes, understand project history, and collaborate more effectively.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex flex-col items-center justify-center gap-4 sm:flex-row"
      >
        <Link href="/sign-up" aria-label="Sign up for free">
          <GlowingButton className="rounded-full gap-2 group text-white cursor-pointer">
            Get started for free
            <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </GlowingButton>
        </Link>
        <Link href="#features" aria-label="See how it works">
          <Button
            variant="outline"
            size="lg"
            className="rounded-full border-border/60 bg-background/60 backdrop-blur-sm hover:bg-background/80 transition-all duration-300 cursor-pointer"
          >
            See how it works
          </Button>
        </Link>
      </motion.div>
    </>
  );
}
