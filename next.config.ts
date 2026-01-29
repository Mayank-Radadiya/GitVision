import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true, // Helps catch issues early (dev only)
  experimental: {
    staleTimes: {
      static: 30 * 1000,
      dynamic: 10 * 1000,
    },
    serverActions: {
      bodySizeLimit: 1024 * 1024, // 1MB limit (example)
    },
  },
  typescript: {
    ignoreBuildErrors: true,
    
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "ui-avatars.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production", // Remove console logs in prod
  },
};

export default nextConfig;
