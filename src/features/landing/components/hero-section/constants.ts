export const STATS_DATA = [
  { key: "projectsCount", label: "Repos Analyzed" },
  { key: "commitsCount", label: "Commits Processed" },
  { key: "messagesCount", label: "AI Answers" },
] as const;
export const HERO_HEADLINE = "Understand any codebase at the speed of thought";

/** Illustrative workspace, never represented as a live repository or response. */
export const DEMO = {
  query: "How does indexing keep track of the source code?",
  answer:
    "Each source file is split into chunks and embedded. The indexer stores the file path and line range with every vector, so retrieved answers can cite the exact code that supports them.",
  citations: [
    "src/indexing/repository.ts:15–18",
    "src/indexing/repository.ts:19–23",
  ],
} as const;
export const DEMO_WORDS = DEMO.answer.split(" ");

export type CodeTone = "plain" | "keyword" | "function" | "string" | "muted";
/** A small, readable diff with citations pointing to the actual displayed lines. */
export const DEMO_DIFF: {
  number: number;
  kind?: "add" | "remove";
  text: string;
  tone?: CodeTone;
}[] = [
  { number: 12, text: "async function index(repo) {", tone: "keyword" },
  { number: 13, text: "  const files = await read(repo);" },
  { number: 14, text: "  await store(files);", kind: "remove" },
  { number: 15, text: "  const chunks = split(files);", kind: "add" },
  {
    number: 16,
    text: "  const vectors = await embed(",
    kind: "add",
    tone: "function",
  },
  { number: 17, text: "    chunks", kind: "add" },
  { number: 18, text: "  );", kind: "add" },
  {
    number: 19,
    text: "  await index.upsert(vectors, {",
    kind: "add",
    tone: "function",
  },
  { number: 20, text: "    sources: chunks.map(c => ({", kind: "add" },
  { number: 21, text: "      path: c.path,", kind: "add", tone: "string" },
  {
    number: 22,
    text: "      lines: [c.start, c.end]",
    kind: "add",
    tone: "string",
  },
  { number: 23, text: "    }))", kind: "add" },
  { number: 24, text: "  });", kind: "add" },
  { number: 25, text: "}", tone: "keyword" },
];
