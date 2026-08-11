/**
 * =============================================================================
 * REPOSITORY URL FIELD — Terminal Echo & Interface Voice
 * =============================================================================
 */

"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle, CheckCircle2, Terminal, Clipboard } from "lucide-react";
import { Field } from "./Field";
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
  const reduced = useReducedMotion();
  const hasError = !!errors.repoUrl;
  const isValid = repoPreview !== null && !hasError;
  const rawInfo = extractRepoInfo(value);

  // ─── Terminal Typewriter Effect (~30 cps = ~33ms/char) ───────────────────
  const [displayedText, setDisplayedText] = useState("");
  const [isDoneTyping, setIsDoneTyping] = useState(false);

  // Formulate full target terminal string
  const targetMessage = rawInfo
    ? `git remote get-url origin → ${rawInfo.owner}/${rawInfo.repo}`
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
    }, 33);

    return () => clearInterval(timer);
  }, [targetMessage, reduced]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && setValue) {
        setValue("repoUrl", text.trim(), { shouldValidate: true });
      }
    } catch {
      // Clipboard access denied or unsupported
    }
  };

  return (
    <div className="space-y-3">
      <Field
        id="repoUrl"
        label="GitHub Repository URL"
        type="url"
        placeholder="https://github.com/owner/repository"
        autoComplete="off"
        value={value}
        disabled={isLoading}
        ariaInvalid={hasError}
        registration={register("repoUrl")}
        actionButton={
          setValue ? (
            <button
              type="button"
              onClick={handlePaste}
              className="inline-flex cursor-pointer items-center gap-1 font-gv-mono text-[10px] text-gv-fog transition-colors hover:text-gv-amber"
              title="Paste URL from clipboard"
            >
              <Clipboard className="h-3 w-3" />
              <span>Paste URL</span>
            </button>
          ) : null
        }
        helper={
          hasError ? (
            <div className="flex items-center gap-2 font-gv-mono text-xs text-gv-ember">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>Can&apos;t find repository. Check the URL (e.g. https://github.com/owner/repo).</span>
            </div>
          ) : (
            <span className="font-gv-mono text-xs text-gv-fog/80">
              Paste the public HTTPS GitHub URL to connect your codebase.
            </span>
          )
        }
      />

      {/* ─── Sleek Terminal Preview Box ────────────────────────────────────── */}
      {value.trim().length > 0 && !hasError && (
        <div className="flex items-center justify-between rounded-lg border border-gv-hairline bg-gv-graphite-2/80 px-3.5 py-2.5 font-gv-mono text-xs shadow-inner">
          <div className="flex items-center gap-2 overflow-hidden">
            <Terminal className="h-3.5 w-3.5 shrink-0 text-gv-wire" />
            <span className="truncate text-gv-fog">{displayedText}</span>
            {!isDoneTyping && !reduced && (
              <span className="inline-block h-3 w-1.5 shrink-0 animate-pulse bg-gv-wire" />
            )}
          </div>

          {isValid && isDoneTyping && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-gv-moss/30 bg-gv-moss/10 px-2 py-0.5 font-semibold text-gv-moss"
            >
              <CheckCircle2 className="h-3 w-3" />
              <span>Verified</span>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
