import React from "react";
import DashboardCard from "@/components/dashboard/dashboard-card";
import {
  FileIcon,
  GitBranch,
  GitCommit,
  Star,
} from "lucide-react";

interface Project {
  projectName: string;
  id: string;
  name: string;
  githubUrl: string;
  ownerId: string;
  commitsCount: number;
  filesCount: number;
  stars: number;
  forks: number;
  branches: number;
  contributors: number;
}

interface StatsCardsSectionProps {
  project: Project;
}

const StatsCardsSection = ({ project }: StatsCardsSectionProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mt-6">
      <DashboardCard
        name="Commits"
        number={project?.commitsCount || 0}
        icon={GitCommit}
        color="purple"
        description="Total number of commits made to this repository"
      />
      <DashboardCard
        name="Files"
        number={project?.filesCount || 0}
        icon={FileIcon}
        color="blue"
        description="Total files tracked in this repository"
      />
      <DashboardCard
        name="Stars"
        number={project?.stars || 0}
        icon={Star}
        color="amber"
        description="GitHub stars received on this project"
      />

      <DashboardCard
        name="Contributors"
        number={project?.contributors || 0}
        icon={GitBranch}
        color="green"
        description="People who've contributed to this project"
      />
    </div>
  );
};

export default StatsCardsSection;
