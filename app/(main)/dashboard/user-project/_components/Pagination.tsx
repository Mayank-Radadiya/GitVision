"use client";

import { Button } from "@/components/ui/button";
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
      <div className="inline-flex items-center gap-1 rounded-md border border-muted bg-background px-3 py-2 shadow-sm">
        {/* First Page */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          aria-label="First page"
        >
          <span className="sr-only">First</span>«
        </Button>

        {/* Previous Page */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <span className="sr-only">Previous</span>←
        </Button>

        {/* Page Info */}
        <span className="px-2 text-sm font-medium text-muted-foreground">
          Page <span className="text-foreground">{currentPage}</span> of{" "}
          <span className="text-foreground">{totalPages}</span>
        </span>

        {/* Next Page */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          <span className="sr-only">Next</span>→
        </Button>

        {/* Last Page */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          aria-label="Last page"
        >
          <span className="sr-only">Last</span>»
        </Button>
      </div>
    </div>
  );
};

export default memo(Pagination);
