/**
 * PRESET PILLS — Idle-state sample repositories
 *
 * The URL field is the only thing shown while idle; these pills are the escape
 * hatch for someone who has no repo in mind. They fill the field rather than
 * submitting, so the rest of the form reveals through the normal path.
 */

"use client";

import { useReducedMotion } from "framer-motion";
import { motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import type { PresetRepo, RepoInfo } from "../add-repo.constants";

interface PresetPillsProps {
  presets: PresetRepo[];
  /** Currently parsed owner/repo, used to mark a pill as selected. */
  repoInfo: RepoInfo | null;
  onSelectPreset: (url: string, name: string) => void;
  disabled?: boolean;
}

export function PresetPills({
  presets,
  repoInfo,
  onSelectPreset,
  disabled = false,
}: PresetPillsProps) {
  const reduced = useReducedMotion();

  return (
    <div className="space-y-3">
      <p className="font-gv-mono text-gv-fog/80 text-xs">
        Try a sample{" "}
        <span aria-hidden="true" className="text-gv-fog/50">
          →
        </span>
      </p>

      <ul className="flex flex-wrap gap-2">
        {presets.map((preset, index) => {
          const isSelected =
            repoInfo?.owner === preset.owner && repoInfo?.repo === preset.repo;

          return (
            <motion.li
              key={preset.key}
              initial={reduced ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.18,
                ease: "easeOut",
                delay: reduced ? 0 : index * 0.04,
              }}
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelectPreset(preset.url, preset.name)}
                aria-pressed={isSelected}
                className={cn(
                  "font-gv-mono inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-150",
                  isSelected
                    ? "border-gv-amber/50 bg-gv-amber/15 text-gv-amber"
                    : "border-gv-hairline bg-gv-graphite-2/50 text-gv-fog hover:border-white/20 hover:bg-gv-graphite-2 hover:text-gv-bone",
                  disabled && "cursor-not-allowed opacity-50",
                )}
              >
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: preset.accentColor }}
                />
                <span>{preset.name}</span>
                <kbd
                  aria-hidden="true"
                  className="font-gv-mono text-gv-fog/50 border-gv-hairline rounded border px-1 text-[9px]"
                >
                  {preset.key}
                </kbd>
              </button>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}