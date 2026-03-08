import { useCallback, useEffect, useState } from "react";
import type { PendingShelterListItemDTO, PendingShelterListResponseDTO } from "@/types";
import {
  createAdminRequestError,
  formatAdminPagination,
  formatPendingShelterRow,
  getPendingSheltersErrorMessage,
} from "@/components/admin/admin.helpers";
import { fetchWithTimeout, redirectToAdminDashboard, redirectToAdminLogin } from "@/components/admin/request.helpers";
import type {
  AdminListFiltersVM,
  AdminPaginationVM,
  PendingShelterRowVM,
  UseAdminPendingSheltersResult,
} from "@/components/admin/types";

export function useAdminPendingShelters(filters: AdminListFiltersVM): UseAdminPendingSheltersResult {
  const { page, pageSize } = filters;
  const [shelters, setShelters] = useState<PendingShelterListItemDTO[]>([]);
  const [rows, setRows] = useState<PendingShelterRowVM[]>([]);
  const [pagination, setPagination] = useState<AdminPaginationVM | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPendingShelters = useCallback(
    async (signal?: AbortSignal) => {
      const offset = (page - 1) * pageSize;
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });

      const response = await fetchWithTimeout(`/api/admin/shelters/pending?${params.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        signal,
      });

      if (!response.ok) {
        let payload: unknown = null;

        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        if (response.status === 401) {
          redirectToAdminLogin();
          throw new Error("Sesja wygasła. Zaloguj się ponownie.");
        }

        if (response.status === 403) {
          redirectToAdminDashboard();
          throw new Error("Brak uprawnień do panelu administracyjnego.");
        }

        throw createAdminRequestError(
          payload,
          getPendingSheltersErrorMessage(payload, "Nie udało się pobrać zgłoszeń oczekujących."),
          response.status
        );
      }

      const payload = (await response.json()) as PendingShelterListResponseDTO;

      if (signal?.aborted) {
        return;
      }

      setShelters(payload.data);
      setRows(payload.data.map(formatPendingShelterRow));
      setPagination(formatAdminPagination(payload.pagination, page));
      setError(null);
    },
    [page, pageSize]
  );

  useEffect(() => {
    const controller = new AbortController();

    setIsLoading(true);

    void fetchPendingShelters(controller.signal)
      .catch((err: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setError(err instanceof Error ? err.message : "Nieznany błąd podczas pobierania zgłoszeń.");
        setShelters([]);
        setRows([]);
        setPagination(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [fetchPendingShelters]);

  const refetch = useCallback(async () => {
    setIsRefreshing(true);

    try {
      await fetchPendingShelters();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd podczas odświeżania zgłoszeń.");
      throw err;
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchPendingShelters]);

  return {
    shelters,
    rows,
    pagination,
    isLoading,
    isRefreshing,
    error,
    refetch,
  };
}
