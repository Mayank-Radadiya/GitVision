"use client";

import { motion } from "framer-motion";
import { trpc } from "@/src/lib/trpc/client";
import { AnimatedCounter } from "./animated-counter";
import { STATS_DATA } from "./constants";
import { fadeInUpVariants } from "./variants";

export function HeroStats() {
  // The numbers are `COUNT(*)`s, prefetched server-side in `app/page.tsx`.
  // That prefetch is not an optimisation here, it is the only path that works:
  // `proxy.ts` protects the whole `/api/trpc` prefix, so if this hook ever did
  // fetch from the browser on the landing page a signed-out visitor would get
  // redirected to sign-in. The cache it reads is already warm and is trusted
  // for five minutes, which also means tabbing back to the page does not
  // re-count the tables.
  const { data: stats } = trpc.project.getPublicStats.useQuery(undefined, {
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });

  return (
    <motion.div
      variants={fadeInUpVariants}
      initial="hidden"
      animate="visible"
      custom={0.55}
      className="mx-auto mt-14 grid max-w-sm grid-cols-3 gap-8"
    >
      {STATS_DATA.map((stat) => (
        <AnimatedCounter
          key={stat.label}
          // `String`, not `toLocaleString()`: the counter splits its input on
          // digits and renders everything else as a literal suffix, so
          // "1,204" would animate to `1,204,`. It formats the number itself as
          // it counts. `0` rather than a dash because a dash would leave the
          // counter animating from NaN once the real value lands.
          value={String(stats?.[stat.key] ?? 0)}
          label={stat.label}
        />
      ))}
    </motion.div>
  );
}
