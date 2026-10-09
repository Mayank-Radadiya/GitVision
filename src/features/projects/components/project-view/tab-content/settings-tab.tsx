"use client";

import { ExternalLink, RefreshCw, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import EditableProjectName from "../editable-project-name";
import type { WorkspaceProject } from "../workspace-types";
import { useProjectActions } from "../project-actions";
import { ProjectPanel, PanelHeading, SectionHeading } from "../workspace-ui";

export default function SettingsTab({
  project,
}: {
  project: WorkspaceProject;
}) {
  const actions = useProjectActions();
  return (
    <div className="max-w-3xl space-y-5">
      <SectionHeading
        title="Project settings"
        description="Manage your project and GitHub connection."
      />
      <ProjectPanel>
        <PanelHeading
          title="General"
          description="Give this project a recognizable name."
        />
        <p className="text-muted-foreground mb-3 block text-xs font-medium">
          Project name
        </p>
        <EditableProjectName
          projectId={project.id}
          name={project.projectName}
          compact
        />
      </ProjectPanel>
      <ProjectPanel>
        <PanelHeading
          title="Repository connection"
          description="Source files are synced from this GitHub repository."
        />
        <p className="text-sm break-all">{project.githubUrl}</p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a
              href={project.githubUrl.replace(/\.git$/, "")}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="size-3.5" />
              Open repository
            </a>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={actions.syncing || actions.deleting}
            onClick={actions.syncProject}
          >
            {actions.syncing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            {actions.syncing ? "Queueing sync…" : "Sync files"}
          </Button>
        </div>
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          Sync runs in the background. The last file sync timestamp updates
          after it completes.
        </p>
      </ProjectPanel>
      <ProjectPanel>
        <PanelHeading
          title="Collaboration"
          description="Repository access and work are managed on GitHub."
        />
        <p className="text-muted-foreground text-sm leading-7">
          Manage assignments, deadlines, and repository permissions on GitHub.
          Issues and pull requests can be synced from their project sections.
        </p>
      </ProjectPanel>
      <ProjectPanel className="border-destructive/25">
        <PanelHeading
          title="Delete project"
          description="Permanently remove this project and its data from GitVision. Your GitHub repository will remain available."
        />
        <Button
          variant="outline"
          size="sm"
          className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
          disabled={actions.deleting || actions.syncing}
          onClick={actions.requestDelete}
        >
          <Trash2 className="size-3.5" />
          Delete project
        </Button>
      </ProjectPanel>
    </div>
  );
}
