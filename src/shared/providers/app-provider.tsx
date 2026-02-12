"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { Toaster } from "react-hot-toast";
import { memo, useEffect, useState } from "react";
import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "@/src/lib/trpc/client";

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
  // Create a client
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime in v4)
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Retry network errors but not others
              if (error instanceof Error && "isAxiosError" in error) {
                // Retry network errors up to 3 times
                return failureCount < 3;
              }
              return false; // Don't retry other errors
            },
          },
          mutations: {
            // Make sure mutations handle errors properly
            onError: (err) => {
              console.error("Mutation error:", err);
            },
          },
        },
      }),
  );

  // Using this to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);

  // Create storage persister
  const [persistor] = useState(() => {
    if (typeof window === "undefined") return;

    return createSyncStoragePersister({
      storage: window.localStorage,
      key: "GITVISION_REACT_QUERY_CACHE",
    });
  });

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

  useEffect(() => {
    setMounted(true);

    // Set CSS variables based on theme for toast styling
    const updateToastThemeVars = () => {
      const isDark = document.documentElement.classList.contains("dark");
      document.documentElement.style.setProperty(
        "--toast-bg",
        isDark ? "transparent" : "transparent",
      );
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
      {mounted && persistor ? (
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister: persistor,
              maxAge: 24 * 60 * 60 * 1000, // 24 hours
            }}
          >
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
          </PersistQueryClientProvider>
        </trpc.Provider>
      ) : (
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          enableColorScheme
          disableTransitionOnChange={false}
        >
          {/* Empty placeholder while client initializes */}
          <div style={{ visibility: "hidden" }}></div>
        </ThemeProvider>
      )}
    </ClerkProvider>
  );
};

export default Provider;
