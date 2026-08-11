"use client";

/**
 * Create New Project — Form Orchestrator
 *
 * Architecture:
 * - This file: form state + tRPC mutation wiring + staggered entrance animation
 * - use-create-project.ts: mutation hook (toasts, cache, redirect)
 * - components/: presentational form fields (no data fetching)
 *
 * Staggered entrance animation:
 * - Uses expo-out curve cubic-bezier(0.16, 1, 0.3, 1)
 * - Stagger interval ~120ms, duration 450ms
 */

import { useEffect, useState } from "react";
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
  FeatureChips,
  FormHeader,
  GitGraphBackground,
  ProjectNameField,
  RepositoryUrlField,
  StepTimeline,
  SubmitButton,
} from "./components";

const EXPO_OUT = [0.16, 1, 0.3, 1] as const;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: EXPO_OUT,
    },
  },
};

/** Main form component for creating a new project. */
export default function CreateNewProjectForm() {
  const createProject = useCreateProject();

  // ─── Form setup ─────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<CreateProjectInput>({
    defaultValues: { projectName: "", repoUrl: "" },
    resolver: zodResolver(projectCreateSchema),
    mode: "onChange",
  });

  const projectName = watch("projectName");
  const repoUrl = watch("repoUrl");

  // ─── Repo validation → feeds the living graph (debounced 300ms) ───────────
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
        setRepoPreview(extractRepoInfo(repoUrl));
        setRepoValid(true);
      } else {
        setRepoPreview(null);
        setRepoValid(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [repoUrl, errors.repoUrl]);

  // ─── Derive step from real mutation state ────────────────────────────────
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
      {/* Signature element — the living branch graph behind everything */}
      <GitGraphBackground
        projectName={projectName}
        repoValid={repoValid}
        repoInfo={repoPreview}
        isSubmitting={createProject.isPending}
        isSubmitted={createProject.isSuccess}
      />

      {/* Content — form panel left-of-center so the graph stays in view */}
      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-6 py-8 lg:px-10 lg:py-12">
        <BackLink />

        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mt-10 w-full max-w-[520px] rounded-lg border border-gv-hairline bg-gv-graphite p-7 shadow-2xl sm:p-9 lg:mt-16"
        >
          <motion.div variants={itemVariants}>
            <FormHeader />
          </motion.div>

          <motion.div variants={itemVariants} className="mt-9">
            <StepTimeline currentStep={currentStep} />
          </motion.div>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-9 space-y-7">
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
                errors={errors}
                value={repoUrl}
                isLoading={isLoading}
                repoPreview={repoPreview}
              />
            </motion.div>

            <motion.div variants={itemVariants}>
              <SubmitButton isLoading={isLoading} isValid={isValid} />
            </motion.div>
          </form>

          <motion.div variants={itemVariants} className="mt-9">
            <FeatureChips />
          </motion.div>

          <motion.div variants={itemVariants} className="mt-8 border-t border-gv-hairline pt-6">
            <CreditsGauge />
          </motion.div>
        </motion.section>
      </div>
    </div>
  );
}
