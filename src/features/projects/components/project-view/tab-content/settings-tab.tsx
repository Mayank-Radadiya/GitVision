"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import EditableProjectName from "../editable-project-name";
import { ProjectOptionsDropdown } from "../project-header";
import type { WorkspaceProject } from "../workspace-types";

export default function SettingsTab({
  project,
}: {
  project: WorkspaceProject;
}) {
  return (
    <div className="max-w-3xl space-y-5">
      <section className="border-border bg-card rounded-xl border p-6">
        <h3 className="text-sm font-semibold">General</h3>
        <p className="text-muted-foreground mt-1 mb-5 text-sm">
          Make this workspace easy to recognize.
        </p>
        <p className="text-muted-foreground mb-2 text-xs font-medium">
          Project name
        </p>
        <EditableProjectName
          projectId={project.id}
          name={project.projectName}
          compact
        />
      </section>
      <section className="border-border bg-card rounded-xl border p-6">
        <h3 className="text-sm font-semibold">Repository connection</h3>
        <p className="text-muted-foreground mt-2 text-sm break-all">
          {project.githubUrl}
        </p>
        <div className="mt-5 flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <a
              href={project.githubUrl.replace(/\.git$/, "")}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink />
              Open repository
            </a>
          </Button>
          <ProjectOptionsDropdown
            projectId={project.id}
            projectName={project.projectName}
          />
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          Use the menu to sync files or delete this project. Deletion requires
          confirmation.
        </p>
      </section>
      <section className="border-border bg-muted/30 rounded-xl border p-6">
        <h3 className="text-sm font-semibold">Work and collaboration</h3>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Issues and pull requests are synced from GitHub. Manage assignments,
          deadlines, and repository access on GitHub. Project member invitations
          and roles aren’t available in GitVision yet.
        </p>
      </section>
    </div>
  );
}
