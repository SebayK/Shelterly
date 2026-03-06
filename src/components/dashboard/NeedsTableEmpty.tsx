import { PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import DisabledActionTooltip from "./DisabledActionTooltip";
import type { NeedsTableEmptyProps } from "./types";

export default function NeedsTableEmpty({ onAddNeed, isDisabled, disabledReason }: NeedsTableEmptyProps) {
  return (
    <section className="rounded-2xl border border-dashed bg-card/70 px-6 py-12 text-center shadow-sm">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <PackagePlus aria-hidden="true" className="size-7" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">Brak aktywnych potrzeb</h3>
          <p className="text-sm text-muted-foreground">
            Dodaj pierwszą potrzebę, aby darczyńcy mogli szybciej zobaczyć, czego aktualnie potrzebuje schronisko.
          </p>
        </div>
        <DisabledActionTooltip disabled={isDisabled} content={disabledReason}>
          <Button type="button" onClick={onAddNeed} disabled={isDisabled}>
            Dodaj pierwszą potrzebę
          </Button>
        </DisabledActionTooltip>
      </div>
    </section>
  );
}
