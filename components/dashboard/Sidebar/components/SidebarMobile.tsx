/**
 * =============================================================================
 * SIDEBAR MOBILE COMPONENTS
 * =============================================================================
 *
 * Mobile-specific sidebar components:
 * - Mobile menu trigger button
 * - Mobile overlay backdrop
 * - Mobile drawer container
 *
 * @module Sidebar/components/SidebarMobile
 */

"use client";

import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { SIDEBAR_SPRING_CONFIG } from "../sidebar.constants";

// =============================================================================
// MOBILE MENU BUTTON
// =============================================================================

interface MobileMenuButtonProps {
  /** Callback when menu button is clicked */
  onClick: () => void;
}

/**
 * Floating menu button for mobile viewport
 * Fixed position in top-left corner
 */
export function MobileMenuButton({ onClick }: MobileMenuButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label="Open navigation menu"
      className="fixed left-4 top-4 z-50 h-10 w-10 rounded-xl bg-background/80 shadow-lg backdrop-blur-sm md:hidden"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}

// =============================================================================
// MOBILE OVERLAY
// =============================================================================

interface MobileOverlayProps {
  /** Whether overlay is visible */
  isOpen: boolean;
  /** Callback when overlay is clicked (to close) */
  onClose: () => void;
}

/**
 * Semi-transparent backdrop behind mobile sidebar
 * Clicking closes the sidebar
 */
export function MobileOverlay({ isOpen, onClose }: MobileOverlayProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          aria-hidden="true"
          className="fixed inset-0 z-[90] bg-background/80 backdrop-blur-sm md:hidden"
        />
      )}
    </AnimatePresence>
  );
}

// =============================================================================
// MOBILE DRAWER
// =============================================================================

interface MobileDrawerProps {
  /** Whether drawer is visible */
  isOpen: boolean;
  /** Callback to close drawer */
  onClose: () => void;
  /** Drawer content (SidebarContent component) */
  children: React.ReactNode;
}

/**
 * Slide-in drawer container for mobile sidebar
 * Includes close button and glass effect background
 */
export function MobileDrawer({ isOpen, onClose, children }: MobileDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={SIDEBAR_SPRING_CONFIG}
          className="fixed inset-y-0 left-0 z-[100] w-72 md:hidden"
        >
          <div className="relative h-full bg-background/95 shadow-2xl backdrop-blur-xl">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close navigation menu"
              className="absolute right-3 top-3 h-8 w-8 rounded-lg"
            >
              <X className="h-4 w-4" />
            </Button>
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
