import { config } from "dotenv";
config(); // Load environment variables from .env file

async function runMigration() {
  // Dynamic imports to ensure env vars are loaded first
  const { db } = await import("../drizzle");
  const { sql } = await import("drizzle-orm");

  const migrationSQL = `
-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add new columns to project_files table
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS language varchar(50);
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS hash varchar(64);

-- Create index on hash column for quick lookups
CREATE INDEX IF NOT EXISTS project_files_hash_idx ON project_files USING btree (hash);

-- Create code_embeddings table for vector storage
CREATE TABLE IF NOT EXISTS code_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  file_id uuid NOT NULL,
  file_path varchar(255) NOT NULL,
  chunk_index integer NOT NULL,
  chunk_content text NOT NULL,
  embedding vector(768) NOT NULL,
  token_count integer NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints for code_embeddings
ALTER TABLE code_embeddings DROP CONSTRAINT IF EXISTS code_embeddings_project_id_projects_id_fk;
ALTER TABLE code_embeddings ADD CONSTRAINT code_embeddings_project_id_projects_id_fk 
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE cascade ON UPDATE no action;
  
ALTER TABLE code_embeddings DROP CONSTRAINT IF EXISTS code_embeddings_file_id_project_files_id_fk;
ALTER TABLE code_embeddings ADD CONSTRAINT code_embeddings_file_id_project_files_id_fk 
  FOREIGN KEY (file_id) REFERENCES project_files(id) ON DELETE cascade ON UPDATE no action;

-- Create indexes for code_embeddings
CREATE INDEX IF NOT EXISTS embeddings_project_id_idx ON code_embeddings USING btree (project_id);
CREATE INDEX IF NOT EXISTS embeddings_file_id_idx ON code_embeddings USING btree (file_id);
CREATE INDEX IF NOT EXISTS embeddings_vector_idx ON code_embeddings USING hnsw (embedding vector_cosine_ops);

-- Create project_chats table for normalized chat storage
CREATE TABLE IF NOT EXISTS project_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  user_id varchar NOT NULL,
  title varchar(255) DEFAULT 'New Chat' NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints for project_chats
ALTER TABLE project_chats DROP CONSTRAINT IF EXISTS project_chats_project_id_projects_id_fk;
ALTER TABLE project_chats ADD CONSTRAINT project_chats_project_id_projects_id_fk 
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE cascade ON UPDATE no action;
  
ALTER TABLE project_chats DROP CONSTRAINT IF EXISTS project_chats_user_id_users_id_fk;
ALTER TABLE project_chats ADD CONSTRAINT project_chats_user_id_users_id_fk 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade ON UPDATE no action;

-- Create indexes for project_chats
CREATE INDEX IF NOT EXISTS chats_project_id_idx ON project_chats USING btree (project_id);
CREATE INDEX IF NOT EXISTS chats_user_id_idx ON project_chats USING btree (user_id);

-- Create chat_messages table for individual messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  chat_id uuid NOT NULL,
  role varchar(20) NOT NULL,
  content text NOT NULL,
  related_files jsonb DEFAULT '[]'::jsonb,
  created_at timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraint for chat_messages
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_chat_id_project_chats_id_fk;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_chat_id_project_chats_id_fk 
  FOREIGN KEY (chat_id) REFERENCES project_chats(id) ON DELETE cascade ON UPDATE no action;

-- Create indexes for chat_messages
CREATE INDEX IF NOT EXISTS messages_chat_id_idx ON chat_messages USING btree (chat_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON chat_messages USING btree (created_at);
`;

  try {
    // Split SQL into individual statements and execute them one by one
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const statement of statements) {
      const fullStatement = statement + ';';
      console.log(`Executing: ${fullStatement.substring(0, 80)}...`);
      await db.execute(sql.raw(fullStatement));
    }
    
    console.log("✅ Migration applied successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
