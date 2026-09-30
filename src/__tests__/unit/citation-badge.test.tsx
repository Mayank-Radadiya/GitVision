/**
 * =============================================================================
 * F-02 — a citation is a working deep link, not a label
 * =============================================================================
 *
 * The defect F-02 closed was that chat citations were inert text: the reader
 * saw a filename and had to go find the file themselves. The fix wraps each
 * cited path in a `Link` into the code viewer.
 *
 * A link that is only correct when a human clicks it is not testable, and an
 * untested link rots silently — the 2026-09-30 mutation audit broke this href
 * to a dead anchor and the whole suite stayed green, because nothing ever
 * rendered a citation. These tests close that hole: they render a message that
 * actually carries `relatedFiles` and assert the href that reaches the DOM.
 *
 * The `?file=` value is `encodeURIComponent`'d, so a path with slashes arrives
 * as one query parameter rather than a path traversal into a different route.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

// `chat-message.tsx` imports `next/link` at module scope, and Next 15's `Link`
// expects an app-router context that jsdom has none of. Only `CitationBadge`
// renders one, and unlike `markdown-safety.test.tsx` these tests do pass
// `relatedFiles` — so the mock is load-bearing here, which is the point.
vi.mock("next/link", () => ({
  default: ({
    children,
    ...rest
  }: {
    children: ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...rest}>{children}</a>,
}));

import { ChatMessage } from "@/features/chat/components/chat-message";

const PROJECT_ID = "p1";
const FILE = "src/features/chat/components/chat-message.tsx";

/**
 * Radix's `TooltipTrigger asChild` composes its own ARIA onto the child, so the
 * accessible name of a citation anchor is not stable enough to query on. The
 * href is the contract under test, so read it off the anchors directly.
 */
function citationHrefs(container: HTMLElement): string[] {
  return [...container.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
}

describe("F-02 — citations link into the code viewer", () => {
  it("gives a project citation a href pointing at the viewer with ?file=", () => {
    const { container } = render(
      <ChatMessage
        role="assistant"
        content="Here is how the component is wired."
        relatedFiles={[FILE]}
        projectId={PROJECT_ID}
      />,
    );

    expect(citationHrefs(container)).toEqual([
      `/code-viewer/${PROJECT_ID}?file=${encodeURIComponent(FILE)}`,
    ]);
  });

  it("labels the link for a screen reader, since the badge shows only a basename", () => {
    const { container } = render(
      <ChatMessage
        role="assistant"
        content="Here is how the component is wired."
        relatedFiles={[FILE]}
        projectId={PROJECT_ID}
      />,
    );

    expect(container.querySelector("a")).toHaveAttribute(
      "aria-label",
      `View ${FILE} in code viewer`,
    );
  });

  it("URL-encodes the path so slashes stay inside the ?file= parameter", () => {
    const nested = "src/a b/c&d.ts";
    const { container } = render(
      <ChatMessage
        role="assistant"
        content="A filename with a space and an ampersand in it."
        relatedFiles={[nested]}
        projectId={PROJECT_ID}
      />,
    );

    // A raw `&` or `/` would let a crafted filename add a second parameter or
    // escape into the path; the encoded form cannot.
    expect(citationHrefs(container)).toEqual([
      `/code-viewer/${PROJECT_ID}?file=${encodeURIComponent(nested)}`,
    ]);
  });

  it("leaves a general-chat citation inert, because there is no viewer to open", () => {
    const { container } = render(
      <ChatMessage
        role="assistant"
        content="No project is attached to this conversation."
        relatedFiles={[FILE]}
      />,
    );

    expect(container.querySelector("a")).toBeNull();
    // The filename is still visible — dropping the label too would lose
    // information for the reader.
    expect(screen.getByText("chat-message.tsx")).toBeInTheDocument();
  });

  it("renders one link per cited file", () => {
    const files = ["src/a.ts", "src/b.tsx"];
    const { container } = render(
      <ChatMessage
        role="assistant"
        content="Two files matter here."
        relatedFiles={files}
        projectId={PROJECT_ID}
      />,
    );

    expect(citationHrefs(container)).toEqual(
      files.map((f) => `/code-viewer/${PROJECT_ID}?file=${encodeURIComponent(f)}`),
    );
  });
});
