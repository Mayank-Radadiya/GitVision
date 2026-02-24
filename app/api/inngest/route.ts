import { inngest } from "@/src/lib/inngest/client";
import { helloWorld } from "@/src/lib/inngest/functions";
import { serve } from "inngest/next";

// Create an API that serves zero functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [helloWorld],
});
