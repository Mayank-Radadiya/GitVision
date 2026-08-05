import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { db } from "@/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error(
      "Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local",
    );
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occured -- no svix headers", {
      status: 400,
    });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error occured", {
      status: 400,
    });
  }

  const eventType = evt.type;

  try {
    if (eventType === "user.created" || eventType === "user.updated") {
      const { id, email_addresses, first_name, last_name } = evt.data;
      const email = email_addresses?.[0]?.email_address;
      const name =
        [first_name, last_name].filter(Boolean).join(" ") || "unknown";

      if (email) {
        await db
          .insert(usersTable)
          .values({
            id,
            email,
            name,
            credits: 100,
            isProUser: false,
          })
          .onConflictDoUpdate({
            target: usersTable.email,
            set: {
              name,
              email,
              updatedAt: new Date(),
            },
          });
      }
    } else if (eventType === "user.deleted") {
      // Cascade removes the user's projects, files, chats, and embeddings.
      const deletedId = (evt.data as { id?: string }).id;
      if (deletedId) {
        await db.delete(usersTable).where(eq(usersTable.id, deletedId));
      }
    }
  } catch (err) {
    // Log and swallow — a failed webhook must not poison the Svix retry queue.
    console.error("Error processing Clerk webhook:", err);
  }

  return NextResponse.json({ message: "Webhook received" }, { status: 200 });
}
