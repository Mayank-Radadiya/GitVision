"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

interface GlowingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}

export function GlowingButton({
  children,
  className,
  glowColor = "rgba(99, 102, 241, 0.6)",
  ...props
}: GlowingButtonProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isHovering) return;

    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <Button
      size="lg"
      className={cn(
        "bg-primary hover:bg-primary/90 relative overflow-hidden transition-colors",
        className,
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setIsHovering(false)}
      {...props}
    >
      {isHovering && (
        <div
          className="pointer-events-none absolute rounded-full mix-blend-screen"
          style={{
            left: position.x,
            top: position.y,
            width: "150px",
            height: "150px",
            transform: "translate(-50%, -50%)",
            background: `radial-gradient(circle closest-side, ${glowColor}, transparent)`,
            opacity: 0.8,
          }}
        />
      )}
      {children}
    </Button>
  );
}
