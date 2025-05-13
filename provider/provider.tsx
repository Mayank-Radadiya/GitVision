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
        background: "var(--toast-bg, #fff)",
        color: "var(--toast-text, #333)",
        boxShadow: "0 3px 10px rgba(0, 0, 0, 0.2)",
        borderRadius: "8px",
        padding: "16px",
        fontSize: "14px",
        fontWeight: "500",
        lineHeight: "1.5",
        transition: "all 0.3s ease",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
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
  // Using this to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Set CSS variables based on theme for toast styling
    const updateToastThemeVars = () => {
      const isDark = document.documentElement.classList.contains("dark");
      document.documentElement.style.setProperty(
        "--toast-bg",
        isDark ? "transparent" : "transparent"
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
