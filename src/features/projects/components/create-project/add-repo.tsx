"use client";

/**
 * Create New Project — Form Orchestrator
 *
 * Architecture:
 * - This file: form state + tRPC mutation wiring
 * - use-create-project.ts: mutation hook (toasts, cache, redirect)
 * - components/: presentational form fields (no data fetching)
 *
 * tRPC mutation replaces the old axios.post("/api/project/createProject").
 * Progress steps now reflect real mutation state instead of fake delays.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectCreateSchema } from "@/src/lib/validation/schemas";
import { cn } from "@/shared/lib/utils";

import { CreateProjectInput, CARD_ANIMATION } from "./add-repo.constants";
import { extractRepoInfo } from "./add-repo.utils";
import { useCreateProject } from "@/features/projects/hooks/use-create-project";
import {
  FormHeader,
  ProgressSteps,
  ProjectNameField,
  RepositoryUrlField,
  SubmitButton,
  InfoCards,
} from "./components";

/**
 * Main form component for creating a new project.
 * Uses tRPC project.create mutation via useCreateProject() hook.
 */
export default function CreateNewProjectForm() {
  const router = useRouter();
  const createProject = useCreateProject();

  // ─── Form setup ─────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid, dirtyFields },
  } = useForm<CreateProjectInput>({
    defaultValues: { projectName: "", repoUrl: "" },
    resolver: zodResolver(projectCreateSchema),
    mode: "onChange",
  });

  // ─── Repo preview (extracted from URL) ──────────────────────────────────
  const repoUrl = watch("repoUrl");
  const [repoPreview, setRepoPreview] = useState<{
    owner: string;
    repo: string;
  } | null>(null);

  useEffect(() => {
    if (repoUrl && !errors.repoUrl) {
      setRepoPreview(extractRepoInfo(repoUrl));
    } else {
      setRepoPreview(null);
    }
  }, [repoUrl, errors.repoUrl]);

  // ─── Derive step from mutation state (real progress, not fake delays) ──
  const currentStep = createProject.isPending
    ? 2
    : createProject.isSuccess
      ? 3
      : 1;
  const isLoading = createProject.isPending;

  // ─── Submit handler ─────────────────────────────────────────────────────
  const onSubmit = (data: CreateProjectInput) => {
    createProject.mutate(data);
  };

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="mx-auto max-w-2xl">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard")}
            className="mb-6 gap-2 hover:bg-accent/50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </motion.div>

        {/* Main Card */}
        <motion.div {...CARD_ANIMATION} className="group">
          <div
            className={cn(
              "relative overflow-hidden rounded-3xl border",
              "bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl",
              "border-border/50",
              "shadow-2xl shadow-black/10 dark:shadow-black/40",
              "hover:shadow-primary/5 transition-shadow duration-500",
            )}
          >
            {/* Gradient Accents */}
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-primary/20 to-orange-500/20 opacity-60 blur-3xl" />
            <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-gradient-to-tr from-blue-500/10 to-cyan-500/10 opacity-40 blur-3xl" />

            {/* Content */}
            <div className="relative z-10 p-8 lg:p-10">
              <FormHeader />
              <ProgressSteps currentStep={currentStep} />

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <ProjectNameField
                  register={register}
                  errors={errors}
                  isDirty={!!dirtyFields.projectName}
                  isLoading={isLoading}
                />

                <RepositoryUrlField
                  register={register}
                  errors={errors}
                  isDirty={!!dirtyFields.repoUrl}
                  isLoading={isLoading}
                  repoPreview={repoPreview}
                />

                <SubmitButton
                  isLoading={isLoading}
                  isValid={isValid}
                  currentStep={currentStep}
                />
              </form>

              <InfoCards />
            </div>

            {/* Bottom Gradient Line — visible when form is valid */}
            <div
              className={cn(
                "absolute bottom-0 left-0 right-0 h-1",
                "bg-gradient-to-r from-primary via-orange-500 to-primary",
                "opacity-0 transition-opacity duration-500",
                isValid && !isLoading && "opacity-100",
              )}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
