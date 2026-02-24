"use server";

import { inngest } from "@/src/lib/inngest/client";

export async function sendTestInngestEvent(email: string) {
  try {
    const res = await inngest.send({
      name: "test/hello.world",
      data: {
        email,
      },
    });

    return { success: true, ids: res.ids };
  } catch (error) {
    console.error("Failed to send inngest event", error);
    return { success: false, error: String(error) };
  }
}
