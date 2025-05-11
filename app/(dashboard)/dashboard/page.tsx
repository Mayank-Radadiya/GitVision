"use client";
import { Button } from "@/components/ui/button";
import { FolderGit2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s an overview of your repositories.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2"> </div>
          <Button
            onClick={() => router.push("/add")}
            className="h-10 w-full bg-primary/80 rounded-md shadow-md hover:shadow-lg transition-shadow duration-300 bg-gradient-to-r from-primary to-primary/90 font-medium relative overflow-hidden group mt-4 hover:scale-105 text-[14px]"
          >
            {/* Background shimmer effects */}
            <span className="absolute top-0 w-12 h-full bg-white/20 transform translate-x-[-100%] skew-x-[-20deg] group-hover:translate-x-[750%] transition-transform duration-2000"></span>
            <span className="absolute top-0 -left-5 w-12 h-full bg-white/20 transform translate-x-[-100%] skew-x-[-20deg] group-hover:translate-x-[350%] transition-transform duration-3000"></span>
            {/* Button content */}
            <FolderGit2 /> Add new repository
          </Button>
        </div>
      </div>
    </div>
  );
}
