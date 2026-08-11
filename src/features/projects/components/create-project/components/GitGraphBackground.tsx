/**
 * =============================================================================
 * LIVING BRANCH GRAPH — Signature Element (Brief § Signature Moment & §4)
 * =============================================================================
 *
 * A quiet, full-bleed git graph canvas behind the form — kept low-contrast so
 * the form card stays the focal surface.
 *
 * Features:
 * 1. Edge light pulse: ~4s traveling pulse along one existing edge (the only
 *    perpetual ambient motion).
 * 2. Ghost node preview: The instant URL validation succeeds, a ghost node
 *    fades in (40% opacity) connected by a dashed --wire-400 line.
 * 3. Live branch: draws itself while a project name is typed.
 * 4. Merge pulse on submit: On clicking "Add Repository", the ghost node
 *    solidifies to 100% opacity with a scale-pop, the dashed wire becomes solid,
 *    and 3–5 cyan particles travel once along the wire from trunk to node.
 * 5. Reduced motion: Cut ambient pulse/particles; render end-states directly.
 */

"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { shortHash, truncateLabel } from "../add-repo.utils";
import type { RepoInfo } from "../add-repo.constants";

interface GitGraphBackgroundProps {
  /** Live value of the Project Name field — mirrors into the node label. */
  projectName: string;
  /** True once the GitHub URL debounces to a valid owner/repo match. */
  repoValid: boolean;
  /** Extracted owner and repo details when valid. */
  repoInfo: RepoInfo | null;
  /** True while the submission mutation is pending. */
  isSubmitting: boolean;
  /** True after submission mutation succeeds. */
  isSubmitted: boolean;
}

/* ─── Geometry (viewBox 1400×900) ─────────────────────────────────────────── */
const TRUNK =
  "M 40 860 C 300 820, 420 640, 620 600 C 820 560, 1040 380, 1360 220";
const GHOST_1 = "M 352 730 C 260 700, 180 560, 130 470";
const GHOST_2 = "M 841 513 C 960 560, 1080 660, 1190 700";
const LIVE_BRANCH = "M 620 600 C 760 560, 830 470, 940 400";
const WIRE_TO_GHOST = "M 950 394 C 1000 360, 1050 330, 1120 290";

const NODE = { x: 950, y: 394 };
const GHOST_NODE = { x: 1120, y: 290 };

// Design tokens hex literals for motion interpolations
const EMBER = "#E8A33D";
const DIFF_ADD = "#5FBF7A";
const WIRE_CYAN = "#4FD1D9";

const DRAW = {
  duration: 0.45,
  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
};
const FADE = { duration: 0.15 };

export function GitGraphBackground({
  projectName,
  repoValid,
  repoInfo,
  isSubmitting,
  isSubmitted,
}: GitGraphBackgroundProps) {
  const reduced = useReducedMotion();
  const showLive = projectName.trim().length > 0;
  const isMerged = isSubmitting || isSubmitted;

  // One-shot pulse trigger when URL turns valid
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (!repoValid) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 400);
    return () => clearTimeout(t);
  }, [repoValid]);

  return (
    <svg
      aria-hidden
      className="pointer-events-none fixed inset-0 h-full w-full opacity-[0.15] lg:opacity-[0.65]"
      viewBox="0 0 1400 900"
      preserveAspectRatio="xMidYMid slice"
    >
      <g>
        {/* Main Trunk */}
        <path
          d={TRUNK}
          className="fill-none stroke-gv-hairline"
          strokeOpacity={0.28}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />

        {/* Historical branch 1 */}
        <g className="max-lg:hidden">
          <path
            d={GHOST_1}
            className="fill-none stroke-gv-hairline"
            strokeOpacity={0.22}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={112}
            cy={452}
            r={4}
            className="fill-none stroke-gv-hairline"
            strokeOpacity={0.32}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </g>

        {/* Historical branch 2 with ambient traveling light pulse (~4s loop) */}
        <g className="max-lg:hidden">
          <path
            d={GHOST_2}
            className="fill-none stroke-gv-hairline"
            strokeOpacity={0.22}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          {!reduced && (
            <path
              d={GHOST_2}
              className="fill-none gv-wire-pulse"
              stroke={WIRE_CYAN}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          )}
          <circle
            cx={1215}
            cy={710}
            r={4}
            className="fill-none stroke-gv-hairline"
            strokeOpacity={0.32}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </g>

        {/* Live branch — draws itself when user types project name */}
        <g className="max-lg:hidden">
          <motion.path
            d={LIVE_BRANCH}
            fill="none"
            stroke={isMerged ? DIFF_ADD : EMBER}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            initial={reduced ? { opacity: 0 } : { pathLength: 0 }}
            animate={
              reduced
                ? { opacity: showLive ? 1 : 0 }
                : { pathLength: showLive ? 1 : 0 }
            }
            transition={
              reduced
                ? FADE
                : {
                    pathLength: DRAW,
                    opacity: FADE,
                  }
            }
          />

          {showLive && (
            <>
              {/* Commit node on live branch */}
              <motion.circle
                cx={NODE.x}
                cy={NODE.y}
                r={5}
                fill={isMerged ? DIFF_ADD : EMBER}
                initial={reduced ? { opacity: 0 } : { scale: 0, opacity: 0 }}
                animate={{
                  scale: reduced ? 1 : pulse ? 1.25 : 1,
                  opacity: 1,
                }}
                transition={
                  reduced
                    ? FADE
                    : {
                        scale: {
                          delay: 0.4,
                          type: "spring",
                          stiffness: 300,
                          damping: 18,
                        },
                        opacity: { delay: 0.4, ...FADE },
                      }
                }
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "center",
                }}
              />

              {/* Node Outer Ring */}
              <motion.circle
                cx={NODE.x}
                cy={NODE.y}
                r={9}
                fill="none"
                strokeWidth={1.5}
                animate={{
                  scale: reduced ? 1 : pulse ? 1.5 : 1,
                  stroke: repoValid ? DIFF_ADD : EMBER,
                }}
                transition={{
                  scale: { duration: 0.35, ease: "easeOut" },
                  stroke: { duration: 0.2, ease: "easeOut" },
                }}
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "center",
                }}
              />

              {/* Node label */}
              <motion.text
                x={NODE.x + 15}
                y={NODE.y - 1}
                fontSize={12}
                className="font-gv-mono font-medium tracking-tight"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={reduced ? FADE : { delay: 0.45, ...FADE }}
              >
                <tspan fill="var(--text-100)">
                  {truncateLabel(projectName)}
                </tspan>
                <tspan fill="var(--text-500)">  {shortHash(projectName)}</tspan>
              </motion.text>
            </>
          )}

          {/* Ghost Node & Wire Preview (Signature Moment) */}
          {repoValid && (
            <g>
              {/* Connecting wire (dashed on preview, solid on merge) */}
              <motion.path
                d={WIRE_TO_GHOST}
                fill="none"
                stroke={WIRE_CYAN}
                strokeWidth={1.5}
                strokeDasharray={isMerged ? "none" : "4 4"}
                strokeOpacity={isMerged ? 0.9 : 0.6}
                vectorEffect="non-scaling-stroke"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              />

              {/* Ghost Node Circle */}
              <motion.circle
                cx={GHOST_NODE.x}
                cy={GHOST_NODE.y}
                r={6}
                fill={WIRE_CYAN}
                fillOpacity={isMerged ? 1 : 0.4}
                stroke={WIRE_CYAN}
                strokeWidth={1.5}
                initial={reduced ? { opacity: 0.4 } : { scale: 0.7, opacity: 0 }}
                animate={
                  isMerged
                    ? {
                        scale: reduced ? 1 : [1, 1.4, 1],
                        opacity: 1,
                        fillOpacity: 1,
                      }
                    : {
                        scale: 1,
                        opacity: 0.8,
                        fillOpacity: 0.4,
                      }
                }
                transition={
                  reduced
                    ? { duration: 0.2 }
                    : {
                        scale: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
                        opacity: { duration: 0.3 },
                      }
                }
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "center",
                }}
              />

              {/* Ghost Node Label */}
              <motion.text
                x={GHOST_NODE.x + 14}
                y={GHOST_NODE.y + 4}
                fontSize={11}
                className="font-gv-mono tracking-wide"
                initial={{ opacity: 0 }}
                animate={{ opacity: isMerged ? 1 : 0.6 }}
                transition={{ duration: 0.2 }}
              >
                <tspan fill={WIRE_CYAN}>
                  {repoInfo ? `${repoInfo.owner}/${repoInfo.repo}` : "origin/head"}
                </tspan>
              </motion.text>

              {/* One-shot traveling particles along the wire on merge (if motion enabled) */}
              {isMerged && !reduced && (
                <>
                  {[0, 1, 2, 3].map((idx) => (
                    <motion.circle
                      key={idx}
                      r={3}
                      fill={WIRE_CYAN}
                      initial={{
                        cx: NODE.x,
                        cy: NODE.y,
                        opacity: 0,
                      }}
                      animate={{
                        cx: [NODE.x, GHOST_NODE.x],
                        cy: [NODE.y, GHOST_NODE.y],
                        opacity: [0, 1, 0],
                      }}
                      transition={{
                        duration: 0.7,
                        delay: idx * 0.12,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    />
                  ))}
                </>
              )}
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}
