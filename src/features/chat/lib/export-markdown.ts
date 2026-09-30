/**
 * Client-side Markdown export for a chat conversation (F-07).
 *
 * Pure except for `downloadMarkdown`, which touches the DOM. The assistant
 * content is already Markdown from the model, so it passes through verbatim
 * — code fences survive with no re-parsing, and nothing here needs to know
 * how `ChatMessage` renders. `relatedFiles` become a **Sources** line so the
 * citation context travels with the export.
 */

export interface ExportableMessage {
  role: "user" | "assistant" | "system";
  content: string;
  relatedFiles?: string[] | null;
}

export interface ExportChatOptions {
  title: string;
  projectName?: string | null;
  messages: ExportableMessage[];
  /** Override the header timestamp; defaults to now. */
  exportedAt?: Date;
}

function roleHeading(role: ExportableMessage["role"]): string | null {
  if (role === "user") return "## User";
  if (role === "assistant") return "## Assistant";
  // System prompts are scaffolding, not conversation — leave them out.
  return null;
}

/** `#`-safe filename from a chat title. */
export function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "chat";
}

export function chatToMarkdown(options: ExportChatOptions): string {
  const { title, projectName, messages, exportedAt = new Date() } = options;

  const lines: string[] = [
    `# ${title}`,
    "",
    projectName
      ? `*Project: ${projectName} · Exported ${exportedAt.toISOString()}*`
      : `*Exported ${exportedAt.toISOString()}*`,
    "",
    "---",
  ];

  for (const m of messages) {
    const heading = roleHeading(m.role);
    if (!heading) continue;
    lines.push("", heading, "", m.content.trim());
    if (m.relatedFiles && m.relatedFiles.length > 0) {
      lines.push("", `**Sources:** ${m.relatedFiles.join(", ")}`);
    }
  }

  return lines.join("\n") + "\n";
}

/** Trigger a browser download of pre-rendered Markdown. */
export function downloadMarkdown(filename: string, markdown: string): void {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".md") ? filename : `${filename}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
