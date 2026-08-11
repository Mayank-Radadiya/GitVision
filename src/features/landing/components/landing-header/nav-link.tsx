import Link from "next/link";
import { cn } from "@/shared/lib/utils";
import { motion } from "framer-motion";
import { childVariants } from "./variants";
import type { NavItem } from "./constants";

interface NavLinkProps {
  item: NavItem;
  isActive: boolean;
}

export function NavLink({ item, isActive }: NavLinkProps) {
  return (
    <motion.div variants={childVariants}>
      <Link
        href={item.href}
        className={cn(
          "relative cursor-pointer px-3 py-1.5 text-sm font-medium transition-colors duration-200",
          isActive
            ? "text-foreground"
            : "text-muted-foreground/70 hover:text-foreground",
        )}
      >
        {item.name}
        {isActive && (
          <motion.span
            layoutId="active-nav"
            className="bg-muted/60 absolute inset-0 -z-10 rounded-full"
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
          />
        )}
      </Link>
    </motion.div>
  );
}
