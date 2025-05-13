import React from "react";
import DashboardCard from "@/components/dashboard/dashboard-card";
import { FileIcon, GitBranch, CircleDollarSign, Star } from "lucide-react";

interface Project {
  totalProjects: number;
  totalCommits: number;
  totalFiles: number;
  userCredits: number;
}

interface StatsCardsSectionProps {
  project: Project;
}

const StatsCardsSection = ({ project }: StatsCardsSectionProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mt-6">
      <DashboardCard
        name="Projects"
        number={project.totalProjects || 0}
        icon={GitBranch}
        color="purple"
        description="Total Repositories"
      />
      <DashboardCard
        name="Files"
        number={project?.totalFiles || 0}
        icon={FileIcon}
        color="blue"
        description="Total files tracked"
      />
      <DashboardCard
        name="Commits"
        number={project?.totalCommits || 0}
        icon={Star}
        color="amber"
        description="Commits Analyzed"
      />

      <DashboardCard
        name="Credits"
        number={project.userCredits || 0}
        icon={CircleDollarSign}
        color="green"
        description="Total Credits Available"
      />
    </div>
  );
};

export default StatsCardsSection;
