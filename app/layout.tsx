import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Provider from "@/provider/provider";

// Optimize font loading with preload strategy
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "GitVision – Understand Your Code Instantly",
  description:
    "GitVision helps developers analyze GitHub repositories with AI-powered insights.",
  keywords: ["GitVision", "GitHub", "Code Analysis", "AI", "Developer Tools"],
  authors: [{ name: "Mayank" }],
  creator: "GitVision",
  metadataBase: new URL("https://gitvision.vercel.app"),
  openGraph: {
    title: "GitVision",
    description:
      "Understand your code instantly with GitVision's AI-powered GitHub analysis.",
    url: "https://gitvision.vercel.app",
    siteName: "GitVision",
    images: [
      {
        url: "https://gitvision.vercel.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "GitVision OpenGraph Image",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GitVision",
    description: "Analyze GitHub repos with AI instantly.",
    images: ["https://gitvision.vercel.app/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="min-h-screen antialiased bg-background text-foreground">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
