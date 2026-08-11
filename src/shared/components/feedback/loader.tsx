"use client";
import React from "react";
import Image from "next/image";

interface LoaderProps {
  message?: string;
}

export const Loader: React.FC<LoaderProps> = ({ message = "Loading..." }) => {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
      <div className="relative animate-pulse">
        <Image
          src="/Github.svg"
          alt="GitVision Logo"
          width={60}
          height={60}
          className="animate-bounce"
          style={{
            animationDuration: "2s",
            filter: "drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))",
          }}
        />
      </div>
      {message && (
        <p className="text-muted-foreground mt-4 animate-pulse text-center">
          {message}
        </p>
      )}
    </div>
  );
};
