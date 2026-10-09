"use client";

import { memo } from "react";
import { BookOpen, ChevronDown, Clock } from "lucide-react";
import type { RepoBriefing } from "@/db/schema";

interface RepoBriefingSectionProps {
  briefing: RepoBriefing | null | undefined;
  embeddingStatus: string | null | undefined;
}

function describeMissing(status: string | null | undefined): {
  title: string;
  body: string;
} {
  if (status === "pending" || status === "processing")
    return {
      title: "Repository briefing is being prepared",
      body: "Your summary and architecture notes will appear after indexing finishes.",
    };
  if (status === "failed")
    return {
      title: "Repository briefing unavailable",
      body: "Indexing did not complete. You can still explore the synced code and project activity.",
    };
  return {
    title: "No repository briefing yet",
    body: "A summary has not been generated for this repository.",
  };
}

function RepoBriefingSection({
  briefing,
  embeddingStatus,
}: RepoBriefingSectionProps) {
  const missing = describeMissing(embeddingStatus);
  return (
    <section
      aria-label="Repository briefing"
      className="border-border bg-card min-w-0 rounded-xl border px-5 py-5 sm:px-6"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <BookOpen className="text-muted-foreground size-4" aria-hidden="true" />
        <h3 className="text-sm font-semibold tracking-tight">
          Repository briefing
        </h3>
        {briefing && (
          <span className="text-muted-foreground border-border ml-auto rounded border px-1.5 py-0.5 text-xs">
            AI generated
          </span>
        )}
      </div>
      {!briefing ? (
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium">
            {(embeddingStatus === "pending" ||
              embeddingStatus === "processing") && (
              <Clock className="size-3" aria-hidden="true" />
            )}
            {missing.title}
          </p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {missing.body}
          </p>
        </div>
      ) : (
        <>
          <p className="text-muted-foreground max-w-4xl text-sm leading-7">
            {briefing.summary}
          </p>
          {briefing.techStack.length > 0 && (
            <ul
              aria-label="Technology stack"
              className="mt-4 flex flex-wrap gap-1.5"
            >
              {briefing.techStack.map((tech) => (
                <li
                  key={tech}
                  className="border-border bg-muted/25 rounded border px-2 py-1 text-xs font-medium"
                >
                  {tech}
                </li>
              ))}
            </ul>
          )}
          {(briefing.description ||
            briefing.architecture ||
            briefing.keyComponents.length > 0) && (
            <details className="group border-border mt-4 border-t pt-3">
              <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-2 py-1 text-xs font-medium transition-colors [&::-webkit-details-marker]:hidden">
                <ChevronDown
                  className="size-3.5 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
                Explore architecture and key components
              </summary>
              <div className="mt-4 grid gap-6 lg:grid-cols-2">
                <div className="space-y-5">
                  {briefing.description && (
                    <div>
                      <h4 className="mb-2 text-xs font-medium">
                        About this repository
                      </h4>
                      <p className="text-muted-foreground text-xs leading-6">
                        {briefing.description}
                      </p>
                    </div>
                  )}
                  {briefing.architecture && (
                    <div>
                      <h4 className="mb-2 text-xs font-medium">Architecture</h4>
                      <p className="text-muted-foreground text-xs leading-6">
                        {briefing.architecture}
                      </p>
                    </div>
                  )}
                </div>
                {briefing.keyComponents.length > 0 && (
                  <div>
                    <h4 className="mb-3 text-xs font-medium">Key components</h4>
                    <ul className="space-y-4">
                      {briefing.keyComponents.map((component) => (
                        <li key={component.name}>
                          <p className="text-xs font-medium">
                            {component.name}
                          </p>
                          <p className="text-muted-foreground mt-1 text-xs leading-5">
                            {component.role}
                          </p>
                          {component.paths?.length > 0 && (
                            <ul className="mt-2 flex flex-wrap gap-1.5">
                              {component.paths.map((path) => (
                                <li
                                  key={path}
                                  className="text-muted-foreground bg-muted/30 max-w-full rounded px-1.5 py-0.5 font-mono text-xs break-all"
                                >
                                  {path}
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}

export default memo(RepoBriefingSection);
export { RepoBriefingSection, describeMissing };
