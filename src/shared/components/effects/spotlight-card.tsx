"use client";
import React, { useRef, useState } from "react";
import { motion } from "framer-motion";

interface Position {
  x: number;
  y: number;
}

interface SpotlightCardProps extends React.PropsWithChildren {
  className?: string;
  spotlightColor?: `rgba(${number}, ${number}, ${number}, ${number})`;
  borderGlow?: boolean;
  hoverScale?: number;
  borderRadius?: string;
}

const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = "",
  spotlightColor = "rgba(255, 255, 255, 0.25)",
  borderGlow = false,
  hoverScale = 1.02,
  borderRadius = "rounded-3xl",
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState<number>(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  // Handle mouse movement for spotlight effect
  const handleMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!divRef.current || isFocused) return;

    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });

    // Calculate position for 3D tilt effect
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    setMousePosition({
      x: (e.clientX - rect.left - centerX) / centerX,
      y: (e.clientY - rect.top - centerY) / centerY,
    });
  };

  const handleFocus = () => {
    setIsFocused(true);
    setOpacity(0.6);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setOpacity(0);
  };

  const handleMouseEnter = () => {
    setOpacity(0.6);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setOpacity(0);
    setIsHovered(false);
    // Reset position for smooth return to neutral
    setMousePosition({ x: 0, y: 0 });
  };

  // Generate gradients for the border glow effect
  const getBorderGlowStyles = () => {
    if (!borderGlow) return {};

    return {
      boxShadow: isHovered
        ? "0 0 20px 2px rgba(120, 40, 202, 0.3), inset 0 0 20px rgba(120, 40, 202, 0.1)"
        : "none",
      border: isHovered
        ? "1px solid rgba(120, 40, 202, 0.5)"
        : "1px solid rgba(30, 30, 30, 0.8)",
    };
  };

  return (
    <motion.div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ scale: hoverScale }}
      style={{
        transform: isHovered
          ? `perspective(1000px) rotateX(${mousePosition.y * 5}deg) rotateY(${
              mousePosition.x * -5
            }deg)`
          : "perspective(1000px) rotateX(0deg) rotateY(0deg)",
        transition: isHovered
          ? "transform 0.1s ease-out"
          : "transform 0.5s ease-out",
        ...getBorderGlowStyles(),
      }}
      className={`relative ${borderRadius} bg-card overflow-hidden from-neutral-950/70 to-neutral-900/70 p-8 backdrop-blur-md transition-all duration-300 dark:bg-linear-to-br ${className}`}
    >
      {/* Spotlight effect */}
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-500 ease-in-out"
        style={{
          opacity,
          background: `radial-gradient(circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 80%)`,
        }}
      />

      {/* Background ambient gradient */}
      <div className="absolute inset-0 z-0 bg-linear-to-br from-purple-500/5 via-transparent to-blue-500/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      {/* Animated subtle grain texture */}
      <div className="bg-noise animate-noise-slow absolute inset-0 z-0 opacity-20 mix-blend-overlay" />

      {/* Spotlight border trail effect */}
      {isHovered && (
        <div
          className="absolute inset-0 z-0 opacity-30"
          style={{
            background: `radial-gradient(circle at ${position.x}px ${position.y}px, rgba(120, 40, 202, 0.4), transparent 40%)`,
            filter: "blur(20px)",
          }}
        />
      )}

      {/* Content container with its own z-index to appear above effects */}
      <div className="relative z-20">{children}</div>
    </motion.div>
  );
};

export default SpotlightCard;
