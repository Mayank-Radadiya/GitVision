/**
 * REPOSITORY URL FIELD — Hero Input with Instant Validation & Clipboard Controls
 */

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  X,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { UseFormRegister, FieldErrors, UseFormSetValue } from "react-hook-form";
import type { CreateProjectInput, RepoInfo } from "../add-repo.constants";
import { extractRepoInfo } from "../add-repo.utils";

interface RepositoryUrlFieldProps {
  register: UseFormRegister<CreateProjectInput>;
  setValue?: UseFormSetValue<CreateProjectInput>;
  errors: FieldErrors<CreateProjectInput>;
  value: string;
  isLoading: boolean;
  repoPreview: RepoInfo | null;
}

export function RepositoryUrlField({
  register,
  setValue,
  errors,
  value,
  isLoading,
  repoPreview,
}: RepositoryUrlFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [justPasted, setJustPasted] = useState(false);

  const hasError = !!errors.repoUrl;
  const rawInfo = extractRepoInfo(value);
  const isValid = repoPreview !== null && !hasError;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && setValue) {
        setValue("repoUrl", text.trim(), {
          shouldValidate: true,
          shouldTouch: true,
        });
        setJustPasted(true);
        setTimeout(() => setJustPasted(false), 1500);
      }
    } catch {
      // Clipboard access denied or unsupported
    }
  };

  const handleClear = () => {
    if (setValue) {
      setValue("repoUrl", "", { shouldValidate: true, shouldTouch: true });
    }
  };

  const registration = register("repoUrl");

  return (
    <div className="space-y-2.5">
      {/* Top Label & Action Bar */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="repoUrl"
            className={cn(
              "font-gv-mono text-[11px] font-semibold tracking-wider uppercase transition-colors duration-200",
              isFocused ? "text-gv-amber" : "text-gv-fog",
            )}
          >
            GitHub URL
          </label>
          <span aria-hidden="true" className="text-gv-amber text-xs font-bold">
            *
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Paste Button */}
          {setValue && (
            <button
              type="button"
              onClick={handlePaste}
              disabled={isLoading}
              className={cn(
                "group font-gv-mono inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium transition-all duration-150 cursor-pointer",
                justPasted
                  ? "bg-gv-moss/20 text-gv-moss border border-gv-moss/30"
                  : "bg-gv-graphite-2/60 text-gv-fog hover:text-gv-bone hover:bg-gv-graphite-2 border border-white/6",
              )}
              title="Paste from clipboard (⌘V)"
            >
              <Clipboard className="h-3 w-3 text-gv-amber transition-transform group-hover:scale-110" />
              <span>{justPasted ? "Pasted!" : "Paste"}</span>
              <kbd className="border-gv-hairline bg-gv-graphite text-gv-fog/80 rounded border px-1 py-0.2 font-mono text-[9px]">
                ⌘V
              </kbd>
            </button>
          )}

          {/* Clear Button */}
          {value && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gv-fog/70 hover:text-gv-bone hover:bg-gv-graphite-2 rounded p-0.5 transition-colors cursor-pointer"
              title="Clear input"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Input Field Container */}
      <div className="relative">
        <div
          className={cn(
            "relative flex items-center rounded-xl border bg-gv-graphite-2/90 transition-[border-color,background-color,box-shadow] duration-[120ms] ease-out",
            isFocused
              ? "border-gv-amber/70 bg-gv-graphite-2 shadow-[0_0_0_1px_rgba(232,163,61,0.4),0_0_16px_rgba(232,163,61,0.1)]"
              : "border-white/8 hover:border-white/14 shadow-[inset_0_1px_1px_rgba(0,0,0,0.5)]",
            hasError &&
              "border-gv-ember/80 focus-within:border-gv-ember focus-within:ring-2 focus-within:ring-gv-ember/20 gv-input-error",
            isLoading ? "cursor-not-allowed opacity-60" : "",
          )}
        >
          {/* Prefix Icon */}
          <div className="pl-3.5 pr-1 text-gv-fog/70 select-none">
            <svg
              className="h-4 w-4 fill-current"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
          </div>

          {/* Actual Input */}
          <input
            {...registration}
            id="repoUrl"
            type="url"
            disabled={isLoading}
            aria-invalid={hasError}
            aria-describedby={hasError ? "repoUrl-error" : "repoUrl-hint"}
            placeholder="https://github.com/owner/repo"
            autoComplete="off"
            spellCheck="false"
            onFocus={() => setIsFocused(true)}
            onBlur={(e) => {
              setIsFocused(false);
              registration.onBlur(e);
            }}
            className="font-gv-mono text-gv-bone placeholder:text-gv-fog/40 w-full bg-transparent px-2.5 py-3 text-sm focus:outline-none"
          />

          {/* Status Indicator inside right of input */}
          <div className="pr-3">
            {isValid && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="text-gv-moss inline-flex items-center gap-1 text-xs font-semibold"
              >
                <CheckCircle2 className="h-4 w-4" />
              </motion.span>
            )}
            {hasError && (
              <AlertCircle className="text-gv-ember h-4 w-4" />
            )}
          </div>
        </div>
      </div>

      {/* Helper / Error / Verified strip */}
      <AnimatePresence mode="wait">
        {hasError ? (
          <motion.div
            key="error"
            id="repoUrl-error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="font-gv-mono text-gv-ember flex items-center gap-1.5 text-xs"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{errors.repoUrl?.message || "Invalid GitHub repository URL format."}</span>
          </motion.div>
        ) : isValid && rawInfo ? (
          <motion.div
            key="verified"
            role="status"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="bg-gv-moss/10 border-gv-moss/20 text-gv-moss flex items-center justify-between rounded-lg border px-3 py-1.5 font-gv-mono text-xs"
          >
            <div className="flex items-center gap-2 truncate">
              <span className="text-gv-bone font-medium truncate">
                {rawInfo.owner} <span className="text-gv-fog">/</span> {rawInfo.repo}
              </span>
            </div>
            <a
              href={`https://github.com/${rawInfo.owner}/${rawInfo.repo}`}
              target="_blank"
              rel="noreferrer"
              className="text-gv-fog hover:text-gv-bone inline-flex items-center gap-1 text-[11px] underline-offset-2 hover:underline ml-2 shrink-0"
            >
              <span>GitHub</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </motion.div>
        ) : (
          <motion.div
            key="hint"
            id="repoUrl-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-gv-mono text-gv-fog/80 text-xs"
          >
            Public repositories only. Private repos are not supported.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
