"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";


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
      1000
    );

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    const animate = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvasSize.current.w, canvasSize.current.h);

      particles.forEach((particle) => {
        particle.update();
        particle.draw();
      });

      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
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
