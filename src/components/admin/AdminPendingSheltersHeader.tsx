import { RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdminPendingSheltersHeaderProps } from "./types";

function formatPendingCountLabel(pendingCount: number): string {
  if (pendingCount === 1) {
    return "1 zgłoszenie oczekujące";
  }

  const lastTwoDigits = pendingCount % 100;
  const lastDigit = pendingCount % 10;

  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return `${pendingCount} zgłoszenia oczekujące`;
  }

  return `${pendingCount} zgłoszeń oczekujących`;
}

export default function AdminPendingSheltersHeader({
  pendingCount,
  isRefreshing,
  onRefresh,
}: AdminPendingSheltersHeaderProps) {
  const pendingCountLabel = formatPendingCountLabel(pendingCount);

  return (
    <header className="rounded-[28px] border border-border/70 bg-card/95 p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            Panel weryfikacji
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Zgłoszenia oczekujące na decyzję</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Przeglądaj nowe konta schronisk, sprawdzaj komplet danych i przygotuj decyzję administracyjną.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <div className="rounded-2xl bg-muted/50 px-4 py-3 text-sm" aria-live="polite">
            <p className="text-muted-foreground">Kolejka weryfikacji</p>
            <p className="text-2xl font-semibold text-foreground">{pendingCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">{pendingCountLabel}</p>
          </div>

          <Button type="button" variant="outline" onClick={onRefresh} disabled={isRefreshing}>
            <RefreshCw aria-hidden="true" className={isRefreshing ? "size-4 animate-spin" : "size-4"} />
            {isRefreshing ? "Odświeżanie..." : "Odśwież"}
          </Button>
        </div>
      </div>
    </header>
  );
}
