"use client";

/**
 * Preferences & Theme.
 *
 * Two copies of one setting, deliberately:
 *  - next-themes owns localStorage, so the current browser repaints instantly
 *    and works before any network round-trip;
 *  - `users.themePreference` owns the cross-device copy, so a second browser
 *    starts on the right theme.
 *
 * The mount effect is the cross-device path: when the stored value disagrees
 * with what this browser has, the stored value wins. It converges in one write
 * because writing makes the two agree, so no debounce or "did I apply this
 * already" flag is needed.
 */

import { useEffect } from "react";
import { useTheme } from "next-themes";
import toast from "react-hot-toast";

import { trpc } from "@/src/lib/trpc/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

type ThemeOption = (typeof THEME_OPTIONS)[number]["value"];

/** Radix reports the picked string untyped; only the three options are real. */
function isThemeOption(value: string): value is ThemeOption {
  return THEME_OPTIONS.some((option) => option.value === value);
}

export default function ThemePreferenceSection() {
  const { theme, setTheme } = useTheme();
  const utils = trpc.useUtils();

  const { data, isPending } = trpc.user.getPreferences.useQuery(undefined, {
    staleTime: 60_000,
  });
  const stored = data?.themePreference;

  const save = trpc.user.setThemePreference.useMutation({
    onSuccess: ({ theme: saved }) => {
      utils.user.getPreferences.invalidate();
      toast.success(`Theme saved as ${saved}.`);
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    // `theme` is undefined until next-themes has hydrated; acting before that
    // would overwrite the stored preference with the pre-hydration default.
    if (!stored || !theme || stored === theme) return;
    setTheme(stored);
  }, [stored, theme, setTheme]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences &amp; Theme</CardTitle>
        <CardDescription>
          Saved to your account, so it follows you to another browser.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPending || !theme ? (
          <Skeleton className="h-9 w-40" />
        ) : (
          <Select
            value={theme}
            onValueChange={(value) => {
              if (!isThemeOption(value)) return;
              setTheme(value);
              save.mutate({ theme: value });
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THEME_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardContent>
    </Card>
  );
}
