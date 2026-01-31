"use client";

/**
 * =============================================================================
 * CREATE NEW PROJECT FORM
 * =============================================================================
 *
 * Production-ready form for adding GitHub repositories.
 *
 * ARCHITECTURE:
 * - add-repo.tsx (this file) - Main orchestrator
 * - add-repo.constants.ts - Types, steps, animations
 * - add-repo.utils.ts - URL parsing, helpers
 * - components/
 *   ├── FormHeader.tsx - Animated header
 *   ├── ProgressSteps.tsx - Step indicator
 *   ├── ProjectNameField.tsx - Name input
 *   ├── RepositoryUrlField.tsx - URL input with preview
 *   ├── SubmitButton.tsx - Submit button
 *   └── InfoCards.tsx - Feature highlights
 *
 * @module components/dashboard/create-new-project
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { repositoryZodSchema } from "@/zodSchema/repository.schema";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// Local imports
import { FormData, CARD_ANIMATION } from "./add-repo.constants";
import { extractRepoInfo, delay } from "./add-repo.utils";
import {
  FormHeader,
  ProgressSteps,
  ProjectNameField,
  RepositoryUrlField,
  SubmitButton,
  InfoCards,
} from "./components";

/**
 * Main form component for creating a new project
 */
export default function CreateNewProjectForm() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [repoPreview, setRepoPreview] = useState<{
    owner: string;
    repo: string;
  } | null>(null);

  // Form setup
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid, dirtyFields },
  } = useForm<FormData>({
    defaultValues: {
      ProjectName: "",
      repoUrl: "",
    },
    resolver: zodResolver(repositoryZodSchema),
    mode: "onChange",
  });

  // Watch URL for preview
  const repoUrl = watch("repoUrl");

  useEffect(() => {
    if (repoUrl && !errors.repoUrl) {
      const info = extractRepoInfo(repoUrl);
      setRepoPreview(info);
    } else {
      setRepoPreview(null);
    }
  }, [repoUrl, errors.repoUrl]);

  /**
   * Handle form submission
   */
  const handleAddRepository = async (data: FormData) => {
    try {
      setIsLoading(true);
      setCurrentStep(2);

      // Simulate validation
      await delay(800);
      setCurrentStep(3);

      const response = await axios.post("/api/project/createProject", {
        ProjectName: data.ProjectName,
        repoUrl: data.repoUrl,
      });

      if (response.status !== 200) {
        throw new Error("Failed to add repository");
      }

      toast.success("Repository added successfully!", {
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      });

      // Refetch dashboard data
      await queryClient.refetchQueries({ queryKey: ["dashboardInfo"] });
      await queryClient.refetchQueries({ queryKey: ["userProjects"] });

      // Redirect with animation delay
      setTimeout(() => {
        router.push("/dashboard");
      }, 500);
    } catch (error) {
      console.error("Error adding repository:", error);
      setCurrentStep(1);
      toast.error("Failed to add repository. Please try again.", {
        icon: <AlertCircle className="h-4 w-4 text-rose-500" />,
      });
    } finally {
      setIsLoading(false);
    }
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
            className="mb-6 gap-2 hover:bg-accent/50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </motion.div>

        {/* Main Card */}
        <motion.div {...CARD_ANIMATION} className="group">
          <div
            className={cn(
              // Base styles
              "relative overflow-hidden rounded-3xl border",
              // Glassmorphism
              "bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl",
              // Border & Shadow
              "border-border/50",
              "shadow-2xl shadow-black/10 dark:shadow-black/40",
              "hover:shadow-primary/5 transition-shadow duration-500",
            )}
          >
            {/* Gradient Accents */}
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-primary/20 to-violet-500/20 opacity-60 blur-3xl" />
            <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-gradient-to-tr from-blue-500/10 to-cyan-500/10 opacity-40 blur-3xl" />

            {/* Content */}
            <div className="relative z-10 p-8 lg:p-10">
              {/* Header */}
              <FormHeader />

              {/* Progress Steps */}
              <ProgressSteps currentStep={currentStep} />

              {/* Form */}
              <form
                onSubmit={handleSubmit(handleAddRepository)}
                className="space-y-6"
              >
                {/* Project Name Field */}
                <ProjectNameField
                  register={register}
                  errors={errors}
                  isDirty={!!dirtyFields.ProjectName}
                  isLoading={isLoading}
                />

                {/* Repository URL Field */}
                <RepositoryUrlField
                  register={register}
                  errors={errors}
                  isDirty={!!dirtyFields.repoUrl}
                  isLoading={isLoading}
                  repoPreview={repoPreview}
                />

                {/* Submit Button */}
                <SubmitButton
                  isLoading={isLoading}
                  isValid={isValid}
                  currentStep={currentStep}
                />
              </form>

              {/* Info Cards */}
              <InfoCards />
            </div>

            {/* Bottom Gradient Line */}
            <div
              className={cn(
                "absolute bottom-0 left-0 right-0 h-1",
                "bg-gradient-to-r from-primary via-violet-500 to-primary",
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
