"use client";

import { Menu, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/shared/components/ui/button";
import { SIDEBAR_SPRING_CONFIG } from "../sidebar.constants";

interface MobileMenuButtonProps {
  /** Callback when menu button is clicked */
  onClick: () => void;
}

/**
 * Compact menu trigger button for mobile viewports.
 */
export function MobileMenuButton({ onClick }: MobileMenuButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label="Open navigation menu"
      className="border-border/80 bg-background/90 hover:bg-accent fixed top-3.5 left-3.5 z-50 h-9 w-9 rounded-lg border shadow-md backdrop-blur-md md:hidden"
    >
      <Menu className="h-4.5 w-4.5" strokeWidth={1.75} />
    </Button>
  );
}

interface MobileOverlayProps {
  /** Whether overlay is visible */
  isOpen: boolean;
  /** Callback when overlay is clicked (to close) */
  onClose: () => void;
}

/**
 * Semi-transparent backdrop behind the mobile navigation drawer.
 */
export function MobileOverlay({ isOpen, onClose }: MobileOverlayProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          aria-hidden="true"
          className="fixed inset-0 z-90 bg-black/60 backdrop-blur-[2px] md:hidden"
        />
      )}
    </AnimatePresence>
  );
}

interface MobileDrawerProps {
  /** Whether drawer is visible */
  isOpen: boolean;
  /** Callback to close drawer */
  onClose: () => void;
  /** Drawer content (SidebarContent component) */
  children: React.ReactNode;
}

/**
 * Slide-in modal navigation drawer for mobile viewports.
 */
export function MobileDrawer({ isOpen, onClose, children }: MobileDrawerProps) {
  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AnimatePresence>
        {isOpen && (
          // forceMount keeps the drawer mounted through its exit animation,
          // which Radix would otherwise unmount as soon as `open` goes false.
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Content forceMount asChild>
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={SIDEBAR_SPRING_CONFIG}
                className="fixed inset-y-0 left-0 z-100 w-72 outline-none md:hidden"
              >
                <DialogPrimitive.Title className="sr-only">
                  Navigation menu
                </DialogPrimitive.Title>
                <div className="sidebar-rail border-sidebar-border relative h-full overflow-hidden border-r shadow-2xl">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    aria-label="Close navigation menu"
                    className="text-muted-foreground hover:bg-sidebar-accent hover:text-foreground absolute top-3.5 right-3 z-20 h-7 w-7 rounded-md"
                  >
                    <X className="h-4 w-4" strokeWidth={1.75} />
                  </Button>
                  {children}
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
