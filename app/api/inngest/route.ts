import { inngest } from "@/src/lib/inngest/client";
import {
  projectCreated,
  generateEmbeddings,
  cleanupStaleData,
} from "@/src/lib/inngest/functions";
import { serve } from "inngest/next";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [projectCreated, generateEmbeddings, cleanupStaleData],
});
