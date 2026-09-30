"use client";

/**
 * Repo Briefing Card (F-15) — the plain-language answer to "what is this repo?".
 *
 * Renders `projects.briefing`, the JSONB payload written by the post-index
 * Gemini step. Placed at the top of the Overview tab because it is the one
 * thing on that page that explains the project rather than counting it.
 *
 * The column is nullable and the generator is total, so `null` means one of
 * three different things. `embeddingStatus` disambiguates — see
 * `describeMissing` below. Collapsing these into one "unavailable" message
 * would tell a user whose index is still running that the feature is broken.
 */

import { memo } from "react";
import { BookOpen, Boxes, Network, Clock, LayoutGrid } from "lucide-react";
import type { RepoBriefing } from "@/db/schema";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RepoBriefingCardProps {
  /** `projects.briefing`. Null until the post-index step writes one. */
  briefing: RepoBriefing | null | undefined;
  /** Used only to explain a null briefing. */
  embeddingStatus: string | null | undefined;
}

/**
 * The values `embedding_status` is known to take. Kept as a union for the
 * in-progress test below — but note the prop itself is typed `string`, because
 * the column is a bare `varchar` in the schema and Drizzle gives us no stronger
 * guarantee. An unrecognised value falls through to "no briefing available",
 * which is the safe reading.
 */
const IN_PROGRESS = new Set<string>(["pending", "processing"]);

function describeMissing(status: string | null | undefined): {
  title: string;
  body: string;
} {
  if (status && IN_PROGRESS.has(status)) {
    return {
      title: "Briefing is being generated",
      body: "This summary is written once indexing finishes. Check back in a moment.",
    };
  }

  if (status === "failed") {
    return {
      title: "No briefing available",
      body: "Indexing this repository did not complete, so there was nothing to summarise.",
    };
  }

  return {
    title: "No briefing available",
    body: "No summary was generated for this repository. The rest of the Overview tab is unaffected.",
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Small labelled section within the card body. */
function Section({
  icon,
  heading,
  children,
}: {
  icon: React.ReactNode;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5">
        {icon}
        <h4 className="text-[11px] font-medium tracking-wide uppercase">
          {heading}
        </h4>
      </div>
      {children}
    </div>
  );
}

/**
 * The null-briefing branch. Split out so `describeMissing` is consulted once
 * per render rather than twice, and so the two states cannot drift apart.
 */
function MissingState({ status }: { status: string | null | undefined }) {
  const { title, body } = describeMissing(status);
  const waiting = Boolean(status && IN_PROGRESS.has(status));

  return (
    <div>
      <p className="text-foreground flex items-center gap-1.5 text-xs font-medium">
        {waiting && <Clock className="h-3 w-3" />}
        {title}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">{body}</p>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

function RepoBriefingCard({ briefing, embeddingStatus }: RepoBriefingCardProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
          <BookOpen className="h-3.5 w-3.5" />
        </div>
        <div>
          <h3 className="text-foreground text-sm leading-none font-semibold">
            Repository Briefing
          </h3>
          <p className="text-muted-foreground mt-0.5 text-[11px]">
            What this project is and how it works
          </p>
        </div>
      </div>

      {!briefing ? (
        <MissingState status={embeddingStatus} />
      ) : (
        <div className="space-y-4">
          <p className="text-foreground/90 text-sm leading-relaxed">
            {briefing.summary}
          </p>

          {briefing.techStack.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 flex items-center gap-1.5">
                <Boxes className="h-3 w-3" />
                <h4 className="text-[11px] font-medium tracking-wide uppercase">
                  Tech Stack
                </h4>
              </div>
              {/* Wrapping flex rather than a grid: stack contents vary from 3
                  to 10 entries, and a fixed column count would strand the last
                  row's badges on their own. */}
              <ul className="flex flex-wrap gap-1.5">
                {briefing.techStack.map((tech) => (
                  <li
                    key={tech}
                    className="border-border/60 bg-muted/40 rounded-md border px-2 py-0.5 text-[11px] font-medium"
                  >
                    {tech}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {briefing.keyComponents.length > 0 && (
            <Section icon={<LayoutGrid className="h-3 w-3" />} heading="Key Components">
              <ul className="space-y-2.5">
                {briefing.keyComponents.map((component) => (
                  <li key={component.name}>
                    <p className="text-foreground text-xs font-medium">
                      {component.name}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">
                      {component.role}
                    </p>
                    {component.paths.length > 0 && (
                      <ul className="mt-1 flex flex-wrap gap-1">
                        {component.paths.map((path) => (
                          <li
                            key={path}
                            className="text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5 font-mono text-[10px]"
                          >
                            {path}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {briefing.architecture && (
            <Section
              icon={<Network className="h-3 w-3" />}
              heading="Architecture"
            >
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                {briefing.architecture}
              </p>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(RepoBriefingCard);

export { RepoBriefingCard, describeMissing };