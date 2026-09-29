import type { Variants } from "framer-motion";

export const fadeInUpVariants: Variants = {
  // No `opacity: 0` here on purpose. The `initial="hidden"` state is shipped
  // to the browser as inline CSS, so starting at zero opacity leaves the
  // hero — including the LCP <h1> — invisible until hydration finishes.
  // The slide still reads as an entrance; it just never starts invisible.
  hidden: { y: 20 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay, ease: "easeOut" },
  }),
};

export const floatingAnimation: Variants = {
  initial: { y: 0 },
  animate: {
    y: [0, -8, 0],
    transition: {
      duration: 3.5,
      repeat: Infinity,
      repeatType: "reverse",
      ease: "easeInOut",
    },
  },
};
