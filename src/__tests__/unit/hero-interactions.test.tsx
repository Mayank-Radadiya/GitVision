import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { LazyMotion, domAnimation } from "framer-motion";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { HeroSearchForm } from "@/features/landing/components/hero-section/hero-search-form";
import { HeroCtas } from "@/features/landing/components/hero-section/hero-ctas";
import { HeroStats } from "@/features/landing/components/hero-section/hero-stats";
import { HeroMotionContext } from "@/features/landing/components/hero-section/hero-motion";
import { normalizeRepoUrl } from "@/features/landing/components/hero-section/normalize-repo-url";
import { validators } from "@/src/lib/validation/schemas";

const { push, query, tick } = vi.hoisted(() => ({
  push: vi.fn(),
  query: vi.fn(),
  tick: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/src/lib/trpc/client", () => ({
  trpc: { project: { getPublicStats: { useQuery: query } } },
}));
vi.mock("framer-motion", async (importOriginal) => {
  const original = await importOriginal<typeof import("framer-motion")>();
  return { ...original, useInView: () => true, animate: tick };
});
function wrap(children: ReactNode, reducedMotion = true) {
  return (
    <LazyMotion features={domAnimation}>
      <HeroMotionContext.Provider
        value={{ reducedMotion, canMove: false, visible: true, ready: true }}
      >
        {children}
      </HeroMotionContext.Provider>
    </LazyMotion>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  query.mockReturnValue({
    data: { projectsCount: 1204, commitsCount: 98765, messagesCount: 0 },
    isLoading: false,
  });
  tick.mockImplementation((count, value) => {
    count.set(value);
    return { stop: vi.fn() };
  });
});
afterEach(cleanup);

describe("repository syntax and downstream compatibility", () => {
  it.each([
    "vercel/next.js",
    "github.com/vercel/next.js",
    "https://github.com/vercel/next.js",
    "  https://github.com/vercel/next.js.git/  ",
    "https://github.com/vercel/next.js?tab=readme#intro",
  ])("normalizes %s", (input) => {
    const result = normalizeRepoUrl(input);
    expect(result).toEqual({
      ok: true,
      url: "https://github.com/vercel/next.js",
    });
    if (result.ok)
      expect(validators.githubUrl.safeParse(result.url).success).toBe(true);
  });
  it.each([
    "",
    "  ",
    "invalid",
    "https://gitlab.com/owner/repo",
    "http://github.com/a/b",
    "https://github.com.evil.com/a/b",
    "https://user@github.com/a/b",
    "https://github.com:443/a/b",
    "https://github.com:123/a/b",
    "https://github.com/a/b/tree/main",
    "https://github.com/a/b/../c",
    "https://github.com/a/%2e%2e",
    "git@github.com:a/b.git",
    "owner/..",
    "https://github.com/a/b//",
  ])("rejects %s", (input) => {
    expect(normalizeRepoUrl(input).ok).toBe(false);
  });
  it("keeps the shared validator restricted to HTTPS repository roots", () => {
    for (const value of [
      "http://github.com/a/b",
      "https://gitlab.com/a/b",
      "https://github.com/a/b/tree/main",
      "https://github.com/a/..",
      "https://github.com/a/b?x=1",
    ])
      expect(validators.githubUrl.safeParse(value).success).toBe(false);
    expect(
      validators.githubUrl.safeParse("https://github.com/vercel/next.js.git")
        .success,
    ).toBe(true);
  });
});

describe("hero analyzer", () => {
  it("shows an associated inline error and does not navigate on invalid input", () => {
    const { container } = render(wrap(<HeroSearchForm />));
    const input = screen.getByLabelText("Start with a repository");
    fireEvent.change(input, { target: { value: "https://gitlab.com/a/b" } });
    fireEvent.submit(container.querySelector("form")!);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(
      "Enter a GitHub repository URL or owner/repo.",
    );
    expect(push).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "a/b" } });
    expect(input).toHaveAttribute("aria-invalid", "false");
  });
  it("disables empty submissions and fills either example without navigation", () => {
    render(wrap(<HeroSearchForm />));
    expect(
      screen.getByRole("button", { name: "Analyze repository" }),
    ).toBeDisabled();
    for (const repo of ["facebook/react", "vercel/next.js"]) {
      fireEvent.click(screen.getByRole("button", { name: repo }));
      expect(screen.getByLabelText("Start with a repository")).toHaveValue(
        `https://github.com/${repo}`,
      );
      expect(screen.getByLabelText("Start with a repository")).toHaveFocus();
    }
    expect(push).not.toHaveBeenCalled();
  });
  it("normalizes and encodes once, then locks repeated submissions", () => {
    const { container } = render(wrap(<HeroSearchForm />));
    fireEvent.change(screen.getByLabelText("Start with a repository"), {
      target: { value: " vercel/next.js " },
    });
    fireEvent.submit(container.querySelector("form")!);
    fireEvent.submit(container.querySelector("form")!);
    expect(push).toHaveBeenCalledExactlyOnceWith(
      `/create-project?url=${encodeURIComponent("https://github.com/vercel/next.js")}`,
    );
    expect(screen.getByRole("button", { name: "Opening…" })).toBeDisabled();
  });
  it("focuses with slash without consuming slash in editors or dialogs", () => {
    render(
      wrap(
        <>
          <HeroSearchForm />
          <textarea aria-label="Editor" />
          <div contentEditable data-testid="editable" />
          <div role="dialog">
            <button>Dialog action</button>
          </div>
        </>,
      ),
    );
    const input = screen.getByLabelText("Start with a repository");
    fireEvent.keyDown(document.body, { key: "/" });
    expect(input).toHaveFocus();
    for (const target of [
      screen.getByLabelText("Editor"),
      screen.getByTestId("editable"),
      screen.getByRole("button", { name: "Dialog action" }),
    ]) {
      input.blur();
      fireEvent.keyDown(target, { key: "/" });
      expect(input).not.toHaveFocus();
    }
    for (const modifier of [
      "ctrlKey",
      "metaKey",
      "altKey",
      "shiftKey",
      "isComposing",
      "repeat",
    ]) {
      fireEvent.keyDown(document.body, { key: "/", [modifier]: true });
      expect(input).not.toHaveFocus();
    }
  });
});

describe("CTAs and telemetry", () => {
  it("retains real links and their exact destinations", () => {
    const { container } = render(wrap(<HeroCtas />));
    expect(
      screen.getByRole("link", { name: "Get started for free" }),
    ).toHaveAttribute("href", "/sign-up");
    expect(
      screen.getByRole("link", { name: "See how it works" }),
    ).toHaveAttribute("href", "#features");
    expect(container.querySelector("a button")).toBeNull();
  });
  it("uses compact visible counts, full accessible counts and the hydration freshness policy", () => {
    render(wrap(<HeroStats />));
    expect(screen.getByText("1.2K")).toBeInTheDocument();
    expect(screen.getByText("98.8K")).toBeInTheDocument();
    expect(screen.getByText("1,204 Repos Analyzed")).toBeInTheDocument();
    expect(screen.getByText("0 AI Answers")).toBeInTheDocument();
    expect(query).toHaveBeenCalledWith(undefined, {
      staleTime: 300_000,
      refetchOnWindowFocus: false,
    });
    expect(tick).not.toHaveBeenCalled();
  });
  it.each([true, false])(
    "handles unavailable data (loading: %s)",
    (isLoading) => {
      query.mockReturnValue({ data: undefined, isLoading });
      render(wrap(<HeroStats />));
      expect(
        screen.getAllByText(isLoading ? /Loading/ : /Unavailable/),
      ).toHaveLength(3);
      expect(screen.queryByText("0 AI Answers")).not.toBeInTheDocument();
    },
  );
  it("animates once and updates directly after refetch", () => {
    const { rerender } = render(wrap(<HeroStats />, false));
    expect(tick).toHaveBeenCalledTimes(3);
    query.mockReturnValue({
      data: { projectsCount: 1205, commitsCount: 98765, messagesCount: 0 },
    });
    rerender(wrap(<HeroStats />, false));
    expect(tick).toHaveBeenCalledTimes(3);
    expect(screen.getByText("1,205 Repos Analyzed")).toBeInTheDocument();
  });
});
