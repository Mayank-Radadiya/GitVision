/**
 * =============================================================================
 * SIDEBAR CUSTOM HOOKS
 * =============================================================================
 *
 * This file contains all business logic and state management for the Sidebar.
 * Separating hooks from UI components allows for:
 * - Easier testing of business logic
 * - Reuse of logic across different UI implementations
 * - Clear separation of concerns
 *
 * @module Sidebar/hooks
 */

"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

// =============================================================================
// MOBILE SIDEBAR HOOK
// =============================================================================

/**
 * Manages mobile sidebar open/close state
 *
 * Features:
 * - Tracks if mobile drawer is open
 * - Auto-closes on route changes (navigation)
 * - Provides open/close handlers
 *
 * @returns Mobile sidebar state and handlers
 *
 * @example
 * ```tsx
 * const { isMobileOpen, openMobile, closeMobile } = useMobileSidebar();
 * ```
 */
export function useMobileSidebar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Auto-close mobile sidebar when user navigates to a new route
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  return {
    /** Whether the mobile sidebar drawer is currently open */
    isMobileOpen,
    /** Open the mobile sidebar drawer */
    openMobile: () => setIsMobileOpen(true),
    /** Close the mobile sidebar drawer */
    closeMobile: () => setIsMobileOpen(false),
  };
}

// =============================================================================
// ACTIVE ROUTE HOOK
// =============================================================================

/**
 * Determines if a given route is currently active
 *
 * Uses Next.js pathname to check if the current route matches
 * the provided href. Useful for highlighting active nav items.
 *
 * @param href - The route path to check
 * @returns Whether the route is currently active
 *
 * @example
 * ```tsx
 * const isActive = useIsActiveRoute("/dashboard");
 * // Returns true if current URL is /dashboard
 * ```
 */
export function useIsActiveRoute(href: string): boolean {
  const pathname = usePathname();
  return pathname === href;
}

// =============================================================================
// CURRENT PATH HOOK
// =============================================================================

/**
 * Returns the current pathname for route matching
 *
 * Thin wrapper around Next.js usePathname for consistency.
 *
 * @returns Current URL pathname
 */
export function useCurrentPath(): string {
  return usePathname();
}
