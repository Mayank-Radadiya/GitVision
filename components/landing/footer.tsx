import Link from "next/link";
import {
  TwitterIcon,
  GithubIcon,
  LinkedinIcon,
  MailIcon,
} from "lucide-react";
import Image from "next/image";

export function Footer() {
  return (
    <footer
      id="footer"
      className="border-t border-border/40 bg-gradient-to-b from-background to-background/95 mt-20"
    >
      <div className="container mx-auto px-6 py-12">
        {/* Divider */}
        <div className="h-1 w-full bg-gradient-to-r from-primary/80 via-purple-500/50 to-blue-500/40 mb-12 rounded-full" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
          {/* Brand & description */}
          <div className="space-y-6">
            <Link
              href="/"
              className="group flex items-center gap-3 transition-all duration-300"
            >
              <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-background via-background to-background ring-1 ring-primary/20 backdrop-blur-sm overflow-hidden shadow-lg transition-all duration-300 group-hover:shadow-primary/10">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-80"></div>
                <Image
                  src={"/Github.svg"}
                  alt="Logo"
                  width={30}
                  height={30}
                  className="relative z-10 transition-transform duration-300 group-hover:scale-110"
                />
              </div>
              <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-xl font-bold tracking-tight text-transparent">
                Git<span className="text-primary">Vision</span>
              </span>
            </Link>

            <p className="text-sm text-muted-foreground leading-relaxed">
              AI-powered GitHub repository analysis that visualizes code
              patterns and provides meaningful insights into your development
              process.
            </p>

            <div className="flex items-center gap-5">
              <Link
                href="#"
                aria-label="Twitter"
                className="hover:text-primary transition-colors"
              >
                <TwitterIcon className="h-5 w-5 text-muted-foreground hover:text-primary" />
              </Link>
              <Link
                href="#"
                aria-label="GitHub"
                className="hover:text-primary transition-colors"
              >
                <GithubIcon className="h-5 w-5 text-muted-foreground hover:text-primary" />
              </Link>
              <Link
                href="#"
                aria-label="LinkedIn"
                className="hover:text-primary transition-colors"
              >
                <LinkedinIcon className="h-5 w-5 text-muted-foreground hover:text-primary" />
              </Link>
            </div>
          </div>
          {/* Contact Info */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-foreground">
              Contact Us
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <MailIcon className="h-5 w-5 text-primary" />
                <div className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  work.xyz.09@gmail.com
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Have questions or need assistance? Reach out — we&apos;re here to
                help you get the most out of GitVision.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row justify-between items-center border-t border-border/30 pt-6">
          <p className="text-xs text-muted-foreground">
            &copy; 2025 GitVision. All rights reserved.
          </p>

          <div className="flex gap-6 mt-4 md:mt-0">
            <Link
              href="#"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="#"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              href="#"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
