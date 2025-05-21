import {
  Calendar,
  ExternalLink,
  GitBranch,
  GitCommit,
  GitFork,
  Star,
  Users,
} from "lucide-react";
import { Button } from "../ui/button";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Card } from "../ui/card";
import IconHolder from "./IconHolder";

interface RepositoryCardProps {
  id: string;
  projectName: string;
  githubUrl: string;
  star: number;
  forks: number;
  totalCommits: number;
  totalBranches: number;
  totalContributors: number;
  createdAt: string;
}

export const RepositoryCard = ({
  id,
  projectName,
  githubUrl,
  star,
  forks,
  totalCommits,
  totalBranches,
  totalContributors,
  createdAt,
}: RepositoryCardProps) => {
  const router = useRouter();

  const formattedCreatedDate = formatDistanceToNow(new Date(createdAt), {
    addSuffix: true,
  });

  return (
    <Card className="p-6 border border-border rounded-lg shadow-sm hover:shadow-md hover:border-primary/50 transition-all duration-200 ">
      {/* Project Title and View Button */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-semibold text-foreground group-hover:text-primary mb-1">
            {projectName}
          </h2>
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground flex items-center gap-1 hover:text-primary transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="truncate max-w-[250px]">
              {githubUrl.replace(/^https?:\/\/(www\.)?github\.com\//, "")}
            </span>
          </a>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push(`/dashboard/user-project/${id}`)}
          className="hover:bg-primary hover:text-primary-foreground transition-all dark:bg-[#fafafad7] dark:text-[#000]  dark:hover:text-primary-foreground"
        >
          View Details
        </Button>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-2 gap-4 mt-1 text-sm">
        <IconHolder
          icon={<Star className="w-3.5 h-3.5" />}
          label="Stars"
          value={star}
          bgColor="bg-amber-100 dark:bg-amber-900/30"
          textColor="text-amber-600 dark:text-amber-400"
        />
        <IconHolder
          icon={<GitFork className="h-4 w-4" />}
          label="Forks"
          value={forks}
          bgColor="bg-indigo-100 dark:bg-indigo-900/30"
          textColor="text-indigo-600 dark:text-indigo-400"
        />
        <IconHolder
          icon={<GitCommit className="h-4 w-4" />}
          label="Commits"
          value={totalCommits}
          bgColor="bg-blue-100 dark:bg-blue-900/30"
          textColor="text-blue-600 dark:text-blue-400"
        />
        <IconHolder
          icon={<GitBranch className="h-4 w-4" />}
          label="Branches"
          value={totalBranches}
          bgColor="bg-green-100 dark:bg-green-900/30"
          textColor="text-green-600 dark:text-green-400"
        />
        <IconHolder
          icon={<Users className="h-4 w-4" />}
          label="Contributors"
          value={totalContributors}
          bgColor="bg-purple-100 dark:bg-purple-900/30"
          textColor="text-purple-600 dark:text-purple-400"
        />
        <IconHolder
          icon={<Calendar className="h-4 w-4" />}
          label="Created"
          value={formattedCreatedDate}
          bgColor="bg-cyan-100 dark:bg-cyan-900/30"
          textColor="text-cyan-600 dark:text-cyan-400"
        />
      </div>
    </Card>
  );
};
