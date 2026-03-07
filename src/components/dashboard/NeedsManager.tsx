import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNeeds } from "@/components/hooks/useNeeds";
import type { ErrorResponse, NeedCreateResponseDTO, NeedListItemDTO, NeedUpdateResponseDTO } from "@/types";
import { ACCOUNT_STATUS_LABELS, getCrudDisabledReason, getCrudDisabledShortHint } from "./constants";
import {
  getNeedMutationFailureMessage,
  getNeedMutationSuccessMessage,
  mapNeedMutationError,
} from "./need-mutation.helpers";
import { fetchWithTimeout, redirectToDashboardLogin } from "./request.helpers";
import DeleteNeedAlertDialog from "./DeleteNeedAlertDialog";
import FulfillNeedAlertDialog from "./FulfillNeedAlertDialog";
import NeedFormDialog from "./NeedFormDialog";
import NeedsPagination from "./NeedsPagination";
import NeedsTable from "./NeedsTable";
import NeedsTableEmpty from "./NeedsTableEmpty";
import NeedsTableSkeleton from "./NeedsTableSkeleton";
import NeedsToolbar from "./NeedsToolbar";
import type { NeedsManagerProps } from "./types";

export default function NeedsManager({ profileId, accountStatus, aiUsageCount, aiUsageLimit }: NeedsManagerProps) {
  const mutationTimeoutMs = 15_000;
  const [localAiUsageCount, setLocalAiUsageCount] = useState(aiUsageCount);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [formDialogMode, setFormDialogMode] = useState<"create" | "edit">("create");
  const [editingNeed, setEditingNeed] = useState<NeedListItemDTO | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingNeed, setDeletingNeed] = useState<NeedListItemDTO | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [fulfillDialogOpen, setFulfillDialogOpen] = useState(false);
  const [fulfillingNeed, setFulfillingNeed] = useState<NeedListItemDTO | null>(null);
  const [isFulfilling, setIsFulfilling] = useState(false);
  const [isPending, startPageTransition] = useTransition();
  const { needs, pagination, isLoading, error, currentPage, totalPages, refresh, nextPage, prevPage } =
    useNeeds(profileId);

  const isCrudDisabled = accountStatus !== "verified";
  const statusMessage = getCrudDisabledReason(accountStatus);
  const disabledShortHint = getCrudDisabledShortHint(accountStatus);

  const warnDisabledAction = () => {
    if (disabledShortHint) {
      toast.warning(disabledShortHint);
    }
  };

  const handleAddNeed = () => {
    if (isCrudDisabled) {
      warnDisabledAction();
      return;
    }

    setEditingNeed(null);
    setFormDialogMode("create");
    setFormDialogOpen(true);
  };

  const handleEditNeed = (need: NeedListItemDTO) => {
    if (isCrudDisabled) {
      warnDisabledAction();
      return;
    }

    setEditingNeed(need);
    setFormDialogMode("edit");
    setFormDialogOpen(true);
  };

  const handleDeleteNeed = (need: NeedListItemDTO) => {
    if (isCrudDisabled) {
      warnDisabledAction();
      return;
    }

    setDeletingNeed(need);
    setDeleteDialogOpen(true);
  };

  const handleFulfillNeed = (need: NeedListItemDTO) => {
    if (isCrudDisabled) {
      warnDisabledAction();
      return;
    }

    setFulfillingNeed(need);
    setFulfillDialogOpen(true);
  };

  const handleRetry = () => {
    startPageTransition(() => {
      void refresh();
    });
  };

  const handlePrevPage = () => {
    startPageTransition(() => {
      void prevPage();
    });
  };

  const handleNextPage = () => {
    startPageTransition(() => {
      void nextPage();
    });
  };

  const handleFormDialogChange = (open: boolean) => {
    setFormDialogOpen(open);
    if (!open) {
      setEditingNeed(null);
      setFormDialogMode("create");
    }
  };

  const handleNeedSaved = (_need: NeedCreateResponseDTO | NeedUpdateResponseDTO) => {
    startPageTransition(() => {
      void refresh();
    });
  };

  const handleAiUsageIncremented = () => {
    setLocalAiUsageCount((current) => current + 1);
  };

  const handleDeleteDialogChange = (open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open && !isDeleting) {
      setDeletingNeed(null);
    }
  };

  const handleFulfillDialogChange = (open: boolean) => {
    setFulfillDialogOpen(open);
    if (!open && !isFulfilling) {
      setFulfillingNeed(null);
    }
  };

  const refreshAfterDeletion = () => {
    startPageTransition(() => {
      if (needs.length === 1 && currentPage > 1) {
        void prevPage();
        return;
      }

      void refresh();
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deletingNeed) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetchWithTimeout(`/api/needs/${deletingNeed.id}`, { method: "DELETE" }, mutationTimeoutMs);

      if (!response.ok) {
        if (response.status === 401) {
          redirectToDashboardLogin();
          return;
        }

        const errorData = (await response.json()) as ErrorResponse;
        throw new Error(mapNeedMutationError(errorData, "delete"));
      }

      await response.json();
      toast.success(getNeedMutationSuccessMessage("delete", deletingNeed.title));
      setDeleteDialogOpen(false);
      setDeletingNeed(null);
      refreshAfterDeletion();
    } catch (error) {
      toast.error(getNeedMutationFailureMessage(error, "delete"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFulfillConfirm = async () => {
    if (!fulfillingNeed) {
      return;
    }

    setIsFulfilling(true);
    try {
      const response = await fetchWithTimeout(
        `/api/needs/${fulfillingNeed.id}/fulfill`,
        {
          method: "POST",
        },
        mutationTimeoutMs
      );

      if (!response.ok) {
        if (response.status === 401) {
          redirectToDashboardLogin();
          return;
        }

        const errorData = (await response.json()) as ErrorResponse;
        throw new Error(mapNeedMutationError(errorData, "fulfill"));
      }

      await response.json();
      toast.success(getNeedMutationSuccessMessage("fulfill", fulfillingNeed.title));
      setFulfillDialogOpen(false);
      setFulfillingNeed(null);
      startPageTransition(() => {
        void refresh();
      });
    } catch (error) {
      toast.error(getNeedMutationFailureMessage(error, "fulfill"));
    } finally {
      setIsFulfilling(false);
    }
  };

  return (
    <section className="space-y-6">
      <DeleteNeedAlertDialog
        open={deleteDialogOpen}
        onOpenChange={handleDeleteDialogChange}
        need={deletingNeed}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
      <FulfillNeedAlertDialog
        open={fulfillDialogOpen}
        onOpenChange={handleFulfillDialogChange}
        need={fulfillingNeed}
        onConfirm={handleFulfillConfirm}
        isFulfilling={isFulfilling}
      />
      <NeedFormDialog
        open={formDialogOpen}
        onOpenChange={handleFormDialogChange}
        mode={formDialogMode}
        initialData={editingNeed}
        shelterId={profileId}
        onSuccess={handleNeedSaved}
        aiUsageCount={localAiUsageCount}
        aiUsageLimit={aiUsageLimit}
        onAiUsageIncremented={handleAiUsageIncremented}
      />

      <NeedsToolbar
        totalNeeds={pagination?.total ?? needs.length}
        onAddNeed={handleAddNeed}
        isDisabled={isCrudDisabled}
        disabledReason={statusMessage}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          {statusMessage && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
              <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              <p className="text-sm">{statusMessage}</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="font-medium text-destructive">Nie udało się wczytać listy potrzeb</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button type="button" variant="outline" onClick={handleRetry} disabled={isPending}>
                Spróbuj ponownie
              </Button>
            </div>
          )}

          {(isLoading || isPending) && <NeedsTableSkeleton />}

          {!isLoading && !isPending && !error && needs.length === 0 && (
            <NeedsTableEmpty onAddNeed={handleAddNeed} isDisabled={isCrudDisabled} disabledReason={statusMessage} />
          )}

          {!isLoading && !isPending && !error && needs.length > 0 && (
            <>
              <NeedsTable
                needs={needs}
                onEdit={handleEditNeed}
                onDelete={handleDeleteNeed}
                onFulfill={handleFulfillNeed}
                isDisabled={isCrudDisabled}
                disabledReason={statusMessage}
              />
              {pagination && totalPages > 1 && (
                <NeedsPagination
                  pagination={pagination}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPrevPage={handlePrevPage}
                  onNextPage={handleNextPage}
                />
              )}
            </>
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles aria-hidden="true" className="size-5" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">Asystent AI</p>
                <p className="text-sm text-muted-foreground">
                  Generowanie opisu i linku zakupowego AI jest już dostępne po zapisaniu potrzeby w formularzu.
                </p>
              </div>
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2">
                <dt className="text-muted-foreground">Wykorzystanie</dt>
                <dd className="font-medium">
                  {localAiUsageCount}/{aiUsageLimit}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2">
                <dt className="text-muted-foreground">Status konta</dt>
                <dd className="font-medium">{ACCOUNT_STATUS_LABELS[accountStatus]}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </section>
  );
}
