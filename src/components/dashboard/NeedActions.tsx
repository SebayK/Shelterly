import { CheckCircle2, Ellipsis, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DisabledActionTooltip from "./DisabledActionTooltip";
import type { NeedActionsProps } from "./types";

export default function NeedActions({
  onEdit,
  onDelete,
  onFulfill,
  isDisabled,
  isFulfilled,
  disabledReason,
}: NeedActionsProps) {
  const editDisabled = isDisabled || isFulfilled;
  const fulfillDisabled = isDisabled || isFulfilled;

  return (
    <DropdownMenu>
      <DisabledActionTooltip disabled={isDisabled} content={disabledReason}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="icon-sm" aria-label="Otwórz menu akcji potrzeby">
            <Ellipsis aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
      </DisabledActionTooltip>
      <DropdownMenuContent align="end">
        {isDisabled && disabledReason && (
          <>
            <DropdownMenuLabel className="max-w-56 whitespace-normal text-muted-foreground">
              {disabledReason}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        {!isDisabled && isFulfilled && (
          <>
            <DropdownMenuLabel className="max-w-56 whitespace-normal text-muted-foreground">
              Ta potrzeba jest już zrealizowana.
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={onEdit} disabled={editDisabled}>
          <Pencil aria-hidden="true" />
          Edytuj
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onFulfill} disabled={fulfillDisabled}>
          <CheckCircle2 aria-hidden="true" />
          Oznacz jako zrealizowaną
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} disabled={isDisabled} variant="destructive">
          <Trash2 aria-hidden="true" />
          Usuń
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
