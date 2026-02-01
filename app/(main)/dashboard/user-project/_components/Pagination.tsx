"use client";

import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { memo } from "react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) => {
  return (
    <div className="mt-10 flex justify-center">
      <div className="inline-flex items-center gap-2 rounded-xl border border-border/40 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-xl px-4 py-3 shadow-lg">
        {/* First Page */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 hover:bg-primary/10 transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          aria-label="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* Previous Page */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 hover:bg-primary/10 transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Page Info */}
        <div className="px-4 py-1.5 bg-primary/10 rounded-lg mx-1">
          <span className="text-sm font-medium text-muted-foreground font-[family-name:var(--font-fira-sans)]">
            Page{" "}
            <span className="text-foreground font-semibold font-[family-name:var(--font-fira-code)]">
              {currentPage}
            </span>{" "}
            of{" "}
            <span className="text-foreground font-semibold font-[family-name:var(--font-fira-code)]">
              {totalPages}
            </span>
          </span>
        </div>

        {/* Next Page */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 hover:bg-primary/10 transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Last Page */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 hover:bg-primary/10 transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          aria-label="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default memo(Pagination);
