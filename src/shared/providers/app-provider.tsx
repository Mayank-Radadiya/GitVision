"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "react-hot-toast";
import { useState, type CSSProperties } from "react";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "@/src/lib/trpc/client";
import { makeQueryClient } from "@/src/lib/trpc/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";

interface ProviderProps {
  children: React.ReactNode;
}

const TOAST_STYLE: CSSProperties = {
  background: "transparent",
  boxShadow: "0 3px 10px rgba(0, 0, 0, 0.2)",
  borderRadius: "8px",
  padding: "6px",
  paddingLeft: "10px",
  fontSize: "15px",
  fontWeight: "500",
  lineHeight: "1.5",
  transition: "all 0.3s ease",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "0.5px solid rgba(255, 255, 255, 0.2)",
  zIndex: 99,
};

/** Sits inside ThemeProvider so the toast follows the theme as a value rather
 *  than through a CSS variable that a DOM observer had to keep in sync. */
function ThemedToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          ...TOAST_STYLE,
          color: resolvedTheme === "dark" ? "#fff" : "#333",
        },
        success: {
          duration: 4000,
        },
        error: {
          duration: 6000,
        },
      }}
    />
  );
}

const Provider = ({ children }: ProviderProps) => {
  // Create a client using the factory to ensure consistent configuration
  // (transformers, etc.). Query data is NOT persisted to localStorage — pages
  // prefetch fresh data server-side (RSC) and hydrate, so a persisted cache
  // would only risk hydrating stale project/chat data.
  const [queryClient] = useState(() => makeQueryClient());

  // Create tRPC client
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <ClerkProvider>
      <MotionConfig reducedMotion="user">
        <QueryClientProvider client={queryClient}>
          <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              enableSystem
              enableColorScheme
              disableTransitionOnChange={false}
            >
              <ThemedToaster />
              {children}
            </ThemeProvider>
          </trpc.Provider>
        </QueryClientProvider>
      </MotionConfig>
    </ClerkProvider>
  );
};
export default Provider;
