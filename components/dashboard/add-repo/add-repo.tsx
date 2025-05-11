"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { repositoryZodSchema } from "@/zodSchema/repository.schema";
import toast from "react-hot-toast";

export default function AddRepositoryForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Form
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof repositoryZodSchema>>({
    defaultValues: {
      ProjectName: "",
      repoUrl: "",
    },
    resolver: zodResolver(repositoryZodSchema),
  });

  const handleAddRepository = async (
    data: z.infer<typeof repositoryZodSchema>
  ) => {
    try {
      setIsLoading(true);

      // Here you would add your API call to add the repository
      // For example:
      // await addRepository(data);

      // Simulate API call
      router.push("/dashboard");
    } catch (error) {
      console.error("Error adding repository:", error);
      toast.error("Failed to add repository. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="border hover:border-white/30 transition-all duration-500 shadow-xl backdrop-blur-sm bg-background/50">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <GitBranch className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold bg-gradient-to-br from-foreground via-foreground to-foreground/80 bg-clip-text text-transparent">
                  Add Repository
                </CardTitle>
                <CardDescription className="text-muted-foreground/90">
                  Connect a GitHub repository to analyze
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <form
              className="space-y-4"
              onSubmit={handleSubmit(handleAddRepository)}
            >
              <div className="space-y-2">
                <Label htmlFor="repoName">Project Name</Label>
                <Input
                  id="repoName"
                  type="text"
                  {...register("ProjectName")}
                  placeholder="my-awesome-project"
                  className="h-11 bg-background/50 backdrop-blur-sm hover:border-primary/50 focus:border-primary transition-colors mt-1.5"
                  aria-invalid={!!errors.ProjectName}
                />
                {errors.ProjectName?.message && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.ProjectName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="repoUrl">GitHub Repository URL</Label>
                <Input
                  id="repoUrl"
                  type="url"
                  {...register("repoUrl")}
                  placeholder="https://github.com/username/repository.git"
                  className="h-11 bg-background/50 backdrop-blur-sm hover:border-primary/50 focus:border-primary transition-colors mt-1.5"
                  aria-invalid={!!errors.repoUrl}
                />
                {errors.repoUrl?.message && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.repoUrl.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="h-10 w-full rounded-md shadow-md hover:shadow-lg transition-shadow duration-300 bg-gradient-to-r from-primary to-primary/90 font-medium relative overflow-hidden group mt-4"
              >
                {/* Background shimmer effects */}
                <span className="absolute top-0 w-12 h-full bg-white/20 transform translate-x-[-100%] skew-x-[-20deg] group-hover:translate-x-[750%] transition-transform duration-2000"></span>
                <span className="absolute top-0 -left-5 w-12 h-full bg-white/20 transform translate-x-[-100%] skew-x-[-20deg] group-hover:translate-x-[350%] transition-transform duration-3000"></span>

                {/* Button content */}
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding Repository...
                  </>
                ) : (
                  "Add Repository"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-0">
            <div className="text-sm text-muted-foreground mt-4">
              <p>
                Adding a repository will allow GitVision to analyze your code
                and provide insights about your project's structure,
                dependencies, and more.
              </p>
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
