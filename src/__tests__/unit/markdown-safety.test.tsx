/**
 * =============================================================================
 * T-068 — `react-markdown` runs without `rehype-raw`
 * =============================================================================
 *
 * Retrieved repository content and model output are attacker-controlled. If
 * `rehype-raw` ever reaches the plugin array in `chat-message.tsx`, raw HTML in
 * that content is parsed into live DOM nodes instead of escaped text — stored
 * XSS via a repository file, and the prompt-injection fences added in T-069
 * become cosmetic.
 *
 * `rehype-raw` is absent from the codebase today (no import, no `package.json`
 * dependency, no `bun.lock` entry). These tests pin that so a later commit that
 * adds it fails here instead of shipping.
 *
 * The load-bearing assertion is `querySelector("script") === null`: with
 * `rehype-raw` the tag parses into a real element and the test fails. The
 * textContent assertions confirm the payload is *escaped* rather than dropped —
 * `react-markdown` defaults `skipHtml` to false, so `raw` nodes are converted
 * to text nodes and rendered escaped.
 */

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

// `chat-message.tsx` imports `next/link` at module scope, and Next 15's `Link`
// expects an app-router context that jsdom has none of. Only `CitationBadge`
// renders one; this test passes no `relatedFiles`, so the mock stays inert.
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

import { ChatMessage } from "@/features/chat/components/chat-message";

const MALICIOUS = [
  "Hello ",
  "<script>window.__pwned = true;</script> ",
  '<img src=x onerror="alert(1)" />',
].join("");

describe("chat markdown escapes raw HTML", () => {
  it("never injects a <script> element from message content", () => {
    const { container } = render(
      <ChatMessage role="assistant" content={MALICIOUS} />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(
      (window as Window & { __pwned?: boolean }).__pwned,
    ).toBeUndefined();
  });

  it("never injects an <img> or any other raw HTML element", () => {
    const { container } = render(
      <ChatMessage role="assistant" content={MALICIOUS} />,
    );

    expect(container.querySelector("img")).toBeNull();
  });

  it("renders the raw HTML as escaped text rather than dropping it", () => {
    const { container } = render(
      <ChatMessage role="assistant" content={MALICIOUS} />,
    );

    expect(container.textContent).toContain(
      "<script>window.__pwned = true;</script>",
    );
    expect(container.textContent).toContain('onerror="alert(1)"');
  });

  it("keeps rehype-highlight working on fenced code blocks", () => {
    const { container } = render(
      <ChatMessage
        role="assistant"
        content={'```js\nconst x = 1;\n```'}
      />,
    );

    expect(container.querySelector("pre code.language-js")).not.toBeNull();
  });
});
