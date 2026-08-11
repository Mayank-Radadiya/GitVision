"use client";

/**
 * Create New Project — Form Orchestrator & Dual-Pane Layout
 */

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectCreateSchema } from "@/src/lib/validation/schemas";

import {
  CreateProjectInput,
  RepoInfo,
} from "./add-repo.constants";
import { extractRepoInfo } from "./add-repo.utils";
import { useCreateProject } from "@/features/projects/hooks/use-create-project";
import {
  BackLink,
  CreditsGauge,
  FormHeader,
  GitGraphBackground,
  ProjectNameField,
  RepositoryUrlField,
  StepTimeline,
  SubmitButton,
  LiveRepoPreview,
} from "./components";

const EXPO_OUT = [0.16, 1, 0.3, 1] as const;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: EXPO_OUT,
    },
  },
};

export default function CreateNewProjectForm() {
  const createProject = useCreateProject();

  // ─── Form Setup ──────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<CreateProjectInput>({
    defaultValues: { projectName: "", repoUrl: "" },
    resolver: zodResolver(projectCreateSchema),
    mode: "onChange",
  });

  const projectName = watch("projectName");
  const repoUrl = watch("repoUrl");

  // ─── Repo Validation & Live Graph Feed ──────────────────────────────────
  const [repoPreview, setRepoPreview] = useState<RepoInfo | null>(null);
  const [repoValid, setRepoValid] = useState(false);

  useEffect(() => {
    if (!repoUrl) {
      setRepoPreview(null);
      setRepoValid(false);
      return;
    }
    const t = setTimeout(() => {
      if (!errors.repoUrl) {
        const info = extractRepoInfo(repoUrl);
        setRepoPreview(info);
        setRepoValid(!!info);
      } else {
        setRepoPreview(null);
        setRepoValid(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [repoUrl, errors.repoUrl]);

  // Handle Preset selection
  const handleSelectPreset = useCallback(
    (url: string, name: string) => {
      setValue("repoUrl", url, { shouldValidate: true, shouldTouch: true });
      if (!projectName) {
        setValue("projectName", name, { shouldValidate: true, shouldTouch: true });
      }
    },
    [setValue, projectName],
  );

  // Derive step state
  const currentStep = createProject.isPending
    ? 2
    : createProject.isSuccess
      ? 3
      : 1;
  const isLoading = createProject.isPending;

  const onSubmit = (data: CreateProjectInput) => {
    createProject.mutate(data);
  };

  return (
    <div className="gv-page relative min-h-screen">
      {/* Background branch graph */}
      <GitGraphBackground
        projectName={projectName}
        repoValid={repoValid}
        repoInfo={repoPreview}
        isSubmitting={createProject.isPending}
        isSubmitted={createProject.isSuccess}
      />

      {/* Main Content Layout */}
      <div className="relative z-10 mx-auto w-full max-w-[1320px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-14">
        <BackLink />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mt-6 grid grid-cols-1 gap-8 lg:mt-8 lg:grid-cols-12"
        >
          {/* ─── Left Column: Primary Form Card (7 Cols) ──────────────────── */}
          <section className="lg:col-span-7">
            <div className="gv-card p-6 sm:p-8">
              <FormHeader />

              <div className="mt-7">
                <StepTimeline currentStep={currentStep} />
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
                <motion.div variants={itemVariants}>
                  <ProjectNameField
                    register={register}
                    errors={errors}
                    value={projectName}
                    isLoading={isLoading}
                  />
                </motion.div>

                <motion.div variants={itemVariants}>
                  <RepositoryUrlField
                    register={register}
                    setValue={setValue}
                    errors={errors}
                    value={repoUrl}
                    isLoading={isLoading}
                    repoPreview={repoPreview}
                  />
                </motion.div>

                <motion.div variants={itemVariants} className="pt-2">
                  <SubmitButton isLoading={isLoading} isValid={isValid} />
                </motion.div>
              </form>

              <div className="mt-8 border-t border-gv-hairline/80 pt-6">
                <CreditsGauge />
              </div>
            </div>
          </section>

          {/* ─── Right Column: Live Repository Intelligence (5 Cols) ─────── */}
          <motion.aside variants={itemVariants} className="lg:col-span-5">
            <LiveRepoPreview
              repoInfo={repoPreview}
              repoValid={repoValid}
              onSelectPreset={handleSelectPreset}
            />
          </motion.aside>
        </motion.div>
      </div>
    </div>
  );
}
