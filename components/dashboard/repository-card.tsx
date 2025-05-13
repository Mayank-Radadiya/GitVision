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
    <Card className="p-4 border border-border/40 rounded-lg shadow-sm hover:shadow-md hover:border-primary/50 transition-all duration-200">
      {/* Project Title and View Button */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground group-hover:text-primary">
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
          onClick={() => router.push(`/repository/${id}`)}
          className="hover:scale-105 transition-transform"
        >
          View
        </Button>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
        <StatItem
          icon={<Star className="h-4 w-4 text-yellow-500" />}
          label="Stars"
          value={star}
        />
        <StatItem
          icon={<GitFork className="h-4 w-4 text-indigo-500" />}
          label="Forks"
          value={forks}
        />
        <StatItem
          icon={<GitCommit className="h-4 w-4 text-blue-500" />}
          label="Commits"
          value={totalCommits}
        />
        <StatItem
          icon={<GitBranch className="h-4 w-4 text-green-600" />}
          label="Branches"
          value={totalBranches}
        />
        <StatItem
          icon={<Users className="h-4 w-4 text-purple-500" />}
          label="Contributors"
          value={totalContributors}
        />
        <StatItem
          icon={<Calendar className="h-4 w-4 text-cyan-500" />}
          label="Created"
          value={formattedCreatedDate}
        />
      </div>
    </Card>
  );
};

// Simple reusable stat item
const StatItem = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) => (
  <div className="flex items-center gap-2">
    {icon}
    <span className="text-muted-foreground">{label}:</span>
    <span className="text-foreground font-medium">{value}</span>
  </div>
);
