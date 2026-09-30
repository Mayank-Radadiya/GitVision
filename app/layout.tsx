import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import Provider from "@/shared/providers/app-provider";
import ProductAnalytics from "@/shared/components/product-analytics";

// Three families, one preload. This was seven with four preloads, which is the
// worst of both: every family competes for the same connections as the CSS and
// the hero image, and a preload is an instruction to fetch before the browser
// gets to prioritise, so four of them were overriding the prioritisation the
// browser would otherwise do correctly. `Fira_Code` and `Fira_Sans` were also
// loaded for nothing at all — their CSS variables had no consumer anywhere.
// The other two are gone because `globals.css` points the create-project
// identity variables at these, so every `font-gv-body` / `font-gv-mono` class
// still resolves and no component had to change.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  // The only preload: this is `--font-sans`, so it is on screen first and a
  // swap-out while it loads is the one flash worth spending bandwidth on.
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  // `next/font` preloads by default in a production build, so the absence of
  // the flag is not the absence of a preload. Verified in the build output:
  // before this, all three families emitted a `rel="preload" as="font"` link.
  preload: false,
});

// Bricolage Grotesque — the display face. One headline uses it, and it is the
// only family here that is not also the body face, which is what makes the
// hierarchy read as intentional rather than as a font stack that defaulted.
const gvDisplay = Bricolage_Grotesque({
  variable: "--font-gv-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  // It appears once, on a heading well below the fold. Preloading it would
  // spend the connection the body face needs to paint.
  preload: false,
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
      className={`${geistSans.variable} ${geistMono.variable} ${gvDisplay.variable}`}
    >
      <body className="min-h-screen antialiased bg-background text-foreground">
        <Provider>{children}</Provider>
        <ProductAnalytics />
      </body>
    </html>
  );
}
