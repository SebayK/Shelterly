import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PendingSheltersPaginationProps } from "./types";

function formatResultsLabel(total: number): string {
  if (total === 1) {
    return "zgłoszenia";
  }

  const lastTwoDigits = total % 100;
  const lastDigit = total % 10;

  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return "zgłoszeń";
  }

  return "zgłoszeń";
}

export default function PendingSheltersPagination({
  pagination,
  isPending,
  onPrevPage,
  onNextPage,
}: PendingSheltersPaginationProps) {
  const resultsLabel = formatResultsLabel(pagination.total);

  return (
    <nav
      aria-label="Paginacja zgłoszeń schronisk"
      className="flex flex-col gap-3 rounded-[24px] border border-border/70 bg-card px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Pokazano {pagination.from}-{pagination.to} z {pagination.total} {resultsLabel}
      </p>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={onPrevPage} disabled={isPending || pagination.page <= 1}>
          <ChevronLeft aria-hidden="true" className="size-4" />
          Poprzednia
        </Button>
        <span className="min-w-20 text-center text-sm font-medium text-foreground">
          Strona {pagination.page} z {pagination.totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          onClick={onNextPage}
          disabled={isPending || pagination.page >= pagination.totalPages}
        >
          Następna
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </nav>
  );
}
