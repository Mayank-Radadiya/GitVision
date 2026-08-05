"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { Toaster } from "react-hot-toast";
import { memo, useEffect, useState } from "react";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "@/src/lib/trpc/client";
import { makeQueryClient } from "@/src/lib/trpc/query-client";
import { MotionConfig } from "framer-motion";

interface ProviderProps {
  children: React.ReactNode;
}

// Memoized Toaster component to prevent unnecessary re-renders
const MemoizedToaster = memo(() => (
  <Toaster
    position="bottom-right"
    toastOptions={{
      style: {
        background: "var(--toast-bg, #fff)",
        color: "var(--toast-text, #333)",
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
      },
      success: {
        duration: 4000,
      },
      error: {
        duration: 6000,
      },
    }}
  />
));
MemoizedToaster.displayName = "MemoizedToaster";

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

  // Keep the toast theme CSS vars in sync with the active theme class.
  useEffect(() => {
    const updateToastThemeVars = () => {
      const isDark = document.documentElement.classList.contains("dark");
      document.documentElement.style.setProperty("--toast-bg", "transparent");
      document.documentElement.style.setProperty(
        "--toast-text",
        isDark ? "#fff" : "#333",
      );
    };

    updateToastThemeVars();
    const observer = new MutationObserver(updateToastThemeVars);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <ClerkProvider>
      <MotionConfig reducedMotion="user">
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            enableColorScheme
            disableTransitionOnChange={false}
          >
            <MemoizedToaster />
            {children}
          </ThemeProvider>
        </trpc.Provider>
      </MotionConfig>
    </ClerkProvider>
  );
};
export default Provider;
