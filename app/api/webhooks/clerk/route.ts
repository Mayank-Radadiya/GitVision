import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { db } from "@/db";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { logger } from "@/src/lib/logger";
import { grantCredits, SIGNUP_CREDIT_GRANT } from "@/src/lib/credits";

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
    logger.error("Error verifying webhook", err);
    return new Response("Error occured", {
      status: 400,
    });
  }

  const eventType = evt.type;

  try {
    if (eventType === "user.created" || eventType === "user.updated") {
      const { id, email_addresses, first_name, last_name, primary_email_address_id } = evt.data;
      // D-1: no email is a valid state, so fall back to null rather than
      // skipping the user. NULL is exempt from the unique constraint.
      const email =
        email_addresses?.find((e) => e.id === primary_email_address_id)
          ?.email_address ??
        email_addresses?.[0]?.email_address ??
        null;
      const name =
        [first_name, last_name].filter(Boolean).join(" ") || "unknown";

      // Conflict on the PRIMARY KEY (Clerk's user id), not on email.
      // Email is mutable, so a user who changes their address would
      // otherwise fail the unique-email constraint and be inserted twice.
      if (eventType === "user.created") {
        // DO UPDATE is not an option on this branch, even though it is on
        // `user.updated`: `ON CONFLICT DO UPDATE ... RETURNING` returns a row on
        // both the insert and the update path, so it cannot tell us whether
        // this delivery created the user. DO NOTHING returns nothing on
        // conflict, which is the signal needed to avoid granting the signup
        // credits twice.
        //
        // Inserted at zero and granted below rather than inserted at 100: the
        // grant is what writes the ledger row, and `sum(delta)` over a user's
        // ledger has to equal their balance. Writing the balance in the INSERT
        // and the ledger row afterwards would leave every signup account short
        // by exactly 100 in the one thing the ledger exists to be honest about.
        const inserted = await db
          .insert(usersTable)
          .values({
            id,
            email,
            name,
            credits: 0,
          })
          .onConflictDoNothing({ target: usersTable.id })
          .returning({ id: usersTable.id });

        if (inserted.length > 0) {
          // Double-crediting is not a failure mode here. If this grant succeeded
          // then the row exists, so any retry hits the conflict above and
          // grants nothing. The one-sided risk is a throw between the two
          // statements: the retry then conflicts too, and the user is stranded
          // at 0 rather than wrongly given 100 twice.
          await grantCredits(id, SIGNUP_CREDIT_GRANT, "signup_grant");
        }
      } else {
        // credits is deliberately absent from the update set: a profile change
        // is not a payment event, so this path can never move a balance in
        // either direction. A user we have never seen (a `user.updated` whose
        // `user.created` we missed) is inserted at the standard grant, which is
        // the pre-existing behaviour of this handler.
        await db
          .insert(usersTable)
          .values({
            id,
            email,
            name,
            credits: SIGNUP_CREDIT_GRANT,
          })
          .onConflictDoUpdate({
            target: usersTable.id,
            set: {
              name,
              email,
              updatedAt: new Date(),
            },
          });
      }
    } else if (eventType === "user.deleted") {
      // Cascade removes the user's projects, files, chats, embeddings, and the
      // `credit_transactions` ledger.
      const deletedId = (evt.data as { id?: string }).id;
      if (deletedId) {
        await db.delete(usersTable).where(eq(usersTable.id, deletedId));
      }
    }
  } catch (err) {
    // Surface the failure. Returning 200 here marks the delivery successful,
    // so Clerk never retries and user provisioning fails silently.
    logger.error("Error processing Clerk webhook", err);
    return NextResponse.json(
      { message: "Error processing webhook" },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Webhook received" }, { status: 200 });
}
