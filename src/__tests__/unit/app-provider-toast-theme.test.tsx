import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useTheme } = vi.hoisted(() => ({ useTheme: vi.fn() }));

vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme,
}));

vi.mock("@clerk/nextjs", () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/src/lib/trpc/client", () => ({
  trpc: {
    createClient: () => ({}),
    Provider: ({ children }: { children: React.ReactNode }) => children,
  },
}));

vi.mock("react-hot-toast", () => ({
  Toaster: ({
    toastOptions,
  }: {
    toastOptions: { style: Record<string, unknown> };
  }) => <div data-testid="toaster" data-color={toastOptions.style.color} />,
}));

import Provider from "@/src/shared/providers/app-provider";

describe("app provider toasts", () => {
  let observers: (callback: () => void) => void;

  beforeEach(() => {
    observers = vi.fn(() => undefined);
    vi.stubGlobal(
      "MutationObserver",
      class {
        constructor(callback: () => void) {
          observers(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("colours the toast from the resolved theme instead of a CSS variable", () => {
    useTheme.mockReturnValue({ resolvedTheme: "dark" });
    render(<Provider>content</Provider>);

    expect(screen.getByTestId("toaster")).toHaveAttribute("data-color", "#fff");
  });

  it("follows the theme back to light", () => {
    useTheme.mockReturnValue({ resolvedTheme: "light" });
    render(<Provider>content</Provider>);

    expect(screen.getByTestId("toaster")).toHaveAttribute("data-color", "#333");
  });

  it("does not watch the document for class changes", () => {
    useTheme.mockReturnValue({ resolvedTheme: "dark" });
    render(<Provider>content</Provider>);

    expect(observers).not.toHaveBeenCalled();
  });
});
