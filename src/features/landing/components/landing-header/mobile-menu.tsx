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
          className="overflow-hidden border-t border-border/20 md:hidden"
        >
          <div className="px-3 py-3 space-y-0.5">
            {navigation.map((item) => (
              <motion.div key={item.name} variants={mobileItemVariants}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                    activeSection === item.sectionId
                      ? "bg-muted/60 text-foreground"
                      : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                  )}
                  onClick={onClose}
                >
                  {item.name}
                  {activeSection === item.sectionId && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </Link>
              </motion.div>
            ))}

            <motion.div
              variants={mobileItemVariants}
              className="pt-3 border-t border-border/20 mt-2 space-y-2"
            >
              {isAuthenticated ? (
                <Link href="/dashboard" onClick={onClose}>
                  <Button className="w-full justify-center rounded-xl h-11 font-medium cursor-pointer">
                    <ZapIcon className="mr-2 h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/sign-in" onClick={onClose}>
                    <Button
                      variant="ghost"
                      className="w-full justify-center rounded-xl h-11 text-muted-foreground cursor-pointer"
                    >
                      Log in
                    </Button>
                  </Link>
                  <Link href="/sign-up" onClick={onClose}>
                    <Button className="w-full justify-center rounded-xl h-11 font-medium bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer">
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
