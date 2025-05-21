"use client";

import { useState, useEffect, memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MenuIcon, GithubIcon, ExternalLinkIcon } from "lucide-react";
import ModeToggle from "../custom/mode-toggle";
import Image from "next/image";
import { useUser } from "@clerk/nextjs";
import { GlowingButton } from "../custom/glowing-button";

const navigation = [
  { name: "Features", href: "#features" },
  { name: "Demo", href: "#demo" },
  { name: "Pricing", href: "#pricing" },
  { name: "Contact", href: "#footer" },
];

function LandingHeader() {
  const { user } = useUser();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  return (
    <header
      className={cn(
        "fixed top-0 z-50 w-full transition-all duration-300",
        isScrolled
          ? "bg-background/20 backdrop-blur-md  shadow-sm"
          : "bg-transparent"
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 opacity-50"></div>
      <nav className="container relative mx-auto flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          {/* Logo */}
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
        </div>

        {/* Desktop navigation */}
        <div className="hidden md:flex md:items-center md:gap-x-2">
          <div className="mr-3 rounded-full bg-muted/50 p-1 backdrop-blur-sm ring-1 ring-border/50">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "relative inline-flex items-center justify-center rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 hover:text-primary",
                  pathname === item.href
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-background/50"
                )}
              >
                {item.name}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="https://github.com/features"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-9 w-9 text-muted-foreground hover:text-foreground"
                aria-label="GitHub"
              >
                <GithubIcon className="h-5 w-5" />
              </Button>
            </Link>
            <ModeToggle />
            {user ? (
              <>
                <div className="flex items-center gap-2.5">
                  <Link href="/dashboard">
                    <GlowingButton className="rounded-full shadow-md hover:shadow-lg transition-shadow duration-300 bg-gradient-to-r from-primary to-primary/70 px-5 h-9 font-medium text-white">
                      Dashboard
                    </GlowingButton>
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2.5">
                  <Link href="/sign-in">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full border border-border/50 px-5 h-9"
                    >
                      Log in
                    </Button>
                  </Link>
                  <Link href="/sign-up">
                    <Button
                      size="sm"
                      className="rounded-full shadow-md hover:shadow-lg transition-shadow duration-300 bg-gradient-to-r from-primary to-primary/90 px-5 h-9 font-medium"
                    >
                      Sign up
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-4 md:hidden">
          <ModeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <MenuIcon className="h-5 w-5" />
          </Button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-background/95 backdrop-blur-sm pt-20 transition-all duration-300 md:hidden",
          isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="container px-6">
          <div className="flex flex-col space-y-6">
            <div className="flex flex-col space-y-3 border-b border-border pb-6">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center justify-between rounded-lg px-4 py-3 text-base font-medium text-foreground hover:bg-muted"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.name}
                  <ExternalLinkIcon className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
            <div className="flex flex-col space-y-3">
              <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                <Button
                  variant="outline"
                  className="w-full justify-center rounded-lg h-12"
                >
                  Log in
                </Button>
              </Link>
              <Link href="/signup" onClick={() => setIsMobileMenuOpen(false)}>
                <Button className="w-full justify-center rounded-lg h-12">
                  Sign up
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default memo(LandingHeader);
