"use client";
import React from "react";
import Image from "next/image";

export default function Loader() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-screen">
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
    </div>
  );
}
