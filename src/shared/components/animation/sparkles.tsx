"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/shared/lib/utils";

/** Upper bound on particles per canvas. The density prop saturates this on any
 *  viewport under ~80x smaller than the default, so it is the real cost. */
const MAX_PARTICLES = 300;

interface SparklesProps {
  id?: string;
  className?: string;
  background?: string;
  minSize?: number;
  maxSize?: number;
  particleDensity?: number;
  particleColor?: string;
  particleOpacity?: number;
  hoverEffect?: boolean;
}

export const SparklesCore = ({
  id,
  className,
  background = "transparent",
  minSize = 0.4,
  maxSize = 1,
  particleDensity = 100,
  particleColor = "#FFF",
  particleOpacity = 0.5,
  hoverEffect = false,
}: SparklesProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const canvasSize = useRef({ w: 0, h: 0 });
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      if (!canvas) return;
      canvasSize.current.w = window.innerWidth;
      canvasSize.current.h = window.innerHeight;
      canvas.width = canvasSize.current.w * dpr;
      canvas.height = canvasSize.current.h * dpr;
      canvas.style.width = `${canvasSize.current.w}px`;
      canvas.style.height = `${canvasSize.current.h}px`;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;

      constructor() {
        this.x = Math.random() * canvasSize.current.w;
        this.y = Math.random() * canvasSize.current.h;
        this.size = Math.random() * (maxSize - minSize) + minSize;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.speedY = Math.random() * 0.5 - 0.25;
        this.opacity = Math.random() * particleOpacity;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x > canvasSize.current.w) {
          this.x = 0;
        } else if (this.x < 0) {
          this.x = canvasSize.current.w;
        }

        if (this.y > canvasSize.current.h) {
          this.y = 0;
        } else if (this.y < 0) {
          this.y = canvasSize.current.h;
        }

        // Hover effect
        if (hoverEffect) {
          const dx = mouse.current.x - this.x;
          const dy = mouse.current.y - this.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const maxDistance = 100;

          if (distance < maxDistance) {
            const force = (maxDistance - distance) / maxDistance;
            const angle = Math.atan2(dy, dx);
            this.speedX -= force * Math.cos(angle) * 0.02;
            this.speedY -= force * Math.sin(angle) * 0.02;
          }
        }
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = particleColor;
        ctx.globalAlpha = this.opacity;
        ctx.fill();
      }
    }

    const particles: Particle[] = [];
    const particleCount = Math.min(
      Math.floor((canvasSize.current.w * canvasSize.current.h) / 8000) *
        particleDensity,
      MAX_PARTICLES,
    );

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    // The canvas is always sized to the viewport, so the density formula
    // saturates MAX_PARTICLES on any laptop. Every particle is an arc + fill
    // per frame, and the page mounts two of these canvases, so the cap is the
    // real per-frame cost.
    let frame = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const animate = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvasSize.current.w, canvasSize.current.h);

      particles.forEach((particle) => {
        particle.update();
        particle.draw();
      });

      frame = requestAnimationFrame(animate);
    };

    const start = () => {
      if (frame !== 0 || reducedMotion.matches) return;
      frame = requestAnimationFrame(animate);
    };

    const stop = () => {
      if (frame === 0) return;
      cancelAnimationFrame(frame);
      frame = 0;
    };

    // A hidden tab or an off-screen section is invisible either way, so the
    // loop is pure cost there.
    const onVisibilityChange = () => (document.hidden ? stop() : start());
    const onMotionChange = () => (reducedMotion.matches ? stop() : start());
    const intersection = new IntersectionObserver(([entry]) =>
      entry.isIntersecting ? start() : stop(),
    );

    intersection.observe(canvas);
    document.addEventListener("visibilitychange", onVisibilityChange);
    reducedMotion.addEventListener("change", onMotionChange);

    start();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reducedMotion.removeEventListener("change", onMotionChange);
      intersection.disconnect();
      stop();
    };
  }, [
    minSize,
    maxSize,
    particleColor,
    particleOpacity,
    particleDensity,
    dpr,
    hoverEffect,
  ]);

  return (
    <canvas
      ref={canvasRef}
      id={id}
      className={cn("absolute inset-0 h-full w-full", className)}
      style={{ background }}
    />
  );
};
