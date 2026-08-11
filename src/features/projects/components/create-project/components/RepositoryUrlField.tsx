/**
 * =============================================================================
 * REPOSITORY URL FIELD — IDE Command Prompt & Terminal Craftsmanship
 * =============================================================================
 */

"use client";

import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Terminal, Clipboard } from "lucide-react";
import { Field } from "./Field";
import type {
  UseFormRegister,
  FieldErrors,
  UseFormSetValue,
} from "react-hook-form";
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
        setValue("repoUrl", text.trim(), {
          shouldValidate: true,
          shouldTouch: true,
        });
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
              className="inline-flex cursor-pointer items-center gap-1.5 font-gv-mono text-[10px] text-gv-fog transition-colors hover:text-gv-amber"
              title="Paste URL from clipboard (⌘V)"
            >
              <Clipboard className="h-3 w-3 text-gv-amber" />
              <span>Paste</span>
              <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.2 font-mono text-[9px] text-gv-fog/80">
                ⌘V
              </kbd>
            </button>
          ) : null
        }
        helper={
          hasError ? (
            <div className="flex items-center gap-2 font-gv-mono text-xs text-gv-ember">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>
                Can&apos;t resolve repository. Please verify URL (e.g.
                https://github.com/owner/repo).
              </span>
            </div>
          ) : (
            <span className="font-gv-mono text-xs text-gv-fog/80">
              HTTPS GitHub URL to map tree architecture and dependencies.
            </span>
          )
        }
      />

      {/* ─── IDE Command Prompt Box ────────────────────────────────────────── */}
      {value.trim().length > 0 && !hasError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-gv-graphite-2/60 px-4 py-2.5 font-gv-mono text-xs shadow-[inset_0_1px_1px_rgba(0,0,0,0.4)]">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-gv-wire animate-pulse" />
            <Terminal className="h-3.5 w-3.5 shrink-0 text-gv-wire/80" />
            <span className="truncate text-gv-fog">
              $ git remote get-url origin
              {rawInfo && (
                <>
                  <span className="text-gv-fog/60"> → </span>
                  <span className="font-semibold text-gv-bone">
                    {rawInfo.owner}/{rawInfo.repo}
                  </span>
                </>
              )}
            </span>
          </div>

          {isValid && rawInfo && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gv-moss/30 bg-gv-moss/10 px-2.5 py-0.5 text-[11px] font-semibold text-gv-moss"
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
