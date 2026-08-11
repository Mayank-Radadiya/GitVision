import Link from "next/link";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { ArrowRightIcon, ZapIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { mobileMenuVariants, mobileItemVariants } from "./variants";
import { GitHubStarBadge } from "./github-star-badge";
import type { NavItem } from "./constants";

interface MobileMenuProps {
  isOpen: boolean;
  navigation: NavItem[];
  activeSection: string | null;
  isAuthenticated: boolean;
  onClose: () => void;
}

export function MobileMenu({
  isOpen,
  navigation,
  activeSection,
  isAuthenticated,
  onClose,
}: MobileMenuProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={mobileMenuVariants}
          initial="closed"
          animate="open"
          exit="closed"
          className="border-border/20 overflow-hidden border-t md:hidden"
        >
          <div className="space-y-0.5 px-3 py-3">
            {navigation.map((item) => (
              <motion.div key={item.name} variants={mobileItemVariants}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex cursor-pointer items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    activeSection === item.sectionId
                      ? "bg-muted/60 text-foreground"
                      : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                  )}
                  onClick={onClose}
                >
                  {item.name}
                  {activeSection === item.sectionId && (
                    <div className="bg-primary ml-auto h-1.5 w-1.5 rounded-full" />
                  )}
                </Link>
              </motion.div>
            ))}

            <motion.div
              variants={mobileItemVariants}
              className="border-border/20 mt-2 space-y-2 border-t pt-3"
            >
              {isAuthenticated ? (
                <Link href="/dashboard" onClick={onClose}>
                  <Button className="h-11 w-full cursor-pointer justify-center rounded-xl font-medium">
                    <ZapIcon className="mr-2 h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/sign-in" onClick={onClose}>
                    <Button
                      variant="ghost"
                      className="text-muted-foreground h-11 w-full cursor-pointer justify-center rounded-xl"
                    >
                      Log in
                    </Button>
                  </Link>
                  <Link href="/sign-up" onClick={onClose}>
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 w-full cursor-pointer justify-center rounded-xl font-medium">
                      Get Started Free
                      <ArrowRightIcon className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </>
              )}

              <div className="flex items-center justify-center pt-1">
                <GitHubStarBadge />
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
