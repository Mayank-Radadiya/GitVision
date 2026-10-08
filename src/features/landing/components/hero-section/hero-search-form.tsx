"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Github, LoaderCircle } from "lucide-react";
import { HeroReveal } from "./hero-motion";
import { normalizeRepoUrl } from "./normalize-repo-url";

export function HeroSearchForm() {
  const [repoUrl, setRepoUrl] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitted = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.key !== "/" ||
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        submitted.current
      )
        return;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest(
            "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox'], [role='dialog'], dialog",
          ))
      )
        return;
      if (
        document.querySelector(
          "dialog[open], [role='dialog'][aria-modal='true']:not([hidden])",
        )
      )
        return;
      event.preventDefault();
      input.current?.focus();
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitted.current) return;
    const result = normalizeRepoUrl(repoUrl);
    if (!result.ok) {
      setError(result.message);
      input.current?.focus();
      return;
    }
    submitted.current = true;
    setError("");
    setIsSubmitting(true);
    router.push(`/create-project?url=${encodeURIComponent(result.url)}`);
  }
  return (
    <HeroReveal order={3} className="mx-auto mt-6 max-w-xl text-left">
      <form onSubmit={handleSubmit} aria-busy={isSubmitting} noValidate>
        <label
          htmlFor="hero-repo-url"
          className="text-muted-foreground mb-2 block font-mono text-[10px] font-medium tracking-[0.12em] uppercase"
        >
          Start with a repository
        </label>
        <div
          className="hero-search border-border bg-card flex flex-wrap items-center gap-2 rounded-xl border p-2 sm:flex-nowrap"
          data-invalid={!!error}
        >
          <div className="flex min-h-11 min-w-0 flex-1 items-center gap-3 px-2">
            <Github
              aria-hidden="true"
              className="text-muted-foreground size-[18px] shrink-0"
            />
            <input
              ref={input}
              id="hero-repo-url"
              name="url"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="url"
              aria-describedby="hero-repo-feedback"
              aria-invalid={!!error}
              placeholder="github.com/owner/repository"
              value={repoUrl}
              onChange={(event) => {
                setRepoUrl(event.target.value);
                setError("");
              }}
              disabled={isSubmitting}
              className="text-foreground placeholder:text-muted-foreground min-h-11 min-w-0 flex-1 rounded-sm bg-transparent font-mono text-xs outline-none sm:text-sm"
            />
            <kbd
              aria-hidden="true"
              className="border-border text-muted-foreground hidden rounded border px-1.5 py-0.5 font-mono text-xs md:inline"
            >
              /
            </kbd>
          </div>
          <button
            type="submit"
            disabled={!repoUrl.trim() || isSubmitting}
            className="hero-control border-border bg-muted text-foreground flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
                Opening…
              </>
            ) : (
              <>
                Analyze repository
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </>
            )}
          </button>
        </div>
      </form>
      <div className="text-muted-foreground relative flex min-h-11 flex-wrap items-center justify-center gap-x-2 text-[10px] sm:justify-start">
        <p
          id="hero-repo-feedback"
          aria-live="polite"
          className="pointer-events-none absolute inset-0 flex items-center text-xs leading-4"
        >
          {error}
        </p>
        <span
          className="hidden font-mono sm:inline"
          style={{ visibility: error ? "hidden" : "visible" }}
        >
          Try a repository
        </span>
        {["facebook/react", "vercel/next.js"].map((repo) => (
          <button
            key={repo}
            style={{ visibility: error ? "hidden" : "visible" }}
            type="button"
            disabled={isSubmitting}
            className="hero-control inline-flex min-h-11 items-center gap-1 rounded-md px-2 font-mono disabled:opacity-60"
            onClick={() => {
              setRepoUrl(`https://github.com/${repo}`);
              setError("");
              input.current?.focus();
            }}
          >
            {repo}
            <ArrowUpRight aria-hidden="true" className="size-3" />
          </button>
        ))}
      </div>
    </HeroReveal>
  );
}
