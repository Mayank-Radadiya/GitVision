import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import RepoBriefingSection from "@/src/features/projects/components/project-view/overview/repo-briefing";
import type { RepoBriefing } from "@/db/schema";

/**
 * Server-rendered markup, no testing-library: the card has no interactivity,
 * so a static render proves what the user would see without pulling jsdom and a
 * component wrapper into the bundle.
 */
const render = (props: {
  briefing: RepoBriefing | null;
  embeddingStatus: string | null;
}) => renderToStaticMarkup(createElement(RepoBriefingSection, props));

const BRIEFING: RepoBriefing = {
  summary: "A RAG chat app over indexed GitHub repositories.",
  description: "RAG chat over GitHub repositories.",
  techStack: ["Next.js", "Drizzle ORM"],
  keyComponents: [
    { name: "Ingestion pipeline", role: "Indexes repository files.", paths: ["src/lib/inngest/functions.ts"] },
  ],
  architecture: "Files are embedded, then retrieved on each question.",
};

describe("RepoBriefingSection", () => {
  it("renders the summary, tech stack, components and architecture when present", () => {
    const html = render({ briefing: BRIEFING, embeddingStatus: "completed" });

    expect(html).toContain(BRIEFING.summary);
    expect(html).toContain(BRIEFING.architecture);
    expect(html).toContain("Next.js");
    expect(html).toContain("Drizzle ORM");
    expect(html).toContain("Ingestion pipeline");
    expect(html).toContain("src/lib/inngest/functions.ts");
  });

  it("tells a user mid-index that the briefing is still being written", () => {
    const html = render({ briefing: null, embeddingStatus: "processing" });

    expect(html).toContain("is being prepared");
    expect(html).not.toContain("No repository briefing yet");
  });

  it("distinguishes a finished project with no briefing from one still indexing", () => {
    const html = render({ briefing: null, embeddingStatus: "completed" });

    expect(html).toContain("No repository briefing yet");
    expect(html).not.toContain("being prepared");
  });

  it("explains a missing briefing when indexing itself failed", () => {
    const html = render({ briefing: null, embeddingStatus: "failed" });

    // A failed index has its own wording, and it must not collapse into the
    // plain "no briefing" state — the two need different things from the reader.
    expect(html).toContain("Repository briefing unavailable");
    expect(html).toContain("Indexing did not complete");
    expect(html).not.toContain("No repository briefing yet");
  });

  it("treats an unrecognised status as a genuine absence rather than a wait", () => {
    // embedding_status is a bare varchar, so a new value from a future
    // migration must not be misread as "still working".
    const html = render({ briefing: null, embeddingStatus: "queued" });

    expect(html).toContain("No repository briefing yet");
    expect(html).not.toContain("being prepared");
  });

  it("omits the tech stack section entirely when the model returned none", () => {
    const html = render({
      briefing: { ...BRIEFING, techStack: [], keyComponents: [] },
      embeddingStatus: "completed",
    });

    expect(html).toContain(BRIEFING.summary);
    expect(html).not.toContain("Tech Stack");
    expect(html).not.toContain("Key Components");
  });
});
