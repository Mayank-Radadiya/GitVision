import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/src/lib/trpc/routers/_app";

export type WorkspaceProject =
  inferRouterOutputs<AppRouter>["project"]["getDetails"];
