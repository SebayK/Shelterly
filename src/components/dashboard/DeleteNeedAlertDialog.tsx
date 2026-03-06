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
import type { DeleteNeedAlertDialogProps } from "./types";

export default function DeleteNeedAlertDialog({
  open,
  onOpenChange,
  need,
  onConfirm,
  isDeleting,
}: DeleteNeedAlertDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Usunąć potrzebę?</AlertDialogTitle>
          <AlertDialogDescription>
            {need
              ? `Ta operacja usunie potrzebę "${need.title}" z listy. Nie cofnie to wcześniejszych danych o darowiznach.`
              : "Ta operacja usunie wybraną potrzebę z listy."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Anuluj</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              type="button"
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                onConfirm();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "Usuwanie..." : "Usuń potrzebę"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
