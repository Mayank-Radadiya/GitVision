import type { LucideIcon } from "lucide-react";
import { ShieldIcon, RocketIcon, BuildingIcon } from "lucide-react";

export interface PlanAccent {
  text: string;
  bg: string;
  border: string;
  check: string;
  spotlight: `rgba(${number}, ${number}, ${number}, ${number})`;
}

export interface Plan {
  name: string;
  icon: LucideIcon;
  description: string;
  price: string;
  priceLabel: string;
  features: string[];
  cta: string;
  popular: boolean;
  accent: PlanAccent;
}

const BLUE: PlanAccent = {
  text: "text-blue-500",
  bg: "bg-blue-500/10",
  border: "border-blue-500/20",
  check: "text-blue-500",
  spotlight: "rgba(59, 130, 246, 0.25)",
};

const PRIMARY: PlanAccent = {
  text: "text-primary",
  bg: "bg-primary/10",
  border: "border-primary/40",
  check: "text-primary",
  spotlight: "rgba(147, 51, 234, 0.3)",
};

const AMBER: PlanAccent = {
  text: "text-amber-500",
  bg: "bg-amber-500/10",
  border: "border-amber-500/20",
  check: "text-amber-500",
  spotlight: "rgba(245, 158, 11, 0.25)",
};

export const PLANS: Plan[] = [
  {
    name: "Basic",
    icon: ShieldIcon,
    description: "For individuals exploring repositories",
    price: "Free",
    priceLabel: "No credit card required",
    features: [
      "5 public repositories per month",
      "Basic commit analysis",
      "7-day history retention",
      "Standard visualizations",
      "Community support",
    ],
    cta: "Get Started",
    popular: false,
    accent: BLUE,
  },
  {
    name: "Pro",
    icon: RocketIcon,
    description: "For serious developers and small teams",
    price: "$19",
    priceLabel: "/month per user",
    features: [
      "Unlimited repositories",
      "Advanced AI commit analysis",
      "30-day history retention",
      "Interactive visualizations",
      "AI chat assistant",
      "Priority email support",
    ],
    cta: "Buy Now",
    popular: true,
    accent: PRIMARY,
  },
  {
    name: "Team",
    icon: BuildingIcon,
    description: "For development teams and organizations",
    price: "$49",
    priceLabel: "/month per team",
    features: [
      "Everything in Pro",
      "Unlimited team members",
      "90-day history retention",
      "Advanced contribution analytics",
      "Team performance metrics",
      "Dedicated support",
    ],
    cta: "Contact Us",
    popular: false,
    accent: AMBER,
  },
];
