"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { Toaster } from "react-hot-toast";
import { memo, useEffect, useState } from "react";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "@/src/lib/trpc/client";
import { makeQueryClient } from "@/src/lib/trpc/query-client";

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
  // Create a client using the factory to ensure consistent configuration (transformers, etc.)
  const [queryClient] = useState(() => makeQueryClient());

  // Using this to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);

  // Create storage persister safely on the client side
  const [persistor, setPersistor] =
    useState<ReturnType<typeof createSyncStoragePersister> | null>(null);

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

    const isBrowser =
      typeof window !== "undefined" &&
      typeof document !== "undefined" &&
      !(typeof process !== "undefined" && process.versions && process.versions.node);

    if (isBrowser) {
      try {
        if (
          window.localStorage &&
          typeof window.localStorage.getItem === "function"
        ) {
          const p = createSyncStoragePersister({
            storage: window.localStorage,
            key: "GITVISION_REACT_QUERY_CACHE",
          });
          setPersistor(p);
        }
      } catch {
        // Storage might be restricted (e.g. private browsing)
      }
    }

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
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          enableColorScheme
          disableTransitionOnChange={false}
        >
          {!mounted ? (
            <div style={{ visibility: "hidden" }} />
          ) : persistor ? (
            <PersistQueryClientProvider
              client={queryClient}
              persistOptions={{
                persister: persistor,
                maxAge: 24 * 60 * 60 * 1000,
              }}
            >
              <MemoizedToaster />
              {children}
            </PersistQueryClientProvider>
          ) : (
            <>
              <MemoizedToaster />
              {children}
            </>
          )}
        </ThemeProvider>
      </trpc.Provider>
    </ClerkProvider>
  );
};
export default Provider;
