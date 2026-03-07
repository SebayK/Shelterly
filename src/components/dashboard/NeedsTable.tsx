import type { NeedListItemDTO } from "@/types";
import NeedsTableRow from "./NeedsTableRow";
import type { NeedsTableProps } from "./types";

const columnHeaders = ["Kategoria", "Tytuł", "Pilność", "Postęp", "Akcje"] as const;

function noopHandler(_need: NeedListItemDTO) {
  return;
}

export default function NeedsTable({
  needs,
  onEdit = noopHandler,
  onDelete = noopHandler,
  onFulfill = noopHandler,
  isDisabled,
  disabledReason,
}: NeedsTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table role="table" className="min-w-full border-collapse text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              {columnHeaders.map((columnHeader) => (
                <th key={columnHeader} scope="col" className="px-4 py-3 font-medium">
                  {columnHeader}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {needs.map((need) => (
              <NeedsTableRow
                key={need.id}
                need={need}
                onEdit={() => onEdit(need)}
                onDelete={() => onDelete(need)}
                onFulfill={() => onFulfill(need)}
                isDisabled={isDisabled}
                disabledReason={disabledReason}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
