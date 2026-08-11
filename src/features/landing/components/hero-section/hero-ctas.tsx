import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { GlowingButton } from "@/shared/components/effects/glowing-button";
import { fadeInUpVariants } from "./variants";

export function HeroCtas() {
  return (
    <motion.div
      variants={fadeInUpVariants}
      initial="hidden"
      animate="visible"
      custom={0.4}
      className="flex flex-col items-center justify-center gap-4 sm:flex-row"
    >
      <Link href="/sign-up" aria-label="Sign up for free access">
        <GlowingButton className="group z-12 cursor-pointer gap-2 rounded-full text-white">
          Get started for free
          <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </GlowingButton>
      </Link>
      <Link href="#features" aria-label="View features">
        <Button
          variant="outline"
          size="lg"
          className="border-border/60 bg-background/60 hover:bg-background/80 cursor-pointer rounded-full backdrop-blur-sm transition-all duration-300"
        >
          See how it works
        </Button>
      </Link>
    </motion.div>
  );
}
