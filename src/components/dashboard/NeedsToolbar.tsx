import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import DisabledActionTooltip from "./DisabledActionTooltip";
import type { NeedsToolbarProps } from "./types";

export default function NeedsToolbar({ totalNeeds, onAddNeed, isDisabled, disabledReason }: NeedsToolbarProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Potrzeby schroniska</h2>
        <p className="text-sm text-muted-foreground">
          Zarządzaj bieżącą listą potrzeb i monitoruj postęp realizacji darowizn.
        </p>
        {isDisabled && disabledReason && <p className="text-sm font-medium text-amber-700">{disabledReason}</p>}
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="text-sm text-muted-foreground" aria-live="polite">
          Łącznie: <span className="font-medium text-foreground">{totalNeeds}</span>
        </span>
        <DisabledActionTooltip disabled={isDisabled} content={disabledReason}>
          <Button type="button" onClick={onAddNeed} disabled={isDisabled}>
            <Plus aria-hidden="true" />
            Dodaj potrzebę
          </Button>
        </DisabledActionTooltip>
      </div>
    </div>
  );
}
