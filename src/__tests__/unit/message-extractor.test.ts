import { describe, it, expect } from "vitest";
import {
  extractMessageText,
  normalizeMessagesForModel,
} from "@/src/shared/lib/message-extractor";

describe("extractMessageText Helper", () => {
  it("should extract text from string content field", () => {
    expect(extractMessageText({ role: "user", content: "Hello world" })).toBe(
      "Hello world",
    );
  });

  it("should extract text from text field", () => {
    expect(
      extractMessageText({ role: "user", text: "Hello from text prop" }),
    ).toBe("Hello from text prop");
  });

  it("should extract text from AI SDK UIMessage parts array", () => {
    const uiMessage = {
      role: "user",
      parts: [
        { type: "text", text: "Hello " },
        { type: "text", text: "AI SDK!" },
      ],
    };
    expect(extractMessageText(uiMessage)).toBe("Hello AI SDK!");
  });

  it("should return empty string for missing, empty, or invalid input", () => {
    expect(extractMessageText(null)).toBe("");
    expect(extractMessageText(undefined)).toBe("");
    expect(extractMessageText({})).toBe("");
    expect(extractMessageText({ content: "" })).toBe("");
    expect(extractMessageText({ parts: [] })).toBe("");
    expect(extractMessageText({ parts: [{ type: "image", url: "foo" }] })).toBe(
      "",
    );
  });
});

describe("normalizeMessagesForModel Helper", () => {
  it("should convert UIMessages with parts into ModelMessage[] schema for streamText", () => {
    const rawMessages = [
      {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", text: "Explain the project structure" }],
      },
      {
        id: "msg-2",
        role: "assistant",
        parts: [{ type: "text", text: "Here is the structure..." }],
      },
    ];

    const normalized = normalizeMessagesForModel(rawMessages);
    expect(normalized).toEqual([
      { role: "user", content: "Explain the project structure" },
      { role: "assistant", content: "Here is the structure..." },
    ]);
  });

  it("should preserve standard ModelMessages with string content", () => {
    const rawMessages = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ];

    const normalized = normalizeMessagesForModel(rawMessages);
    expect(normalized).toEqual([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ]);
  });
});
