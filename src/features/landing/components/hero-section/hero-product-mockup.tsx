"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  m,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  FileCode2,
  Folder,
  GitBranch,
  GitCommitHorizontal,
  Pause,
  Play,
  Terminal,
} from "lucide-react";
import { DEMO, DEMO_DIFF, DEMO_WORDS } from "./constants";
import { useHeroMotion } from "./hero-motion";
import { HERO_MOTION as T } from "./motion-tokens";

const QUERY_END = DEMO.query.length * T.queryCharacterMs;
const ANSWER_END = QUERY_END + DEMO_WORDS.length * T.answerWordMs;
const CITATIONS_END = ANSWER_END + DEMO.citations.length * T.citationMs;
const LOOP_END = CITATIONS_END + T.holdMs;
const COMPLETE = {
  query: DEMO.query.length,
  words: DEMO_WORDS.length,
  citations: DEMO.citations.length,
};

/** Shows a completed SSR example, then runs the script only while visible. */
function useDemo(running: boolean) {
  const [frame, setFrame] = useState<{
    query: number;
    words: number;
    citations: number;
  }>(COMPLETE);
  useEffect(() => {
    if (!running) return;
    let timer: ReturnType<typeof setTimeout>;
    let elapsed = 0;
    const step = () => {
      setFrame({
        query: Math.min(
          DEMO.query.length,
          Math.floor(elapsed / T.queryCharacterMs),
        ),
        words: Math.min(
          DEMO_WORDS.length,
          Math.max(0, Math.floor((elapsed - QUERY_END) / T.answerWordMs)),
        ),
        citations: Math.min(
          DEMO.citations.length,
          Math.max(0, Math.floor((elapsed - ANSWER_END) / T.citationMs)),
        ),
      });
      let delay: number;
      if (elapsed < QUERY_END) delay = T.queryCharacterMs;
      else if (elapsed < ANSWER_END) delay = T.answerWordMs;
      else if (elapsed < CITATIONS_END) delay = T.citationMs;
      else if (elapsed < LOOP_END) delay = T.holdMs;
      else {
        elapsed = -T.resetMs;
        delay = T.resetMs;
      }
      elapsed += delay;
      timer = setTimeout(step, delay);
    };
    step();
    return () => clearTimeout(timer);
  }, [running]);
  return running ? frame : COMPLETE;
}

function FileTree({
  selected,
}: {
  /** Whether the cited file is highlighted. */ selected: boolean;
}) {
  return (
    <div className="border-border bg-background/35 hidden w-40 shrink-0 border-r px-3 py-5 md:block lg:w-44">
      <div className="text-muted-foreground mb-5 font-mono text-[9px] tracking-[0.14em] uppercase">
        Explorer
      </div>
      <div className="text-muted-foreground space-y-3 font-mono text-[10px]">
        <div className="flex items-center gap-2">
          <ChevronDown className="size-3" />
          <Folder className="size-3.5" />
          platform
        </div>
        <div className="flex items-center gap-2 pl-3">
          <ChevronDown className="size-3" />
          <Folder className="size-3.5" />
          src
        </div>
        <div className="flex items-center gap-2 pl-6">
          <ChevronDown className="size-3" />
          indexing
        </div>
        <div
          className="relative -mx-3 flex items-center gap-2 py-2 pl-8"
          data-testid="hero-selected-file"
          data-selected={selected}
        >
          <span
            className="hero-tree-highlight absolute inset-0 border-l-2"
            style={{ opacity: selected ? 1 : 0 }}
          />
          <FileCode2 className="relative size-3.5 shrink-0" />
          <span className="text-foreground relative">repository.ts</span>
        </div>
        <div className="flex items-center gap-2 pl-6">
          <FileCode2 className="size-3.5" />
          sources.ts
        </div>
        <div className="flex items-center gap-2 pl-3">
          <Folder className="size-3.5" />
          retrieval
        </div>
        <div className="flex items-center gap-2 pl-3">
          <Folder className="size-3.5" />
          api
        </div>
        <div className="flex items-center gap-2 pl-3">
          <FileCode2 className="size-3.5" />
          package.json
        </div>
      </div>
    </div>
  );
}

export function HeroProductMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const bounds = useRef<DOMRect | null>(null);
  const inView = useInView(ref, { amount: 0.1 });
  const { reducedMotion, canMove, visible, ready } = useHeroMotion();
  const [paused, setPaused] = useState(false);
  const running = ready && inView && visible && !reducedMotion && !paused;
  const interactive = running && canMove;
  const frame = useDemo(running);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const tiltX = useSpring(rotateX, T.springs.tilt);
  const tiltY = useSpring(rotateY, T.springs.tilt);
  const float = useMotionValue(0);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const parallax = useTransform(scrollYProgress, [0, 1], [0, -T.parallax]);
  useEffect(() => {
    if (!interactive) {
      rotateX.set(0);
      rotateY.set(0);
      float.set(0);
      return;
    }
    const controls = animate(float, [0, -T.float, 0, T.float, 0], {
      duration: T.floatDuration,
      repeat: Infinity,
      ease: "easeInOut",
    });
    return () => controls.stop();
  }, [interactive, float, rotateX, rotateY]);
  return (
    <div ref={ref} className="relative mt-8">
      <div className="text-muted-foreground mb-3 flex items-center justify-between gap-3 font-mono text-[9px] tracking-[0.08em] uppercase">
        <span className="flex items-center gap-2">
          <span className="bg-primary h-px w-6" />
          From repository to understanding
        </span>
        <span className="hidden sm:inline">An inside look</span>
      </div>
      <m.div
        className="hero-pointer-motion"
        style={{ y: interactive ? parallax : 0, perspective: T.perspective }}
      >
        <m.div
          role="img"
          aria-label="Illustrative GitVision workspace: a source diff, a Gemini answer explaining repository indexing, and two citations to the matching source file."
          className="hero-workbench hero-pointer-motion border-border bg-card relative overflow-hidden rounded-xl border"
          data-testid="hero-workbench"
          style={{
            rotateX: interactive ? tiltX : 0,
            rotateY: interactive ? tiltY : 0,
            y: interactive ? float : 0,
            transformPerspective: T.perspective,
          }}
          onPointerEnter={(event) => {
            bounds.current = event.currentTarget.getBoundingClientRect();
          }}
          onPointerMove={(event) => {
            if (
              !interactive ||
              event.pointerType !== "mouse" ||
              !bounds.current
            )
              return;
            const rect = bounds.current;
            const clamp = (value: number) =>
              Math.max(-T.tilt, Math.min(T.tilt, value));
            rotateX.set(
              clamp(
                -((event.clientY - rect.top) / rect.height - 0.5) * T.tilt * 2,
              ),
            );
            rotateY.set(
              clamp(
                ((event.clientX - rect.left) / rect.width - 0.5) * T.tilt * 2,
              ),
            );
          }}
          onPointerLeave={() => {
            rotateX.set(0);
            rotateY.set(0);
            bounds.current = null;
          }}
        >
          <div aria-hidden="true">
            <div className="border-border bg-muted/25 flex h-12 items-center justify-between gap-2 border-b px-4">
              <div className="flex items-center gap-3">
                <div className="hidden gap-1.5 sm:flex">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="border-border size-2 rounded-full border"
                    />
                  ))}
                </div>
                <Terminal className="hero-accent size-3.5" />
                <span className="font-mono text-[10px]">
                  gitvision{" "}
                  <span className="text-muted-foreground">
                    / acme / platform
                  </span>
                </span>
              </div>
              <span className="text-muted-foreground border-border rounded border px-2 py-1 font-mono text-[9px]">
                Example workspace
              </span>
            </div>
            <div className="flex">
              <FileTree selected={frame.citations === DEMO.citations.length} />
              <div className="grid min-w-0 flex-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <div className="min-w-0">
                  <div className="border-border flex h-11 items-center justify-between border-b px-4 font-mono text-[10px]">
                    <span className="flex items-center gap-2">
                      <FileCode2 className="hero-wire size-3.5" />
                      repository.ts
                    </span>
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <GitBranch className="size-3" />
                      main
                    </span>
                  </div>
                  <div className="text-muted-foreground flex h-10 items-center gap-2 px-4 font-mono text-[9px]">
                    <GitCommitHorizontal className="size-3.5" />
                    <span>Preserve source locations</span>
                    <span className="hero-diff-add ml-auto">+10</span>
                    <span className="hero-diff-remove">−1</span>
                  </div>
                  <div className="hero-diff overflow-hidden py-3">
                    <pre className="font-mono text-[9px] leading-[23px] sm:text-[11px] lg:text-[10px]">
                      <code>
                        {DEMO_DIFF.map((line) => (
                          <span
                            key={line.number}
                            className={`block px-2 sm:px-4 ${line.kind ? `hero-line-${line.kind}` : ""}`}
                          >
                            <span className="text-muted-foreground mr-2 inline-block w-4 text-right">
                              {line.number}
                            </span>
                            <span
                              className={`mr-2 inline-block w-2 ${line.kind ? `hero-diff-${line.kind}` : ""}`}
                            >
                              {line.kind === "add"
                                ? "+"
                                : line.kind === "remove"
                                  ? "−"
                                  : " "}
                            </span>
                            <span
                              className={`hero-syntax-${line.tone ?? "plain"}`}
                            >
                              {line.text}
                            </span>
                            {"\n"}
                          </span>
                        ))}
                      </code>
                    </pre>
                  </div>
                </div>
                <div className="border-border bg-background/30 min-w-0 border-t lg:border-t-0 lg:border-l">
                  <div className="border-border flex h-11 items-center justify-between border-b px-4 font-mono text-[10px]">
                    <span className="flex items-center gap-2">
                      <span className="hero-accent">›_</span>Ask your codebase
                    </span>
                    <span className="text-muted-foreground text-[9px]">
                      Gemini
                    </span>
                  </div>
                  <div className="p-4 sm:p-5">
                    <div
                      className="border-border bg-card mb-6 rounded-lg border px-3 py-3 text-xs leading-5"
                      data-testid="hero-demo-query"
                    >
                      {Array.from(DEMO.query).map((character, index) => (
                        <span
                          key={index}
                          style={{ opacity: index < frame.query ? 1 : 0 }}
                        >
                          {character}
                        </span>
                      ))}
                    </div>
                    <div className="hero-accent mb-3 flex items-center gap-2 font-mono text-[10px]">
                      <span className="border-border flex size-5 items-center justify-center rounded border">
                        G
                      </span>
                      Gemini
                      <span className="text-muted-foreground ml-auto text-[9px]">
                        Grounded in your code
                      </span>
                    </div>
                    <p
                      className="text-foreground text-xs leading-[1.85]"
                      data-testid="hero-demo-answer"
                    >
                      {DEMO_WORDS.map((word, index) => (
                        <span
                          key={index}
                          style={{ opacity: index < frame.words ? 1 : 0 }}
                        >
                          {word}{" "}
                        </span>
                      ))}
                    </p>
                    <div
                      className="mt-5 space-y-2"
                      data-testid="hero-demo-citations"
                    >
                      {DEMO.citations.map((citation, index) => (
                        <m.div
                          key={citation}
                          initial={false}
                          animate={{
                            opacity: frame.citations > index ? 1 : 0,
                            y:
                              frame.citations > index || reducedMotion
                                ? 0
                                : T.offset,
                          }}
                          transition={{
                            duration: reducedMotion ? 0 : T.feedback,
                            ease: T.ease,
                          }}
                          className="border-border bg-card text-muted-foreground flex min-h-8 items-center gap-1.5 rounded border px-2 font-mono text-[9px]"
                        >
                          <FileCode2 className="hero-wire size-3 shrink-0" />
                          <span className="min-w-0 break-all">{citation}</span>
                          <ArrowUpRight className="ml-auto size-3 shrink-0" />
                        </m.div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="border-border text-muted-foreground flex h-8 items-center justify-between border-t px-4 font-mono text-[9px]">
              <span className="flex items-center gap-1.5">
                <Check className="hero-diff-add size-3" />
                Repository indexed
              </span>
              <span>Code. Context. Clarity.</span>
            </div>
          </div>
        </m.div>
      </m.div>
      <div className="text-muted-foreground mt-3 flex min-h-11 items-center justify-between gap-3 text-[10px]">
        <p>Real context. Traceable answers.</p>
        <button
          type="button"
          className="hero-control inline-flex min-h-11 items-center gap-2 rounded-md px-3 font-mono text-[10px] disabled:cursor-default"
          disabled={reducedMotion}
          aria-pressed={paused}
          onClick={() => setPaused((value) => !value)}
        >
          {paused || reducedMotion ? (
            <Play aria-hidden="true" className="size-3" />
          ) : (
            <Pause aria-hidden="true" className="size-3" />
          )}
          {reducedMotion
            ? "Static preview"
            : paused
              ? "Resume demo"
              : "Pause demo"}
        </button>
      </div>
    </div>
  );
}
