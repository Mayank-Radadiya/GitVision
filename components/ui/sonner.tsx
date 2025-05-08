"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: `
            bg-white/5 
            backdrop-blur-xl 
            border 
            border-white/10 
            text-white 
            shadow-xl 
            rounded-xl 
            transition-all 
            duration-300
            ease-in-out
            hover:bg-white/8
            bg-gradient-to-br from-white/10 to-white/5
          `,
          title: "text-base font-semibold",
          description: "text-sm text-white/90",
          actionButton:
            "bg-white/20 text-white hover:bg-white/30 transition-colors",
          cancelButton: "text-white/70 hover:text-white transition-colors",
        },
      }}
      style={
        {
          "--normal-bg": "transparent",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "rgba(255, 255, 255, 0.1)",
          "--toast-shadow":
            "0 4px 12px rgba(0, 0, 0, 0.1), 0 0 1px rgba(255, 255, 255, 0.05)",
          "--z-index": "100",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
