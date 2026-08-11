/**
 * Create Project — Constants & Types
 *
 * Configuration for the create project form.
 * Types derived from the shared tRPC validation schema.
 */

import { z } from "zod";
import { projectCreateSchema } from "@/src/lib/validation/schemas";

// ─── Type Definitions ────────────────────────────────────────────────────────

/** Form input shape — inferred from the tRPC validation schema */
export type CreateProjectInput = z.infer<typeof projectCreateSchema>;

export interface Step {
  id: number;
  /** Mono, uppercase, tracked-out label — e.g. "01 DETAILS" */
  label: string;
}

export interface RepoInfo {
  owner: string;
  repo: string;
}

// ─── Steps — drawn as commit nodes on the branch timeline (brief §5.2) ──────

export const FORM_STEPS: Step[] = [
  { id: 1, label: "01 DETAILS" },
  { id: 2, label: "02 VALIDATION" },
  { id: 3, label: "03 ANALYSIS" },
];

export const PRESETS = [
  {
    key: "1",
    owner: "facebook",
    repo: "react",
    name: "React",
    url: "https://github.com/facebook/react",
  },
  {
    key: "2",
    owner: "microsoft",
    repo: "TypeScript",
    name: "TypeScript",
    url: "https://github.com/microsoft/TypeScript",
  },
  {
    key: "3",
    owner: "tailwindlabs",
    repo: "tailwindcss",
    name: "Tailwind CSS",
    url: "https://github.com/tailwindlabs/tailwindcss",
  },
];
