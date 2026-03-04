<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/PostgreSQL-Neon-4169E1?style=for-the-badge&logo=postgresql" alt="Neon Postgres" />
</p>

# 🔭 GitVision

**AI-powered GitHub repository intelligence platform.**

GitVision syncs your GitHub repositories, generates AI-powered commit summaries, builds vector embeddings of your codebase, and lets you **chat with your code** using RAG (Retrieval-Augmented Generation). Think of it as a smart copilot that deeply understands your project's structure and history.

---

## ✨ Features

### 🧠 AI-Powered Insights

- **Commit Summaries** — Gemini-generated plain-English summaries of every commit
- **Issue & PR Triage** — Automatic AI classification with complexity estimation and semantic tagging
- **RAG Code Chat** — Ask natural-language questions about your codebase; answers are grounded in your actual source code via vector similarity search

### 📊 Repository Dashboard

- **Commit Activity** — Interactive timeline of project commit history
- **Tech Stack Breakdown** — Language composition with visual percentage bars
- **Contributors** — Author-level commit analytics
- **Stats at a Glance** — Stars, forks, branches, files, and total commits

### 🐛 Issues & Pull Requests

- **Live Sync** — Issues and PRs fetched from GitHub with full metadata
- **AI Triage** — Each issue is auto-summarized with complexity tags (high / medium / low)
- **Comment Threads** — Inline display of GitHub discussion threads with avatars

### 📂 Code Browser

- **Full File Tree** — Browse the repository file structure in-app
- **Syntax-Highlighted Viewer** — Read source code with proper language highlighting

### 💬 Chat with Your Code

- **Contextual Conversations** — Multiple chat sessions per project with persistent history
- **Vector Search** — Queries are matched against 768-dimension Gemini embeddings using HNSW indexing
- **Source Citations** — Responses reference specific files from your codebase

---

## 🏗️ Tech Stack

| Layer               | Technology                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**       | [Next.js 15](https://nextjs.org/) (App Router, Turbopack)                                                                        |
| **Language**        | TypeScript 5                                                                                                                     |
| **UI**              | React 19, [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/), [Framer Motion](https://motion.dev/) |
| **Auth**            | [Clerk](https://clerk.com/)                                                                                                      |
| **Database**        | [Neon](https://neon.tech/) (Serverless PostgreSQL) with [pgvector](https://github.com/pgvector/pgvector)                         |
| **ORM**             | [Drizzle ORM](https://orm.drizzle.team/)                                                                                         |
| **API**             | [tRPC](https://trpc.io/) (end-to-end typesafe APIs)                                                                              |
| **AI**              | [Google Gemini](https://ai.google.dev/) (summaries, embeddings, chat), [Vercel AI SDK](https://sdk.vercel.ai/)                   |
| **Background Jobs** | [Inngest](https://www.inngest.com/) (durable, event-driven functions)                                                            |
| **GitHub API**      | [Octokit](https://github.com/octokit/octokit.js)                                                                                 |
| **Validation**      | [Zod](https://zod.dev/)                                                                                                          |

---

## 📁 Project Structure

```
├── app/                    # Next.js App Router pages & API routes
│   ├── (auth)/             # Sign-in / sign-up flows (Clerk)
│   ├── (main)/             # Authenticated app shell
│   │   ├── chat/           # RAG chat interface
│   │   ├── code-viewer/    # Repository file browser
│   │   ├── create-project/ # New project onboarding
│   │   └── dashboard/      # Project analytics dashboard
│   └── api/                # API endpoints (chat, embeddings, inngest, tRPC, webhooks)
├── db/                     # Drizzle schema & migrations
├── src/
│   ├── features/           # Feature-based architecture
│   │   ├── auth/           # User & auth utilities
│   │   ├── chat/           # Chat UI components & logic
│   │   ├── dashboard/      # Dashboard widgets & analytics
│   │   ├── landing/        # Marketing landing page
│   │   ├── projects/       # Project management
│   │   └── rag/            # Embedding generation & vector search
│   ├── lib/                # Shared libraries (inngest, trpc, AI clients)
│   └── shared/             # Shared UI components, hooks, utils
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18 (or [Bun](https://bun.sh/))
- **Neon** database (free tier works)
- **Clerk** account for authentication
- **GitHub Personal Access Token** — for repo syncing
- **Google Gemini API Key** — for AI features

### 1. Clone the repository

```bash
git clone https://github.com/Mayank-Radadiya/GitVision.git
cd GitVision
```

### 2. Install dependencies

```bash
# Using bun (default)
bun install

# Or with yarn
yarn install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
CLERK_WEBHOOK_SECRET=whsec_...

# Database (Neon Serverless PostgreSQL)
DATABASE_URL=postgresql://...

# GitHub
GITHUB_TOKEN=github_pat_...

# AI / LLM
GEMINI_API_KEY=AIza...
OPENROUTER_API_KEY=sk-or-...
```

### 4. Set up the database

```bash
# Generate migration files
bun db:generate

# Push schema to Neon
bun db:push
```

### 5. Run the development server

```bash
# Start Next.js (Turbopack)
bun dev

# In a separate terminal — start Inngest dev server
bun inngest
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

---

## 📜 Available Scripts

| Command            | Description                                  |
| ------------------ | -------------------------------------------- |
| `bun dev`         | Start Next.js dev server with Turbopack      |
| `bun build`       | Production build                             |
| `bun start`       | Start production server                      |
| `bun lint`        | Run ESLint                                   |
| `bun db:generate` | Generate Drizzle migration files             |
| `bun db:push`     | Push schema changes to database              |
| `bun db:studio`   | Open Drizzle Studio (DB GUI)                 |
| `bun inngest`     | Start Inngest dev server for background jobs |
| `bun clean`       | Remove build artifacts and caches            |

---

## 🗄️ Database Schema

The app uses a relational schema with vector extensions:

- **users** — Clerk-synced user profiles with credit system
- **projects** — GitHub repo metadata, language breakdown, embedding status
- **project_files** — Full repository file contents with SHA-256 hashing
- **code_embeddings** — 768-dim Gemini vectors with HNSW cosine similarity index
- **commits** — Commit history with AI-generated summaries
- **issues / issue_comments** — GitHub issues & PRs with AI triage metadata
- **project_chats / chat_messages** — Normalized chat history per project

---

## 🔒 Authentication

GitVision uses **Clerk** for authentication with webhook-based user sync:

1. Users sign up / sign in via Clerk's hosted UI
2. A Clerk webhook syncs user data to the local `users` table
3. Middleware protects all `/dashboard`, `/chat`, and `/code-viewer` routes

---

## 🤖 How RAG Chat Works

```
1.  Project files are streamed from GitHub via Octokit tarball API
2.  Files are chunked and embedded using Gemini embedding-004 (768 dims)
3.  Embeddings are stored in Neon with pgvector HNSW indexes
4.  User query → embed → cosine similarity search → top-k chunks
5.  Top chunks + query are sent to Gemini as grounded context
6.  Streamed AI response with file-path citations
```

---

## 🤝 Contributing

Contributions are welcome! Please follow the standard fork → branch → PR workflow.

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feat/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is open source. See the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with ❤️ using Next.js, Gemini AI, and Neon Postgres
</p>
