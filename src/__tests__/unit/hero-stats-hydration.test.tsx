import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClientProvider, dehydrate, hydrate } from "@tanstack/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "@/src/lib/trpc/client";
import { makeQueryClient } from "@/src/lib/trpc/query-client";
import { HeroStats } from "@/features/landing/components/hero-section/hero-stats";
import { LazyMotion, domAnimation } from "framer-motion";

vi.mock("framer-motion", async (original) => ({
  ...(await original<typeof import("framer-motion")>()),
  useInView: () => true,
}));
afterEach(cleanup);

describe("public stats hydration", () => {
  it("hydrates the server options-proxy key into the client hook without a fetch", async () => {
    const fetch = vi.fn();
    const client = trpc.createClient({
      links: [
        httpBatchLink({
          url: "http://localhost/api/trpc",
          transformer: superjson,
          fetch,
        }),
      ],
    });
    const serverCache = makeQueryClient();
    const options = createTRPCOptionsProxy({
      client,
      queryClient: serverCache,
    });
    const stats = {
      projectsCount: 1204,
      commitsCount: 98765,
      messagesCount: 42,
    };
    const serverOptions = options.project.getPublicStats.queryOptions();
    await serverCache.prefetchQuery({
      ...serverOptions,
      queryFn: async () => stats,
    });
    const clientCache = makeQueryClient();
    hydrate(clientCache, dehydrate(serverCache));
    render(
      <QueryClientProvider client={clientCache}>
        <trpc.Provider client={client} queryClient={clientCache}>
          <LazyMotion features={domAnimation}>
            <HeroStats />
          </LazyMotion>
        </trpc.Provider>
      </QueryClientProvider>,
    );
    expect(screen.getByText("1,204 Repos Analyzed")).toBeInTheDocument();
    expect(screen.getByText("42 AI Answers")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(fetch).not.toHaveBeenCalled();
    clientCache.clear();
    serverCache.clear();
  });
});
