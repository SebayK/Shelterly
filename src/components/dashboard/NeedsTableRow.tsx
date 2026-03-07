import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { NEED_CATEGORY_LABELS, NEED_UNIT_LABELS, URGENCY_CONFIG } from "./constants";
import NeedActions from "./NeedActions";
import type { NeedsTableRowProps } from "./types";

function formatQuantity(value: number, unit: keyof typeof NEED_UNIT_LABELS): string {
  return `${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(value)} ${NEED_UNIT_LABELS[unit]}`;
}

export default function NeedsTableRow({
  need,
  onEdit,
  onDelete,
  onFulfill,
  isDisabled,
  disabledReason,
}: NeedsTableRowProps) {
  const progressLabel = `${formatQuantity(need.current_quantity, need.unit)} z ${formatQuantity(need.target_quantity, need.unit)}`;

  return (
    <tr className={cn("border-b align-top", need.is_fulfilled && "opacity-55")}>
      <td className="px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{NEED_CATEGORY_LABELS[need.category]}</Badge>
          {need.is_fulfilled && (
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Zrealizowana</Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="space-y-1">
          <p className="font-medium text-foreground">{need.title}</p>
          {need.description && <p className="max-w-xl text-sm text-muted-foreground">{need.description}</p>}
        </div>
      </td>
      <td className="px-4 py-4">
        <Badge variant="outline" className={URGENCY_CONFIG[need.urgency].className}>
          {URGENCY_CONFIG[need.urgency].label}
        </Badge>
      </td>
      <td className="px-4 py-4">
        <div className="min-w-[14rem] space-y-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">{need.progress_percentage}%</span>
            <span className="text-muted-foreground">{progressLabel}</span>
          </div>
          <Progress value={need.progress_percentage} aria-label={`Postęp realizacji: ${need.title}`} />
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex justify-end">
          <NeedActions
            onEdit={onEdit}
            onDelete={onDelete}
            onFulfill={onFulfill}
            isDisabled={isDisabled}
            isFulfilled={need.is_fulfilled}
            disabledReason={disabledReason}
          />
        </div>
      </td>
    </tr>
  );
}
