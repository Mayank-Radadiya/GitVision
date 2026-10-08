/**
 * BACK LINK — Fast Navigation to Projects Dashboard
 */

"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackLink() {
  return (
    <Link
      href="/dashboard"
      className="group font-gv-mono text-gv-fog hover:text-gv-bone focus-visible:text-gv-bone inline-flex items-center gap-2 rounded-md py-1 text-xs font-medium transition-colors duration-200 focus-visible:outline-none"
    >
      <ArrowLeft className="text-gv-fog/70 group-hover:text-gv-amber group-focus-visible:text-gv-amber h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-1" />
      <span>Back to Projects</span>
    </Link>
  );
}
