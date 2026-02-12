import { motion } from "framer-motion";
import { CheckIcon, ArrowRightIcon } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils";
import SpotlightCard from "@/shared/components/effects/spotlight-card";
import type { Plan } from "./constants";
import { itemVariants } from "./variants";

interface PricingCardProps {
  plan: Plan;
}

export function PricingCard({ plan }: PricingCardProps) {
  const isFree = plan.price === "Free";

  return (
    <motion.div variants={itemVariants} className="h-full">
      <SpotlightCard
        spotlightColor={plan.accent.spotlight}
        hoverScale={plan.popular ? 1.03 : 1.01}
        className={cn(
          "h-full flex flex-col overflow-hidden",
          "border",
          plan.accent.border,
          plan.popular && "border-2 relative ring-1 ring-primary/20",
        )}
      >
        {/* Popular badge */}
        {plan.popular && (
          <div className="absolute top-4 right-4 z-30 bg-primary text-primary-foreground text-xs font-semibold px-2.5 py-1 rounded-full">
            Most Popular
          </div>
        )}

        <CardHeader className="pb-6 flex flex-col items-center text-center space-y-2">
          {/* Icon */}
          <div className={cn("p-3 rounded-xl mb-2", plan.accent.bg)}>
            <plan.icon className={cn("h-5 w-5", plan.accent.text)} />
          </div>

          <CardTitle className="text-xl">{plan.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{plan.description}</p>

          {/* Price */}
          <div className="mt-3 flex items-baseline">
            <span className="text-4xl font-bold">{plan.price}</span>
            {!isFree && (
              <span className="ml-1.5 text-muted-foreground text-sm">
                {plan.priceLabel}
              </span>
            )}
          </div>
          {isFree && (
            <p className="text-xs text-muted-foreground">{plan.priceLabel}</p>
          )}
        </CardHeader>

        <CardContent className="flex-grow pb-0">
          <ul className="space-y-3">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start">
                <CheckIcon
                  className={cn(
                    "h-4 w-4 mr-3 shrink-0 mt-0.5",
                    plan.accent.check,
                  )}
                />
                <span className="text-sm text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>

        <CardFooter className="pt-6 pb-8">
          <Button
            variant={plan.popular ? "default" : "outline"}
            className={cn(
              "w-full h-11 rounded-lg transition-all cursor-pointer group",
              plan.popular && "shadow-md shadow-primary/20",
            )}
          >
            <span>{plan.cta}</span>
            <ArrowRightIcon className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </CardFooter>
      </SpotlightCard>
    </motion.div>
  );
}
