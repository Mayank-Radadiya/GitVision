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
  /**
   * There is no payment path in this codebase — no Stripe, no checkout route,
   * no webhook — so a plan with a real price cannot honestly offer a buy
   * button. `comingSoon` renders a disabled button instead of a link to
   * `/sign-up`, which would be a signup page wearing a purchase's label.
   */
  comingSoon?: boolean;
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
    priceLabel: "100 credits on signup",
    // Every bullet below is a shipped behaviour. No quota and no retention
    // window is listed because neither exists: there is no per-month project
    // cap in `project.create`, and no code prunes project history (the only
    // nightly cron clears rate-limit windows, see `src/lib/inngest/functions.ts`).
    features: [
      "100 free credits on signup",
      "Public repository analysis",
      "Commit, issue & PR history",
      "AI chat over your own code",
      "Standard visualizations",
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
    // Not purchasable yet (`comingSoon`), so these describe the tier's scope
    // rather than any shipped entitlement. Nothing here promises a limit the
    // free tier does not already have.
    features: [
      "Everything in Basic",
      "Advanced AI commit analysis",
      "Interactive visualizations",
      "AI chat assistant",
      "Priority email support",
    ],
    cta: "Coming Soon",
    popular: true,
    comingSoon: true,
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
      "Advanced contribution analytics",
      "Team performance metrics",
      "Dedicated support",
    ],
    cta: "Coming Soon",
    popular: false,
    comingSoon: true,
    accent: AMBER,
  },
];
