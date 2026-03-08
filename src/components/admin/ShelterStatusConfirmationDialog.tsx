import { useEffect, useId, useRef } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import type { ShelterStatusConfirmationDialogProps } from "./types";

export default function ShelterStatusConfirmationDialog({
  open,
  mode,
  shelterName,
  rejectionReason,
  rejectionReasonError,
  isSubmitting,
  onOpenChange,
  onRejectionReasonChange,
  onConfirm,
}: ShelterStatusConfirmationDialogProps) {
  const isRejectedMode = mode === "rejected";
  const rejectionReasonFieldId = useId();
  const rejectionReasonHintId = useId();
  const rejectionReasonErrorId = useId();
  const rejectionReasonDescribedBy = rejectionReasonError ? rejectionReasonErrorId : rejectionReasonHintId;
  const rejectionReasonRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open || !isRejectedMode) {
      return;
    }

    rejectionReasonRef.current?.focus();
  }, [isRejectedMode, open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isRejectedMode ? "Potwierdź odrzucenie zgłoszenia" : "Potwierdź aktywację schroniska"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isRejectedMode
              ? `Podaj powód odrzucenia dla ${shelterName || "wybranego schroniska"} zgodny z wymaganiami API.`
              : `Po zatwierdzeniu ${shelterName || "wybrane schronisko"} uzyska dostęp do dashboardu.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isRejectedMode && (
          <div className="space-y-2">
            <label htmlFor={rejectionReasonFieldId} className="text-sm font-medium text-foreground">
              Powód odrzucenia
            </label>
            <Textarea
              ref={rejectionReasonRef}
              id={rejectionReasonFieldId}
              value={rejectionReason}
              onChange={(event) => onRejectionReasonChange(event.target.value)}
              placeholder="Wpisz powód odrzucenia"
              aria-invalid={Boolean(rejectionReasonError)}
              aria-describedby={rejectionReasonDescribedBy}
            />
            {!rejectionReasonError && (
              <p id={rejectionReasonHintId} className="text-sm text-muted-foreground">
                Wpisz minimum 3 znaki i maksymalnie 500 znaków.
              </p>
            )}
            {rejectionReasonError && (
              <p id={rejectionReasonErrorId} className="text-sm text-destructive">
                {rejectionReasonError}
              </p>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Anuluj</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Zapisywanie..." : isRejectedMode ? "Potwierdź odrzucenie" : "Potwierdź zatwierdzenie"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
