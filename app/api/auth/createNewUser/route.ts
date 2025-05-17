import { NextResponse } from "next/server";
import { db } from "@/drizzle";
import { usersTable } from "@/drizzle/schema/schema";
import { eq } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";

export async function POST() {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }
    const email = user?.emailAddresses[0]?.emailAddress;
    const name = user?.fullName || user?.firstName || user?.lastName;

    // Validate required fields
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    // Check if user already exists with the provided email
    const existingUser = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    // If user exists, then update the user
    const updatedUser = await db
      .update(usersTable)
      .set({
        name: name || "unknown", // Use provided name or default
        email: email, // Add the email field
        credits: 100, // Default credits
        isProUser: false, // Default to free user
        updatedAt: new Date(),
      })
      .where(eq(usersTable.email, email))
      .returning();

    // If user doesn't exist, create a new user
    const newUser = await db
      .insert(usersTable)
      .values({
        id: user.id,
        name: name || "unknown", // Use provided name or default
        email: email, // Add the email field
        credits: 100, // Default credits
        isProUser: false, // Default to free user
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Return success response with the created user
    return NextResponse.json(
      {
        message: "User created successfully",
        user: newUser[0] ? newUser[0] : updatedUser[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
