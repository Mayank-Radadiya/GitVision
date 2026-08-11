/**
 * =============================================================================
 * REPOSITORY URL FIELD — Terminal Echo & Interface Voice
 * =============================================================================
 *
 * A quiet terminal line that echoes the resolved remote. The cursor blinks only
 * while the URL is parsing; once the debounced repo check passes, the Verified
 * chip fades in. No per-keystroke retyping — the echo is deterministic and calm.
 */

"use client";

import { motion } from "framer-motion";
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
  const hasError = !!errors.repoUrl;
  const rawInfo = extractRepoInfo(value);
  const isValid = repoPreview !== null && !hasError;

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

      {/* ─── Terminal Eecho Box ────────────────────────────────────────────── */}
      {value.trim().length > 0 && !hasError && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-gv-hairline bg-gv-graphite-2/50 px-3.5 py-2.5 font-gv-mono text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <div className="flex min-w-0 items-center gap-2">
            <Terminal className="h-3.5 w-3.5 shrink-0 text-gv-wire/80" />
            <span className="truncate text-gv-fog">
              git remote get-url origin
              {rawInfo && (
                <>
                  <span className="text-gv-fog/60"> → </span>
                  <span className="text-gv-bone">
                    {rawInfo.owner}/{rawInfo.repo}
                  </span>
                </>
              )}
            </span>
            {!isValid && (
              <span
                aria-hidden
                className="inline-block h-3 w-1.5 shrink-0 animate-pulse bg-gv-wire/70"
              />
            )}
          </div>

          {isValid && rawInfo && (
            <motion.span
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gv-moss/25 bg-gv-moss/10 px-2 py-0.5 text-[11px] font-semibold text-gv-moss"
            >
              <CheckCircle2 className="h-3 w-3" />
              Verified
            </motion.span>
          )}
        </div>
      )}
    </div>
  );
}