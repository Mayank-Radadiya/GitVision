import { motion } from "framer-motion";
import { ArrowRightIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { Feature } from "./constants";
import { itemVariants } from "./variants";

interface FeatureCardProps {
  feature: Feature;
}

export function FeatureCard({ feature }: FeatureCardProps) {
  const isLarge = feature.size === "large";

  return (
    <motion.div
      variants={itemVariants}
      className={cn("group relative", isLarge && "lg:col-span-2")}
    >
      <div
        className={cn(
          "border-border/40 bg-background/60 relative h-full rounded-2xl border p-7 backdrop-blur-sm transition-all duration-300",
          "hover:border-border/60 hover:bg-background/80 cursor-default hover:shadow-lg",
          feature.borderHover,
        )}
      >
        {/* Icon */}
        <div
          className={cn(
            "mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl",
            feature.accentBg,
          )}
        >
          <feature.icon className={cn("h-5 w-5", feature.accent)} />
        </div>

        {/* Title + arrow */}
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-lg font-semibold">{feature.name}</h3>
          <ArrowRightIcon className="text-muted-foreground/40 h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
        </div>

        {/* Description */}
        <p className="text-muted-foreground text-sm leading-relaxed">
          {feature.description}
        </p>

        {/* Visual element for large cards */}
        {isLarge && feature.visual}
      </div>
    </motion.div>
  );
}
