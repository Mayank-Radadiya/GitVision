"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Toggle } from "@/components/ui/toggle";
import { useEffect, useState } from "react";

export default function CustomToggleButton() {
  const { theme, setTheme } = useTheme(); // useTheme is a hook from next-themes
  /* mounted is used to check if the component is mounted
   before rendering the toggle button to avoid hydration issues
   This is a common pattern when using next-themes */
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // If mounted is false, it means the component is not yet mounted
  if (!mounted) return null; // or return fallback JSX

  return (
    <div>
      <Toggle
        variant="outline"
        className="group data-[state=on]:hover:bg-muted size-9 data-[state=on]:bg-transparent relative rounded-full bg-muted/30 p-1 backdrop-blur-sm ring-1 ring-border/50"
        pressed={theme === "dark"}
        onPressedChange={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        <div className="hidden dark:block">
          <MoonIcon size={16} aria-hidden="true" />
        </div>
        <div className="block dark:hidden">
          <SunIcon size={16} aria-hidden="true" />
        </div>
      </Toggle>
    </div>
  );
}
