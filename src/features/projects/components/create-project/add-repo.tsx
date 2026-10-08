"use client";

/**
 * CREATE NEW PROJECT — Single-Column Progressive Reveal
 *
 * The URL field is the only input present while idle. Everything else — project
 * name, the credit ledger, and the CTA — reveals from it once the URL parses to
 * owner/repo, so the page never shows two questions at once.
 */

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectCreateSchema } from "@/src/lib/validation/schemas";
import { useCredits } from "@/features/dashboard/hooks/use-dashboard";

import {
  CreateProjectInput,
  RepoInfo,
  PRESETS,
  PROJECT_CREATION_COST,
} from "./add-repo.constants";
import { extractRepoInfo, deriveProjectName } from "./add-repo.utils";
import { useCreateProject } from "@/features/projects/hooks/use-create-project";
import {
  BackLink,
  ConfirmationCard,
  PageHeader,
  PresetPills,
  ProjectNameField,
  RepositoryUrlField,
  SubmitButton,
} from "./components";

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

const REVEAL_OUT = { opacity: 0, y: 8 };
const REVEAL_IN = {
  opacity: 1,
  y: 0,
  transition: { duration: 0.22, ease: EASE_OUT_EXPO },
};
const HIDE_OUT = {
  opacity: 0,
  y: 4,
  transition: { duration: 0.15, ease: "easeIn" as const },
};

export default function CreateNewProjectForm() {
  const createProject = useCreateProject();
  const { data: credits } = useCredits();
  const reduced = useReducedMotion();

  // While the balance is in flight it is unknown, not zero. Treating it as
  // anything concrete either blocks a paying user or waves through a broke one,
  // so the gate stays open and ConfirmationCard renders a dash instead.
  const hasEnoughCredits = credits === undefined || credits >= PROJECT_CREATION_COST;

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors, isValid },
  } = useForm<CreateProjectInput>({
    defaultValues: { projectName: "", repoUrl: "" },
    resolver: zodResolver(projectCreateSchema),
    mode: "onChange",
  });

  const projectName = watch("projectName");
  const repoUrl = watch("repoUrl");

  // ─── Deep Link: ?url= from the landing hero ──────────────────────────────
  const searchParams = useSearchParams();
  const urlParam = searchParams.get("url")?.trim() ?? "";

  useEffect(() => {
    if (!urlParam) return;
    const info = extractRepoInfo(urlParam);
    const derived = info ? deriveProjectName(info.repo) : "";

    reset((prevValues) => ({
      ...prevValues,
      repoUrl: urlParam,
      projectName: prevValues.projectName || derived,
    }));
  }, [urlParam, reset]);

  // ─── Debounced repo parse — the reveal trigger ───────────────────────────
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);

  useEffect(() => {
    if (!repoUrl || errors.repoUrl) {
      setRepoInfo(null);
      return;
    }
    const t = setTimeout(() => setRepoInfo(extractRepoInfo(repoUrl)), 200);
    return () => clearTimeout(t);
  }, [repoUrl, errors.repoUrl]);

  const repoValid = repoInfo !== null;

  // ─── Presets ────────────────────────────────────────────────────────────
  const handleSelectPreset = useCallback(
    (url: string, name: string) => {
      setValue("repoUrl", url, { shouldValidate: true, shouldTouch: true });
      setValue("projectName", name, {
        shouldValidate: true,
        shouldTouch: true,
      });
    },
    [setValue],
  );

  const onSubmit = useCallback(
    (data: CreateProjectInput) => {
      if (!hasEnoughCredits) return;
      createProject.mutate(data);
    },
    [createProject, hasEnoughCredits],
  );

  // ─── Keyboard Shortcuts (⌘/Ctrl+Enter submit & 1-3 presets) ──────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (isValid && hasEnoughCredits && !createProject.isPending) {
          e.preventDefault();
          handleSubmit(onSubmit)();
        }
      }

      const activeElement = document.activeElement;
      const isInputActive =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          (activeElement as HTMLElement).isContentEditable);

      if (!isInputActive && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const matched = PRESETS.find((p) => p.key === e.key);
        if (matched) {
          e.preventDefault();
          handleSelectPreset(matched.url, matched.name);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleSubmit,
    isValid,
    hasEnoughCredits,
    createProject.isPending,
    onSubmit,
    handleSelectPreset,
  ]);

  const isLoading = createProject.isPending;

  return (
    <div className="gv-page relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="bg-grid-small-white pointer-events-none absolute inset-0 opacity-40"
      />

      <div className="relative mx-auto w-full max-w-[600px] px-5 py-8 sm:px-6 sm:py-12">
        <div className="mb-6">
          <BackLink />
        </div>

        <div className="space-y-6">
          <PageHeader />

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <RepositoryUrlField
              register={register}
              setValue={setValue}
              errors={errors}
              value={repoUrl}
              isLoading={isLoading}
              repoPreview={repoInfo}
            />

            {/* Presets are the idle affordance; once a repo is parsed the rest
                of the form takes over the same slot. */}
            <AnimatePresence initial={false} mode="wait">
              {!repoValid ? (
                <motion.div
                  key="presets"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.2 }}
                >
                  <PresetPills
                    presets={PRESETS}
                    repoInfo={repoInfo}
                    onSelectPreset={handleSelectPreset}
                    disabled={isLoading}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {repoValid ? (
                <motion.div
                  key="revealed"
                  className="space-y-6"
                  initial={reduced ? false : REVEAL_OUT}
                  animate={REVEAL_IN}
                  exit={reduced ? undefined : HIDE_OUT}
                >
                  <ProjectNameField
                    register={register}
                    setValue={setValue}
                    errors={errors}
                    value={projectName}
                    repoUrl={repoUrl}
                    isLoading={isLoading}
                  />

                  <ConfirmationCard repoInfo={repoInfo} />

                  <SubmitButton
                    isLoading={isLoading}
                    isValid={isValid}
                    disabled={!hasEnoughCredits}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </form>
        </div>
      </div>
    </div>
  );
}