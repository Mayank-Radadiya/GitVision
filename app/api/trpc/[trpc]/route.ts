import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/src/lib/trpc/root";
import { createContext } from "@/src/lib/trpc/init";

/**
 * tRPC API route handler for Next.js App Router
 * Handles both GET and POST requests
 */
const handler = async (req: Request) => {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
    onError({ error, path }) {
      console.error(`[tRPC Error] on ${path}:`, error);
    },
  });

  // Add security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
};

export { handler as GET, handler as POST };
