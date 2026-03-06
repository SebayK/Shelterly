import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NeedsPaginationProps } from "./types";

export default function NeedsPagination({
  pagination,
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
}: NeedsPaginationProps) {
  const startItem = pagination.total === 0 ? 0 : pagination.offset + 1;
  const endItem = Math.min(pagination.offset + pagination.limit, pagination.total);

  return (
    <nav
      aria-label="Paginacja potrzeb"
      className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-muted-foreground">
        Wyświetlasz <span className="font-medium text-foreground">{startItem}</span>-
        <span className="font-medium text-foreground">{endItem}</span> z{" "}
        <span className="font-medium text-foreground">{pagination.total}</span>
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="text-sm text-muted-foreground" aria-live="polite">
          Strona <span className="font-medium text-foreground">{currentPage}</span> z{" "}
          <span className="font-medium text-foreground">{totalPages}</span>
        </span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onPrevPage} disabled={currentPage <= 1}>
            <ChevronLeft aria-hidden="true" />
            Poprzednia
          </Button>
          <Button type="button" variant="outline" onClick={onNextPage} disabled={currentPage >= totalPages}>
            Następna
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
