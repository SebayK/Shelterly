import { Download, FileWarning, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isImageDocumentType } from "./admin.helpers";
import type { VerificationDocumentPreviewProps } from "./types";

export default function VerificationDocumentPreview({
  state,
  shelterName,
  onRetry,
  onDownload,
}: VerificationDocumentPreviewProps) {
  if (state.status === "idle") {
    return (
      <div
        className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground"
        aria-label={`Przygotowanie podglądu dokumentu weryfikacyjnego schroniska ${shelterName}`}
        aria-live="polite"
      >
        Przygotowujemy podgląd dokumentu weryfikacyjnego dla wybranego zgłoszenia.
      </div>
    );
  }

  if (state.status === "missing") {
    return (
      <div
        className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground"
        aria-label={`Brak dokumentu weryfikacyjnego dla schroniska ${shelterName}`}
      >
        Rekord nie zawiera ścieżki do dokumentu weryfikacyjnego.
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        className="space-y-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"
        aria-label={`Błąd podglądu dokumentu weryfikacyjnego schroniska ${shelterName}`}
        role="alert"
      >
        <p>{state.errorMessage || "Nie udało się przygotować podglądu dokumentu."}</p>
        <Button type="button" variant="outline" onClick={onRetry}>
          <RefreshCcw aria-hidden="true" className="size-4" />
          Spróbuj ponownie
        </Button>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div
        className="h-48 animate-pulse rounded-2xl bg-muted"
        aria-label={`Ładowanie dokumentu weryfikacyjnego schroniska ${shelterName}`}
      />
    );
  }

  if (state.status === "success" && state.contentType === "application/pdf" && state.objectUrl) {
    return (
      <div className="space-y-3">
        <iframe
          src={state.objectUrl}
          title={`Podgląd dokumentu weryfikacyjnego schroniska ${shelterName}`}
          className="h-72 w-full rounded-2xl border border-border/70"
        />
        <Button type="button" variant="outline" onClick={onDownload}>
          <Download aria-hidden="true" className="size-4" />
          Pobierz dokument
        </Button>
      </div>
    );
  }

  if (state.status === "success" && isImageDocumentType(state.contentType) && state.objectUrl) {
    return (
      <div className="space-y-3">
        <img
          src={state.objectUrl}
          alt={`Dokument weryfikacyjny schroniska ${shelterName}`}
          className="max-h-96 w-full rounded-2xl border border-border/70 object-contain"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onDownload}>
            <Download aria-hidden="true" className="size-4" />
            Pobierz dokument
          </Button>
          <Button type="button" variant="ghost" onClick={onRetry}>
            <RefreshCcw aria-hidden="true" className="size-4" />
            Odśwież podgląd
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-dashed border-border bg-muted/20 p-4"
      aria-label={`Nieobsługiwany format dokumentu weryfikacyjnego schroniska ${shelterName}`}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-background p-2 text-muted-foreground">
          <FileWarning aria-hidden="true" className="size-4" />
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-medium text-foreground">Tego typu pliku nie można podejrzeć bezpośrednio w panelu.</p>
          <p className="text-muted-foreground">
            Dokument jest dostępny do pobrania. Jeśli serwer zwróci inny format po ponowieniu, możesz odświeżyć próbę.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onDownload}>
              <Download aria-hidden="true" className="size-4" />
              Pobierz dokument
            </Button>
            <Button type="button" variant="ghost" onClick={onRetry}>
              <RefreshCcw aria-hidden="true" className="size-4" />
              Spróbuj ponownie
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
