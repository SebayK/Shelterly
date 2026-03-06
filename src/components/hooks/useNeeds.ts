import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ErrorResponse, NeedListItemDTO, NeedListResponseDTO, Pagination } from "@/types";

const DEFAULT_PAGE_SIZE = 10;
const FETCH_TIMEOUT_MS = 15_000;

function mapNeedsFetchError(errorData: ErrorResponse): string {
  switch (errorData.error.code) {
    case "VALIDATION_ERROR":
    case "INVALID_REQUEST":
      return "Nie udało się wczytać listy potrzeb z powodu nieprawidłowych parametrów.";
    case "NOT_FOUND":
      return "Nie znaleziono potrzeb dla tego schroniska.";
    case "INTERNAL_ERROR":
      return "Serwer nie mógł pobrać potrzeb. Spróbuj ponownie za chwilę.";
    case "SERVICE_UNAVAILABLE":
      return "Usługa jest chwilowo niedostępna. Spróbuj ponownie później.";
    default:
      return errorData.error.message || "Nie udało się pobrać listy potrzeb.";
  }
}

export interface UseNeedsResult {
  needs: NeedListItemDTO[];
  pagination: Pagination | null;
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  fetchNeeds: (page?: number) => Promise<void>;
  refresh: () => Promise<void>;
  goToPage: (page: number) => Promise<void>;
  nextPage: () => Promise<void>;
  prevPage: () => Promise<void>;
}

export function useNeeds(shelterId: string, pageSize = DEFAULT_PAGE_SIZE): UseNeedsResult {
  const [needs, setNeeds] = useState<NeedListItemDTO[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const activeRequestIdRef = useRef(0);
  const activeControllerRef = useRef<AbortController | null>(null);

  const fetchNeeds = useCallback(
    async (page = 1) => {
      if (!shelterId) {
        activeControllerRef.current?.abort();
        activeControllerRef.current = null;
        setNeeds([]);
        setPagination(null);
        setIsLoading(false);
        setError("Brakuje identyfikatora schroniska.");
        return;
      }

      const safePage = Number.isFinite(page) && page > 0 ? page : 1;
      const offset = (safePage - 1) * pageSize;
      const requestId = activeRequestIdRef.current + 1;
      const controller = new AbortController();
      let didTimeout = false;

      activeRequestIdRef.current = requestId;
      activeControllerRef.current?.abort();
      activeControllerRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const searchParams = new URLSearchParams({
          shelter_id: shelterId,
          limit: String(pageSize),
          offset: String(offset),
        });

        const timerId = window.setTimeout(() => {
          didTimeout = true;
          controller.abort();
        }, FETCH_TIMEOUT_MS);

        const response = await fetch(`/api/needs?${searchParams.toString()}`, {
          signal: controller.signal,
        }).finally(() => {
          window.clearTimeout(timerId);
        });

        if (activeRequestIdRef.current !== requestId) {
          return;
        }

        if (!response.ok) {
          try {
            const errorData = (await response.json()) as ErrorResponse;
            setError(mapNeedsFetchError(errorData));
          } catch {
            setError("Nie udało się pobrać listy potrzeb.");
          }
          return;
        }

        const payload = (await response.json()) as NeedListResponseDTO;
        setNeeds(payload.data);
        setPagination(payload.pagination);
        setCurrentPage(safePage);
      } catch (fetchError) {
        if (activeRequestIdRef.current !== requestId) {
          return;
        }

        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          if (didTimeout) {
            setError("Przekroczono czas oczekiwania na listę potrzeb. Spróbuj ponownie.");
          }
          return;
        }

        setError("Nie można połączyć się z serwerem. Sprawdź połączenie internetowe.");
      } finally {
        if (activeRequestIdRef.current === requestId) {
          activeControllerRef.current = null;
          setIsLoading(false);
        }
      }
    },
    [pageSize, shelterId]
  );

  useEffect(() => {
    void fetchNeeds(1);

    return () => {
      activeControllerRef.current?.abort();
      activeControllerRef.current = null;
    };
  }, [fetchNeeds]);

  const totalPages = useMemo(() => {
    if (!pagination) {
      return 1;
    }

    return Math.max(1, Math.ceil(pagination.total / pagination.limit));
  }, [pagination]);

  const goToPage = useCallback(
    async (page: number) => {
      const boundedPage = Math.max(1, Math.min(page, totalPages));
      await fetchNeeds(boundedPage);
    },
    [fetchNeeds, totalPages]
  );

  const nextPage = useCallback(async () => {
    await goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const prevPage = useCallback(async () => {
    await goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const refresh = useCallback(async () => {
    await fetchNeeds(currentPage);
  }, [currentPage, fetchNeeds]);

  return {
    needs,
    pagination,
    isLoading,
    error,
    currentPage,
    totalPages,
    fetchNeeds,
    refresh,
    goToPage,
    nextPage,
    prevPage,
  };
}
