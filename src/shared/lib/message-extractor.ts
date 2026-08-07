/**
 * Message payload text extraction utility.
 * Supports string content field, text property, or AI SDK UIMessage parts array.
 */
export function extractMessageText(msg: unknown): string {
  if (!msg || typeof msg !== "object") return "";
  const m = msg as Record<string, unknown>;

  if (typeof m.content === "string" && m.content.trim()) {
    return m.content.trim();
  }

  if (typeof m.text === "string" && m.text.trim()) {
    return m.text.trim();
  }

  if (Array.isArray(m.parts)) {
    const textParts = m.parts
      .filter(
        (p) =>
          p &&
          typeof p === "object" &&
          (p.type === "text" || !p.type) &&
          typeof (p as { text?: unknown }).text === "string",
      )
      .map((p) => (p as { text: string }).text)
      .join("");

    if (textParts.trim()) {
      return textParts.trim();
    }
  }

  return "";
}

export interface ModelMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Normalizes an array of incoming chat messages (whether UIMessage with parts or traditional message with content)
 * into standard ModelMessage objects with role & string content required by AI SDK streamText.
 */
export function normalizeMessagesForModel(messages: unknown[]): ModelMessage[] {
  if (!Array.isArray(messages)) return [];

  const normalized: ModelMessage[] = [];

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    const m = msg as Record<string, unknown>;

    const role: "user" | "assistant" | "system" =
      m.role === "assistant"
        ? "assistant"
        : m.role === "system"
          ? "system"
          : "user";

    const content = extractMessageText(m);
    if (content) {
      normalized.push({ role, content });
    }
  }

  return normalized;
}
