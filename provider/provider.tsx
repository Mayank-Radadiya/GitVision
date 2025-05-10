"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { Toaster } from "react-hot-toast";
import { memo, useEffect, useState } from "react";

interface ProviderProps {
  children: React.ReactNode;
}

// Memoized Toaster component to prevent unnecessary re-renders
const MemoizedToaster = memo(() => (
  <Toaster
    position="bottom-right"
    toastOptions={{
      style: {
        background: "var(--toast-bg, #333)",
        color: "var(--toast-text, #fff)",
        boxShadow: "0 3px 10px rgba(0, 0, 0, 0.2)",
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
  // Using this to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Set CSS variables based on theme for toast styling
    const updateToastThemeVars = () => {
      const isDark = document.documentElement.classList.contains("dark");
      document.documentElement.style.setProperty(
        "--toast-bg",
        isDark ? "#333" : "#fff"
      );
      document.documentElement.style.setProperty(
        "--toast-text",
        isDark ? "#fff" : "#333"
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
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        enableColorScheme
        disableTransitionOnChange={false}
      >
        {/* Only render UI when mounted to prevent hydration mismatch */}
        {mounted && (
          <>
            <MemoizedToaster />
            {children}
          </>
        )}
      </ThemeProvider>
    </ClerkProvider>
  );
};

export default Provider;
