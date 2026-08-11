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
        <span className="from-primary to-primary bg-linear-to-r via-blue-400 bg-clip-text text-transparent">
          repositories
        </span>
        ?
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="text-muted-foreground mx-auto mb-10 max-w-2xl text-lg"
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
          <GlowingButton className="group cursor-pointer gap-2 rounded-full text-white">
            Get started for free
            <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </GlowingButton>
        </Link>
        <Link href="#features" aria-label="See how it works">
          <Button
            variant="outline"
            size="lg"
            className="border-border/60 bg-background/60 hover:bg-background/80 cursor-pointer rounded-full backdrop-blur-sm transition-all duration-300"
          >
            See how it works
          </Button>
        </Link>
      </motion.div>
    </>
  );
}
