import type { KeyboardEvent } from "react";
import { FileText, Mail, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PendingSheltersTableProps } from "./types";

function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, onSelect: () => void) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  onSelect();
}

export default function PendingSheltersTable({
  rows,
  selectedShelterId,
  isLoading,
  onSelect,
}: PendingSheltersTableProps) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-sm">
      <div className="border-b border-border/70 px-6 py-4">
        <h3 className="text-base font-semibold text-foreground">Lista zgłoszeń</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Wybierz wiersz, aby otworzyć szczegóły zgłoszenia w panelu review.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <caption className="sr-only">Lista schronisk oczekujących na decyzję administracyjną</caption>
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th scope="col" className="px-6 py-3 font-medium">
                Schronisko
              </th>
              <th scope="col" className="px-6 py-3 font-medium">
                Kontakt
              </th>
              <th scope="col" className="px-6 py-3 font-medium">
                Dokument
              </th>
              <th scope="col" className="px-6 py-3 font-medium">
                Data zgłoszenia
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={`pending-shelter-skeleton-${index}`} className="border-t border-border/60">
                  <td className="px-6 py-4">
                    <div className="h-4 w-36 animate-pulse rounded-full bg-muted" />
                    <div className="mt-2 h-3 w-24 animate-pulse rounded-full bg-muted" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-40 animate-pulse rounded-full bg-muted" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-6 w-28 animate-pulse rounded-full bg-muted" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 w-28 animate-pulse rounded-full bg-muted" />
                  </td>
                </tr>
              ))}

            {!isLoading &&
              rows.map((row) => {
                const isSelected = row.id === selectedShelterId;

                return (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    aria-selected={isSelected}
                    onClick={() => onSelect(row.id)}
                    onKeyDown={(event) => handleRowKeyDown(event, () => onSelect(row.id))}
                    className={cn(
                      "cursor-pointer border-t border-border/60 align-top outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/40",
                      isSelected && "bg-accent/50"
                    )}
                  >
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <p className="font-medium text-foreground">{row.name}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin aria-hidden="true" className="size-3.5" />
                            {row.city}
                          </span>
                          <span>NIP: {row.nip}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Mail aria-hidden="true" className="size-3.5" />
                        {row.email}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={row.hasVerificationDocument ? "secondary" : "outline"}>
                        <FileText aria-hidden="true" className="size-3.5" />
                        {row.documentStatusLabel}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{row.createdAtLabel}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
