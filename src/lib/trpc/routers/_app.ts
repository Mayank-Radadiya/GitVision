/**
   File: trpc/routers/_app.ts
 * This file defines the root TRPC router and exposes public procedures
 * for the client and server to call.
 */

import { projectRouter } from "@/src/features/dashboard/server/router/project";
import { chatRouter } from "@/src/features/chat/server/router/chat";
import { createTRPCRouter } from "../init";

// Root TRPC router that groups all procedure endpoints
export const appRouter = createTRPCRouter({
  project: projectRouter,
  chat: chatRouter,
});

// Export API type for full type-safety across client and server
export type AppRouter = typeof appRouter;
