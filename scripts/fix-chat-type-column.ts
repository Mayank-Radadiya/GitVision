import { config } from "dotenv";
config();

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function checkAndAddTypeColumn() {
  try {
    // Check if type column exists
    const result = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'project_chats' 
      AND column_name = 'type'
    `;
    
    if (result.length === 0) {
      console.log("Adding 'type' column to project_chats table...");
      
      // Add type column
      await sql`
        ALTER TABLE project_chats 
        ADD COLUMN type varchar(20) DEFAULT 'project' NOT NULL
      `;
      
      console.log("✅ Type column added successfully!");
      
      // Also make projectId nullable if it's not already
      await sql`
        ALTER TABLE project_chats 
        ALTER COLUMN project_id DROP NOT NULL
      `;
      
      console.log("✅ project_id is now nullable!");
      
      // Create index on type column
      await sql`
        CREATE INDEX IF NOT EXISTS chats_type_idx ON project_chats (type)
      `;
      
      console.log("✅ Index on type column created!");
    } else {
      console.log("✅ Type column already exists");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkAndAddTypeColumn();
