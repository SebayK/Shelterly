import { Building2, FileCheck2, Mail, MapPin, Stamp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import VerificationDocumentPreview from "./VerificationDocumentPreview";
import type { ShelterReviewPanelProps } from "./types";

export default function ShelterReviewPanel({
  open,
  shelter,
  documentState,
  actionState,
  onOpenChange,
  onApprove,
  onReject,
  onRetryDocument,
  onDownloadDocument,
  actionsDisabledReason,
}: ShelterReviewPanelProps) {
  const actionsDisabled = !shelter || actionState.isSubmitting || Boolean(actionsDisabledReason);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full border-l border-border/70 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border/70 px-6 py-6">
          <SheetTitle>Review zgłoszenia</SheetTitle>
          <SheetDescription>
            {shelter
              ? "Sprawdź dane schroniska i przygotuj decyzję administracyjną."
              : "Wybierz zgłoszenie z tabeli, aby zobaczyć szczegóły."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {!shelter && <p className="text-sm text-muted-foreground">Brak aktywnie wybranego zgłoszenia.</p>}

          {shelter && (
            <>
              <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-primary/10 p-2 text-primary">
                      <Building2 aria-hidden="true" className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{shelter.name}</h3>
                      <p className="text-sm text-muted-foreground">ID profilu: {shelter.id}</p>
                    </div>
                  </div>

                  <dl className="grid gap-3 text-sm">
                    <div className="flex items-start gap-3 rounded-xl bg-muted/30 px-3 py-3">
                      <Stamp aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
                      <div>
                        <dt className="text-muted-foreground">NIP</dt>
                        <dd className="font-medium text-foreground">{shelter.nip}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl bg-muted/30 px-3 py-3">
                      <MapPin aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
                      <div>
                        <dt className="text-muted-foreground">Miasto</dt>
                        <dd className="font-medium text-foreground">{shelter.city}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl bg-muted/30 px-3 py-3">
                      <Mail aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
                      <div>
                        <dt className="text-muted-foreground">Adres e-mail</dt>
                        <dd className="font-medium text-foreground">{shelter.email}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl bg-muted/30 px-3 py-3">
                      <FileCheck2 aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground" />
                      <div>
                        <dt className="text-muted-foreground">Data zgłoszenia</dt>
                        <dd className="font-medium text-foreground">{shelter.createdAtLabel}</dd>
                      </div>
                    </div>
                  </dl>
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Dokument weryfikacyjny</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Dokument jest pobierany przez prywatny endpoint administracyjny i renderowany inline, jeśli typ MIME
                    na to pozwala.
                  </p>
                </div>

                <VerificationDocumentPreview
                  state={documentState}
                  shelterName={shelter.name}
                  onRetry={onRetryDocument}
                  onDownload={onDownloadDocument}
                />
              </section>
            </>
          )}
        </div>

        <SheetFooter className="border-t border-border/70 bg-background/95 px-6 py-4">
          {actionsDisabledReason && <p className="text-sm text-muted-foreground">{actionsDisabledReason}</p>}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onReject} disabled={actionsDisabled}>
              {actionState.isSubmitting && actionState.pendingDecision === "rejected"
                ? "Odrzucanie..."
                : "Odrzuć zgłoszenie"}
            </Button>
            <Button type="button" onClick={onApprove} disabled={actionsDisabled}>
              {actionState.isSubmitting && actionState.pendingDecision === "verified"
                ? "Zatwierdzanie..."
                : "Zatwierdź schronisko"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
