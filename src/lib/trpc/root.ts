import { router } from "./init";
import { projectRouter } from "./routers/project";

/**
 * Main tRPC app router
 * Combines all sub-routers
 */
export const appRouter = router({
  project: projectRouter,
});

/**
 * Export type definition for client-side type safety
 */
export type AppRouter = typeof appRouter;
