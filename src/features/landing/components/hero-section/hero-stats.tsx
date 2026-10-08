"use client";

import { useEffect, useRef } from "react";
import {
  animate,
  m,
  useInView,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { ArrowUpRight, Github } from "lucide-react";
import { trpc } from "@/src/lib/trpc/client";
import { GITHUB_REPO_URL } from "../landing-header/constants";
import { STATS_DATA } from "./constants";
import { HeroReveal, useHeroMotion } from "./hero-motion";
import { HERO_MOTION as T } from "./motion-tokens";

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const full = new Intl.NumberFormat("en-US");
const formatCount = (value: number) => compact.format(Math.floor(value));

/** A real aggregate; undefined means unavailable, never zero. */
export function HeroStatCounter({
  value,
  label,
  loading = false,
}: {
  value: number | undefined;
  label: string;
  loading?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const hasAnimated = useRef(false);
  const count = useMotionValue(value ?? 0);
  const display = useTransform(count, formatCount);
  const { reducedMotion, ready } = useHeroMotion();
  const available =
    typeof value === "number" && Number.isFinite(value) && value >= 0;
  const final = available ? formatCount(value) : "—";
  useEffect(() => {
    if (!available) return;
    if (!ready || reducedMotion || hasAnimated.current) {
      count.set(value);
      return;
    }
    if (!inView) return;
    hasAnimated.current = true;
    count.set(0);
    const controls = animate(count, value, { duration: T.count, ease: T.ease });
    return () => controls.stop();
  }, [available, count, inView, ready, reducedMotion, value]);
  return (
    <div ref={ref} className="min-w-0 text-center">
      <span className="sr-only">
        {available ? full.format(value) : loading ? "Loading" : "Unavailable"}{" "}
        {label}
      </span>
      <div
        aria-hidden="true"
        className="text-foreground mx-auto flex h-8 w-[7ch] items-center justify-center font-mono text-xl font-medium tabular-nums sm:text-2xl"
      >
        {available ? (
          <m.span>{reducedMotion ? final : display}</m.span>
        ) : loading ? (
          <span className="bg-muted h-5 w-12 rounded" />
        ) : (
          <span>—</span>
        )}
      </div>
      <span
        aria-hidden="true"
        className="text-muted-foreground mt-1 block text-[10px] leading-5 sm:text-xs"
      >
        {label}
      </span>
    </div>
  );
}

export function HeroStats() {
  // Keep the server-prefetched query key and existing freshness policy intact.
  const { data: stats, isLoading } = trpc.project.getPublicStats.useQuery(
    undefined,
    { staleTime: 300_000, refetchOnWindowFocus: false },
  );
  return (
    <HeroReveal order={5} className="mx-auto mt-8 max-w-lg">
      <div className="divide-border grid grid-cols-3 divide-x">
        {STATS_DATA.map((stat) => (
          <HeroStatCounter
            key={stat.key}
            value={stats?.[stat.key]}
            label={stat.label}
            loading={isLoading}
          />
        ))}
      </div>
      <a
        href={GITHUB_REPO_URL}
        className="hero-control text-muted-foreground mt-2 inline-flex min-h-11 items-center gap-2 rounded-md px-3 font-mono text-[10px]"
      >
        <Github aria-hidden="true" className="size-3.5" />
        View on GitHub
        <ArrowUpRight aria-hidden="true" className="size-3" />
      </a>
    </HeroReveal>
  );
}
