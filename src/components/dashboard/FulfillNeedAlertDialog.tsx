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
import { Button } from "@/components/ui/button";
import type { FulfillNeedAlertDialogProps } from "./types";

export default function FulfillNeedAlertDialog({
  open,
  onOpenChange,
  need,
  onConfirm,
  isFulfilling,
}: FulfillNeedAlertDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Oznaczyć potrzebę jako zrealizowaną?</AlertDialogTitle>
          <AlertDialogDescription>
            {need
              ? `Potrzeba "${need.title}" zostanie oznaczona jako zrealizowana i zablokuje dalsze akcje edycji oraz realizacji.`
              : "Wybrana potrzeba zostanie oznaczona jako zrealizowana."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isFulfilling}>Anuluj</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                onConfirm();
              }}
              disabled={isFulfilling}
            >
              {isFulfilling ? "Zapisywanie..." : "Oznacz jako zrealizowaną"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
