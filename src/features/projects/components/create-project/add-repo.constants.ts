/**
 * Create Project — Constants & Types
 *
 * Configuration for the create project form.
 * Types derived from the shared tRPC validation schema.
 */

import { z } from "zod";
import { projectCreateSchema } from "@/src/lib/validation/schemas";

// ─── Constants ───────────────────────────────────────────────────────────────

export const PROJECT_CREATION_COST = 10;

// ─── Type Definitions ────────────────────────────────────────────────────────

/** Form input shape — inferred from the tRPC validation schema */
export type CreateProjectInput = z.infer<typeof projectCreateSchema>;

export interface RepoInfo {
  owner: string;
  repo: string;
}

export interface PresetRepo {
  key: string;
  owner: string;
  repo: string;
  name: string;
  url: string;
  description: string;
  language: string;
  accentColor: string;
}

export const PRESETS: PresetRepo[] = [
  {
    key: "1",
    owner: "facebook",
    repo: "react",
    name: "React",
    url: "https://github.com/facebook/react",
    description: "The library for web and native user interfaces",
    language: "JavaScript",
    accentColor: "#61dafb",
  },
  {
    key: "2",
    owner: "microsoft",
    repo: "TypeScript",
    name: "TypeScript",
    url: "https://github.com/microsoft/TypeScript",
    description: "Typed superset of JavaScript that compiles to plain JS",
    language: "TypeScript",
    accentColor: "#3178c6",
  },
  {
    key: "3",
    owner: "tailwindlabs",
    repo: "tailwindcss",
    name: "Tailwind CSS",
    url: "https://github.com/tailwindlabs/tailwindcss",
    description: "A utility-first CSS framework for rapid UI development",
    language: "CSS",
    accentColor: "#38bdf8",
  },
];
