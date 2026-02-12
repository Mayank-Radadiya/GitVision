"use client";

import { useState, useEffect, useCallback, memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { MenuIcon, XIcon, ArrowRightIcon, ZapIcon } from "lucide-react";
import ModeToggle from "@/shared/components/theme/mode-toggle";
import { useUser } from "@clerk/nextjs";
import {
  motion,
  AnimatePresence,
  LazyMotion,
  domAnimation,
} from "framer-motion";

import { NAVIGATION, SCROLL_SPY_OFFSET, MOBILE_BREAKPOINT } from "./constants";
import { useScrollSpy, useScrolled } from "./hooks";
import { headerVariants, childVariants } from "./variants";
import { GitHubStarBadge } from "./github-star-badge";
import { NavLink } from "./nav-link";
import { MobileMenu } from "./mobile-menu";

function LandingHeader() {
  const { user } = useUser();
  const isScrolled = useScrolled();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const activeSection = useScrollSpy(
    NAVIGATION.map((n) => n.sectionId),
    SCROLL_SPY_OFFSET,
  );

  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);
  const toggleMobileMenu = useCallback(
    () => setIsMobileMenuOpen((prev) => !prev),
    [],
  );

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= MOBILE_BREAKPOINT) setIsMobileMenuOpen(false);
    };
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <LazyMotion features={domAnimation}>
      <motion.header
        variants={headerVariants}
        initial="hidden"
        animate="visible"
        className="fixed top-0 z-50 w-full"
      >
        <div
          className={cn(
            "transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
            isScrolled
              ? "bg-background/70 backdrop-blur-2xl border-b border-border/15 shadow-[0_0_15px_rgba(0,0,0,0.04)]"
              : "bg-transparent",
          )}
        >
          {/* Gradient accent — visible on scroll */}
          <div
            className={cn(
              "absolute bottom-0 inset-x-0 h-px transition-opacity duration-700",
              isScrolled ? "opacity-100" : "opacity-0",
            )}
          >
            <div className="h-full bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
          </div>

          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-3">
            {/* Logo */}
            <motion.div variants={childVariants} className="flex-shrink-0">
              <Link
                href="/"
                className="group flex items-center gap-2.5 cursor-pointer"
              >
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 transition-all duration-300 group-hover:bg-primary/15 group-hover:ring-primary/30 group-hover:shadow-[0_0_20px_-5px] group-hover:shadow-primary/25">
                  <Image
                    src="/Github.svg"
                    alt="GitVision"
                    width={22}
                    height={22}
                    className="relative z-10 transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <span className="text-lg font-semibold tracking-tight text-foreground">
                  Git
                  <span className="text-primary">Vision</span>
                </span>
              </Link>
            </motion.div>

            {/* Center nav — desktop pill */}
            <motion.div
              variants={childVariants}
              className="hidden md:flex items-center gap-1 rounded-full border border-border/30 bg-muted/30 px-1.5 py-1"
            >
              {NAVIGATION.map((item) => (
                <NavLink
                  key={item.name}
                  item={item}
                  isActive={activeSection === item.sectionId}
                />
              ))}
            </motion.div>

            {/* Right section — desktop */}
            <div className="hidden md:flex items-center gap-2">
              <motion.div variants={childVariants}>
                <GitHubStarBadge />
              </motion.div>

              <motion.div variants={childVariants}>
                <ModeToggle />
              </motion.div>

              <motion.div
                variants={childVariants}
                className="flex items-center gap-2 ml-0.5"
              >
                {user ? (
                  <Link href="/dashboard">
                    <Button
                      size="sm"
                      className="h-8 rounded-full px-4 text-sm font-medium cursor-pointer shadow-sm shadow-primary/15 hover:shadow-md hover:shadow-primary/20 transition-all duration-200"
                    >
                      <ZapIcon className="mr-1.5 h-3.5 w-3.5" />
                      Dashboard
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link href="/sign-in">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-full px-3.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        Log in
                      </Button>
                    </Link>
                    <Link href="/sign-up">
                      <Button
                        size="sm"
                        className="group relative h-8 rounded-full px-4 text-sm font-medium cursor-pointer overflow-hidden bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20 hover:shadow-lg hover:shadow-primary/25 transition-all duration-300"
                      >
                        {/* Shimmer effect */}
                        <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
                        <span className="relative flex items-center gap-1">
                          Get Started
                          <ArrowRightIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                        </span>
                      </Button>
                    </Link>
                  </>
                )}
              </motion.div>
            </div>

            {/* Mobile controls */}
            <motion.div
              variants={childVariants}
              className="flex items-center gap-1.5 md:hidden"
            >
              <ModeToggle />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl cursor-pointer"
                onClick={toggleMobileMenu}
                aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={isMobileMenuOpen}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isMobileMenuOpen ? (
                    <motion.div
                      key="x"
                      initial={{ rotate: -90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: 90, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <XIcon className="h-5 w-5" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="menu"
                      initial={{ rotate: 90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: -90, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <MenuIcon className="h-5 w-5" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
            </motion.div>
          </nav>

          <MobileMenu
            isOpen={isMobileMenuOpen}
            navigation={NAVIGATION}
            activeSection={activeSection}
            isAuthenticated={!!user}
            onClose={closeMobileMenu}
          />
        </div>
      </motion.header>
    </LazyMotion>
  );
}

export default memo(LandingHeader);
