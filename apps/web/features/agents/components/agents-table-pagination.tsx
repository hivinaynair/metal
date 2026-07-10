"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

export function AgentsTablePagination({
  start,
  pageSize,
  totalCount,
  currentPage,
  totalPages,
  onPageChange,
}: {
  start: number
  pageSize: number
  totalCount: number
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4 text-sm text-muted-foreground">
      {totalCount > 0 ? (
        <span>
          Showing{" "}
          <span className="font-semibold text-foreground">
            {start + 1}-{Math.min(start + pageSize, totalCount)}
          </span>{" "}
          of {totalCount}
        </span>
      ) : (
        <span>Showing 0 of 0</span>
      )}
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === 1}
          className="gap-2 text-muted-foreground"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        >
          <ChevronLeft className="size-4" />
          Prev
        </Button>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map(
          (pageNumber) => (
            <Button
              key={pageNumber}
              variant={pageNumber === currentPage ? "default" : "outline"}
              size="sm"
              className={cn(
                "min-w-10 px-3 font-mono",
                pageNumber === currentPage
                  ? "bg-foreground text-background hover:bg-foreground/90"
                  : "text-muted-foreground"
              )}
              onClick={() => onPageChange(pageNumber)}
            >
              {pageNumber}
            </Button>
          )
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === totalPages}
          className="gap-2 text-foreground"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
