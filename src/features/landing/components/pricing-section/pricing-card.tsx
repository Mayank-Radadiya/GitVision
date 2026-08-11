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
          "flex h-full flex-col overflow-hidden",
          "border",
          plan.accent.border,
          plan.popular && "ring-primary/20 relative border-2 ring-1",
        )}
      >
        {/* Popular badge */}
        {plan.popular && (
          <div className="bg-primary text-primary-foreground absolute top-4 right-4 z-30 rounded-full px-2.5 py-1 text-xs font-semibold">
            Most Popular
          </div>
        )}

        <CardHeader className="flex flex-col items-center space-y-2 pb-6 text-center">
          {/* Icon */}
          <div className={cn("mb-2 rounded-xl p-3", plan.accent.bg)}>
            <plan.icon className={cn("h-5 w-5", plan.accent.text)} />
          </div>

          <CardTitle className="text-xl">{plan.name}</CardTitle>
          <p className="text-muted-foreground text-sm">{plan.description}</p>

          {/* Price */}
          <div className="mt-3 flex items-baseline">
            <span className="text-4xl font-bold">{plan.price}</span>
            {!isFree && (
              <span className="text-muted-foreground ml-1.5 text-sm">
                {plan.priceLabel}
              </span>
            )}
          </div>
          {isFree && (
            <p className="text-muted-foreground text-xs">{plan.priceLabel}</p>
          )}
        </CardHeader>

        <CardContent className="grow pb-0">
          <ul className="space-y-3">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start">
                <CheckIcon
                  className={cn(
                    "mt-0.5 mr-3 h-4 w-4 shrink-0",
                    plan.accent.check,
                  )}
                />
                <span className="text-muted-foreground text-sm">{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>

        <CardFooter className="pt-6 pb-8">
          <Button
            variant={plan.popular ? "default" : "outline"}
            className={cn(
              "group h-11 w-full cursor-pointer rounded-lg transition-all",
              plan.popular && "shadow-primary/20 shadow-md",
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
