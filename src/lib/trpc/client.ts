"use client";

import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "./root";

/**
 * tRPC React client
 * Provides type-safe hooks for all tRPC procedures
 */
export const trpc = createTRPCReact<AppRouter>();
