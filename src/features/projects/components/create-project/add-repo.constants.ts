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
  title: string;
  description: string;
}

export interface RepoInfo {
  owner: string;
  repo: string;
}

// ─── Steps Configuration ─────────────────────────────────────────────────────

export const FORM_STEPS: Step[] = [
  { id: 1, title: "Enter Details", description: "Name and URL" },
  { id: 2, title: "Validation", description: "Check repository" },
  { id: 3, title: "Analysis", description: "Process data" },
];

// ─── Animation Configuration ─────────────────────────────────────────────────

export const CARD_ANIMATION = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay: 0.1 },
} as const;

export const HEADER_ICON_ANIMATION = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { duration: 0.3, delay: 0.2 },
} as const;

// ─── Style Configuration ─────────────────────────────────────────────────────

export const STEP_COLORS = {
  completed: "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30",
  active: "bg-primary text-white shadow-lg shadow-primary/30",
  inactive: "bg-muted text-muted-foreground",
} as const;
