import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config();

async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not defined in environment variables.");
    process.exit(1);
  }

  console.log("Connecting to PostgreSQL database...");
  const sql = neon(process.env.DATABASE_URL);

  try {
    console.log("Enabling pgvector extension ('CREATE EXTENSION IF NOT EXISTS vector;')...");
    await sql`CREATE EXTENSION IF NOT EXISTS vector;`;
    console.log("pgvector extension enabled successfully!");
  } catch (error) {
    console.error("Failed to enable pgvector extension:", error);
    process.exit(1);
  }
}

initDb();
