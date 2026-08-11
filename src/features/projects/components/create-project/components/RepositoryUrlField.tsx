/**
 * =============================================================================
 * REPOSITORY URL FIELD — Live Terminal & Interface Voice (Brief § Signature Moment)
 * =============================================================================
 *
 * Features:
 * 1. Monospace terminal echo line directly under the input field.
 * 2. Typewriter animation (~30 cps): "resolving {owner}/{repo}…" → "found."
 * 3. Detected badge: "Found {owner}/{repo}" in git-diff green (--diff-add-500).
 * 4. Validation failure: Single border pulse in --diff-remove-500 and inline copy
 *    "Can't find that repository. Check the URL and try again."
 * 5. Reduced motion: Instant text display without typewriter delays.
 */

"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, CheckCircle2, Terminal } from "lucide-react";
import { Field } from "./Field";
import type { UseFormRegister, FieldErrors } from "react-hook-form";
import type { CreateProjectInput, RepoInfo } from "../add-repo.constants";
import { extractRepoInfo } from "../add-repo.utils";

interface RepositoryUrlFieldProps {
  register: UseFormRegister<CreateProjectInput>;
  errors: FieldErrors<CreateProjectInput>;
  value: string;
  isLoading: boolean;
  repoPreview: RepoInfo | null;
}

export function RepositoryUrlField({
  register,
  errors,
  value,
  isLoading,
  repoPreview,
}: RepositoryUrlFieldProps) {
  const reduced = useReducedMotion();
  const hasError = !!errors.repoUrl;
  const isValid = repoPreview !== null && !hasError;
  const rawInfo = extractRepoInfo(value);

  // ─── Terminal Typewriter Effect (~30 cps = ~33ms/char) ───────────────────
  const [displayedText, setDisplayedText] = useState("");
  const [isDoneTyping, setIsDoneTyping] = useState(false);

  // Formulate full target terminal string
  const targetMessage = rawInfo
    ? `resolving ${rawInfo.owner}/${rawInfo.repo}…`
    : value.length > 5
      ? `resolving target repository…`
      : "";

  useEffect(() => {
    if (!targetMessage) {
      setDisplayedText("");
      setIsDoneTyping(false);
      return;
    }

    if (reduced) {
      setDisplayedText(targetMessage);
      setIsDoneTyping(true);
      return;
    }

    // Reset and typewriter increment
    setDisplayedText("");
    setIsDoneTyping(false);
    let index = 0;
    const timer = setInterval(() => {
      index++;
      if (index <= targetMessage.length) {
        setDisplayedText(targetMessage.slice(0, index));
      } else {
        setIsDoneTyping(true);
        clearInterval(timer);
      }
    }, 33); // ~30 cps

    return () => clearInterval(timer);
  }, [targetMessage, reduced]);

  return (
    <div className="space-y-3">
      <Field
        id="repoUrl"
        label="GitHub Repository URL"
        type="url"
        autoComplete="off"
        value={value}
        disabled={isLoading}
        ariaInvalid={hasError}
        registration={register("repoUrl")}
        helper={
          hasError ? (
            <div className="flex items-center gap-2 font-gv-mono text-xs text-gv-ember animate-pulse-once">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>Can&apos;t find that repository. Check the URL and try again.</span>
            </div>
          ) : isValid ? (
            <div className="flex items-center gap-2 font-gv-mono text-xs text-gv-moss">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-gv-moss" />
              <span>Found {repoPreview.owner}/{repoPreview.repo}</span>
            </div>
          ) : (
            <span className="font-gv-mono text-xs text-gv-fog">
              Full GitHub URL, e.g. https://github.com/owner/repo
            </span>
          )
        }
      />

      {/* ─── Signature Terminal Echo Line ──────────────────────────────────── */}
      {value.trim().length > 0 && !hasError && (
        <div className="flex items-center gap-2 rounded-md border border-gv-hairline bg-gv-graphite-2 px-3 py-2 font-gv-mono text-xs text-gv-bone">
          <Terminal className="h-3.5 w-3.5 shrink-0 text-gv-wire" />
          <div className="flex items-center gap-1">
            <span className="text-gv-fog">{displayedText}</span>
            {isValid && isDoneTyping && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-semibold text-gv-moss"
              >
                found.
              </motion.span>
            )}
            {!isDoneTyping && !reduced && (
              <span className="inline-block h-3 w-1.5 animate-pulse bg-gv-wire" />
            )}
          </div>
        </div>
      )}

      {/* ─── Detected Badge: "Found {owner}/{repo}" ────────────────────────── */}
      <AnimatePresence>
        {isValid && repoPreview && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-md border border-gv-moss/30 bg-gv-moss/10 px-2.5 py-1 font-gv-mono text-xs text-gv-moss">
              <span className="opacity-70">Found</span>
              <span className="font-semibold">{repoPreview.owner}</span>
              <span className="opacity-50">/</span>
              <span className="font-semibold">{repoPreview.repo}</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
