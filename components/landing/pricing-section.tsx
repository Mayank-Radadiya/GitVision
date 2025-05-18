"use client";

import { useRef, memo } from "react";
import { motion, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CheckIcon,
  ArrowRightIcon,
  ShieldIcon,
  RocketIcon,
  BuildingIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SpotlightCard from "../custom/SpotlightCard";

const plans = [
  {
    name: "Basic",
    icon: ShieldIcon,
    description: "For individuals exploring repositories",
    price: "Free",
    priceDescription: "No credit card required",
    features: [
      "5 public repositories per month",
      "Basic commit analysis",
      "7-day history retention",
      "Standard visualizations",
      "Community support",
    ],
    cta: "Get Started",
    ctaIcon: ArrowRightIcon,
    popular: false,
    accent: "blue",
  },
  {
    name: "Pro",
    icon: RocketIcon,
    description: "For serious developers and small teams",
    price: "$19",
    priceDescription: "/month per user",
    features: [
      "Unlimited repositories",
      "Advanced AI commit analysis",
      "30-day history retention",
      "Interactive visualizations",
      "AI chat assistant",
      "Priority email support",
    ],
    cta: "Buy Now",
    ctaIcon: ArrowRightIcon,
    popular: true,
    accent: "purple",
  },
  {
    name: "Team",
    icon: BuildingIcon,
    description: "For development teams and organizations",
    price: "$49",
    priceDescription: "/month per team",
    features: [
      "Everything in Pro",
      "Unlimited team members",
      "90-day history retention",
      "Advanced contribution analytics",
      "Team performance metrics",
      "Dedicated support",
    ],
    cta: "Contact Us",
    ctaIcon: ArrowRightIcon,
    popular: false,
    accent: "amber",
  },
];

function PricingSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 20,
        duration: 0.5,
      },
    },
  };

  return (
    <section id="pricing" ref={ref} className="py-10 relative overflow-hidden">
      {/* Content container */}
      <div className="container max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Choose Your Plan
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Select the perfect plan for your needs. All plans include our core
            features with varying levels of access and support.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {plans.map((plan) => (
            <motion.div
              key={plan.name}
              variants={itemVariants}
              className="h-full"
            >
              <SpotlightCard
                spotlightColor={
                  plan.accent === "blue"
                    ? "rgba(59, 130, 246, 0.3)"
                    : plan.accent === "purple"
                    ? "rgba(147, 51, 234, 0.3)"
                    : "rgba(245, 158, 11, 0.3)"
                }
                className={cn(
                  "h-full flex flex-col shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden custom-spotlight-card  ",
                  plan.accent === "blue"
                    ? "border border-blue-700/30 dark:border-blue-500/30"
                    : plan.accent === "purple"
                    ? "border-2 border-purple-600/40 dark:border-purple-500/40"
                    : "border border-amber-600/30 dark:border-amber-500/30",
                  plan.popular ? "border-primary/50 relative" : ""
                )}
              >
                {plan.popular && (
                  <div className="absolute top-4 right-4 bg-primary text-white text-xs font-semibold px-2 py-1 rounded-full">
                    Most Popular
                  </div>
                )}

                <CardHeader className="pb-8 flex flex-col items-center text-center space-y-2">
                  <div
                    className={cn(
                      "p-3 rounded-full mb-3",
                      plan.accent === "blue"
                        ? "bg-blue-100 dark:bg-blue-900/30"
                        : "",
                      plan.accent === "purple"
                        ? "bg-purple-100 dark:bg-purple-900/30"
                        : "",
                      plan.accent === "amber"
                        ? "bg-amber-100 dark:bg-amber-900/30"
                        : ""
                    )}
                  >
                    <plan.icon
                      className={cn(
                        "h-6 w-6",
                        plan.accent === "blue"
                          ? "text-blue-500 dark:text-blue-400"
                          : "",
                        plan.accent === "purple"
                          ? "text-purple-500 dark:text-purple-400"
                          : "",
                        plan.accent === "amber"
                          ? "text-amber-500 dark:text-amber-400"
                          : ""
                      )}
                    />
                  </div>

                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {plan.description}
                  </p>

                  <div className="mt-4 flex items-baseline">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    {plan.price !== "Free" && (
                      <span className="ml-1.5 text-muted-foreground text-sm">
                        {plan.priceDescription}
                      </span>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-grow pb-0">
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start">
                        <CheckIcon
                          className={cn(
                            "h-5 w-5 mr-3 shrink-0 mt-0.5",
                            plan.accent === "blue" ? "text-blue-500" : "",
                            plan.accent === "purple" ? "text-purple-500" : "",
                            plan.accent === "amber" ? "text-amber-500" : ""
                          )}
                        />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="pt-6 pb-8">
                  <Button
                    variant={plan.popular ? "default" : "outline"}
                    className={cn(
                      "w-full h-11 rounded-md transition-all",
                      plan.popular ? "shadow-md shadow-primary/20" : ""
                    )}
                  >
                    <span>{plan.cta}</span>
                    <plan.ctaIcon className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </SpotlightCard>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-16 text-center"
        >
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Need a custom solution for your enterprise?
            <Button variant="link" className="text-primary h-auto p-0 pl-1.5">
              Contact our sales team
            </Button>
          </p>
        </motion.div>
      </div>
    </section>
  );
}

export default memo(PricingSection);
