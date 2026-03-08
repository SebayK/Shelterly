import { useEffect, useState, useTransition } from "react";
import { AlertCircle, Inbox } from "lucide-react";
import { toast } from "sonner";
import AdminPendingSheltersHeader from "./AdminPendingSheltersHeader";
import PendingSheltersPagination from "./PendingSheltersPagination";
import PendingSheltersTable from "./PendingSheltersTable";
import ShelterReviewPanel from "./ShelterReviewPanel";
import ShelterStatusConfirmationDialog from "./ShelterStatusConfirmationDialog";
import { AdminRequestError, formatShelterReview, validateRejectionReason } from "./admin.helpers";
import { useAdminPendingShelters } from "@/components/hooks/useAdminPendingShelters";
import { useShelterVerificationDocument } from "@/components/hooks/useShelterVerificationDocument";
import { useUpdateShelterStatus } from "@/components/hooks/useUpdateShelterStatus";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminPendingSheltersViewProps, AdminReviewDecision } from "./types";

const PAGE_SIZE = 10;

export default function AdminPendingSheltersView({ currentUser }: AdminPendingSheltersViewProps) {
  const [page, setPage] = useState(1);
  const [selectedShelterId, setSelectedShelterId] = useState<string | null>(null);
  const [confirmationDialogMode, setConfirmationDialogMode] = useState<AdminReviewDecision | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionReasonError, setRejectionReasonError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { shelters, rows, pagination, isLoading, isRefreshing, error, refetch } = useAdminPendingShelters({
    page,
    pageSize: PAGE_SIZE,
  });
  const { updateStatus, isPending: isSubmitting, errorMessage: updateErrorMessage } = useUpdateShelterStatus();

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedShelterId(null);
      return;
    }

    const hasSelectedShelter = selectedShelterId !== null && rows.some((row) => row.id === selectedShelterId);

    if (!hasSelectedShelter) {
      setSelectedShelterId(null);
    }
  }, [rows, selectedShelterId]);

  const selectedShelter = shelters.find((shelter) => shelter.id === selectedShelterId) ?? null;
  const reviewShelter = selectedShelter ? formatShelterReview(selectedShelter) : null;
  const {
    documentState,
    retry: retryDocument,
    download: downloadDocument,
  } = useShelterVerificationDocument({
    shelterId: reviewShelter?.id ?? null,
    verificationDocumentPath: reviewShelter?.verificationDocumentPath ?? null,
    enabled: Boolean(reviewShelter),
  });

  useEffect(() => {
    if (!confirmationDialogMode || !updateErrorMessage) {
      return;
    }

    if (confirmationDialogMode === "rejected") {
      setRejectionReasonError(updateErrorMessage);
      return;
    }

    toast.error(updateErrorMessage);
  }, [confirmationDialogMode, updateErrorMessage]);

  const actionState = {
    isSubmitting,
    pendingDecision: confirmationDialogMode,
  };

  const actionsDisabledReason = !reviewShelter
    ? "Wybierz zgłoszenie z tabeli, aby odblokować akcje administracyjne."
    : !reviewShelter.hasVerificationDocument
      ? "Decyzje są zablokowane, dopóki rekord nie ma dokumentu weryfikacyjnego."
      : undefined;

  const handleRefresh = () => {
    startTransition(() => {
      void refetch().catch(() => undefined);
    });
  };

  const handlePrevPage = () => {
    startTransition(() => {
      setPage((currentPage) => Math.max(1, currentPage - 1));
    });
  };

  const handleNextPage = () => {
    startTransition(() => {
      setPage((currentPage) => {
        if (!pagination) {
          return currentPage + 1;
        }

        return Math.min(pagination.totalPages, currentPage + 1);
      });
    });
  };

  const closeConfirmationDialog = () => {
    setConfirmationDialogMode(null);
    setRejectionReason("");
    setRejectionReasonError(null);
  };

  const handleApprove = () => {
    setRejectionReason("");
    setRejectionReasonError(null);
    setConfirmationDialogMode("verified");
  };

  const handleReject = () => {
    setRejectionReasonError(null);
    setConfirmationDialogMode("rejected");
  };

  const handleConfirmDecision = async () => {
    if (!reviewShelter || !confirmationDialogMode) {
      return;
    }

    if (confirmationDialogMode === "rejected") {
      const validationMessage = validateRejectionReason(rejectionReason);

      if (validationMessage) {
        setRejectionReasonError(validationMessage);
        return;
      }
    }

    try {
      await updateStatus({
        shelterId: reviewShelter.id,
        command:
          confirmationDialogMode === "verified"
            ? { status: "verified" }
            : { status: "rejected", rejection_reason: rejectionReason.trim() },
      });

      toast.success(
        confirmationDialogMode === "verified"
          ? `Schronisko ${reviewShelter.name} zostało zatwierdzone.`
          : `Zgłoszenie schroniska ${reviewShelter.name} zostało odrzucone.`
      );

      closeConfirmationDialog();
      setSelectedShelterId(null);

      if (rows.length === 1 && page > 1) {
        setPage((currentPage) => Math.max(1, currentPage - 1));
        return;
      }

      await refetch();
    } catch (error) {
      if (error instanceof AdminRequestError && error.status === 404) {
        toast.error("To zgłoszenie nie jest już dostępne. Lista zostanie odświeżona.");
        setSelectedShelterId(null);
        closeConfirmationDialog();
        void refetch().catch(() => undefined);
        return;
      }

      if (confirmationDialogMode !== "rejected") {
        toast.error(error instanceof Error ? error.message : "Nie udało się zapisać decyzji administracyjnej.");
      }
    }
  };

  return (
    <section className="space-y-6">
      <ShelterStatusConfirmationDialog
        open={confirmationDialogMode !== null}
        mode={confirmationDialogMode}
        shelterName={reviewShelter?.name ?? null}
        rejectionReason={rejectionReason}
        rejectionReasonError={rejectionReasonError}
        isSubmitting={isSubmitting}
        onOpenChange={(open) => {
          if (!open) {
            closeConfirmationDialog();
          }
        }}
        onRejectionReasonChange={(value) => {
          setRejectionReason(value);

          if (rejectionReasonError) {
            setRejectionReasonError(validateRejectionReason(value));
          }
        }}
        onConfirm={() => {
          void handleConfirmDecision();
        }}
      />

      <AdminPendingSheltersHeader
        pendingCount={pagination?.total ?? rows.length}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {error && (
            <Card className="border-destructive/20 bg-destructive/5 py-0">
              <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="flex items-center gap-2 font-medium text-destructive">
                    <AlertCircle aria-hidden="true" className="size-4" />
                    Nie udało się wczytać zgłoszeń
                  </p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>

                <Button type="button" variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
                  Spróbuj ponownie
                </Button>
              </CardContent>
            </Card>
          )}

          {!error && !isLoading && rows.length === 0 && (
            <Card className="py-0">
              <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                <div className="rounded-full bg-muted p-3 text-muted-foreground">
                  <Inbox aria-hidden="true" className="size-6" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Brak zgłoszeń oczekujących na weryfikację</p>
                  <p className="text-sm text-muted-foreground">
                    {currentUser.name
                      ? `${currentUser.name}, obecnie nie ma żadnych kont wymagających decyzji.`
                      : "Obecnie nie ma żadnych kont wymagających decyzji."}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {(isLoading || rows.length > 0) && (
            <>
              <PendingSheltersTable
                rows={rows}
                selectedShelterId={selectedShelterId}
                isLoading={isLoading}
                onSelect={setSelectedShelterId}
              />

              {pagination && pagination.totalPages > 1 && (
                <PendingSheltersPagination
                  pagination={pagination}
                  isPending={isPending || isRefreshing}
                  onPrevPage={handlePrevPage}
                  onNextPage={handleNextPage}
                />
              )}
            </>
          )}
        </div>

        <aside className="hidden rounded-[28px] border border-border/70 bg-card p-6 shadow-sm xl:block">
          <h3 className="text-base font-semibold text-foreground">Tryb pracy panelu</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Wybierz zgłoszenie, przejrzyj dokument i podejmij decyzję. Po zatwierdzeniu lub odrzuceniu rekord znika z
            listy oczekujących bez przeładowania strony.
          </p>
          <div className="mt-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
            <h4 className="text-sm font-medium text-foreground">Szybka checklista</h4>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              <li>Zweryfikuj, czy nazwa, NIP i miasto są spójne z dokumentem.</li>
              <li>Sprawdź adres e-mail i kompletność pliku weryfikacyjnego.</li>
              <li>Po decyzji upewnij się, że rekord zniknął z kolejki oczekujących.</li>
            </ul>
          </div>
        </aside>
      </div>

      <ShelterReviewPanel
        open={Boolean(reviewShelter)}
        shelter={reviewShelter}
        documentState={documentState}
        actionState={actionState}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedShelterId(null);
          }
        }}
        onApprove={handleApprove}
        onReject={handleReject}
        onRetryDocument={retryDocument}
        onDownloadDocument={downloadDocument}
        actionsDisabledReason={actionsDisabledReason}
      />
    </section>
  );
}
