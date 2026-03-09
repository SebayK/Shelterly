import { useState, useEffect, useCallback } from "react";
import type { ProfileListItemDTO, ProfileListResponseDTO, ProfilesQueryParams } from "@/types";

interface UseSheltersOptions {
  latitude?: number | null;
  longitude?: number | null;
  urgentOnly?: boolean;
  limit?: number;
}

interface UseSheltersResult {
  shelters: ProfileListItemDTO[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

/**
 * Hook do pobierania listy schronisk z API
 * Obsługuje paginację, filtry i sortowanie
 */
export function useShelters(options: UseSheltersOptions = {}): UseSheltersResult {
  const { latitude, longitude, urgentOnly = false, limit = 20 } = options;

  const [shelters, setShelters] = useState<ProfileListItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchShelters = useCallback(
    async (pageNum: number, append = false) => {
      try {
        setLoading(true);
        setError(null);

        // Buduj query params
        const offset = (pageNum - 1) * limit;
        const params: ProfilesQueryParams = {
          offset,
          limit,
        };

        // Dodaj geolokalizację jeśli dostępna
        if (latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined) {
          params.lat = latitude;
          params.lon = longitude;
        }

        // Dodaj filtr pilności
        if (urgentOnly) {
          params.urgent_only = true;
        }

        // Konwertuj params na query string
        const queryString = new URLSearchParams(
          Object.entries(params).reduce(
            (acc, [key, value]) => {
              if (value !== undefined && value !== null) {
                acc[key] = String(value);
              }
              return acc;
            },
            {} as Record<string, string>
          )
        ).toString();

        // Wykonaj request
        const response = await fetch(`/api/profiles?${queryString}`);

        if (!response.ok) {
          throw new Error(`Błąd pobierania schronisk: ${response.status}`);
        }

        const data: ProfileListResponseDTO = await response.json();

        // Aktualizuj stan
        setShelters((prev) => (append ? [...prev, ...data.data] : data.data));
        setHasMore(data.data.length === limit && data.pagination.total > offset + data.data.length);
        setLoading(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Nieznany błąd";
        setError(errorMessage);
        setLoading(false);
      }
    },
    [latitude, longitude, urgentOnly, limit]
  );

  // Pobierz dane przy montowaniu lub zmianie opcji
  useEffect(() => {
    setPage(1);
    setShelters([]);
    setHasMore(true);
    fetchShelters(1, false);
  }, [fetchShelters]);

  // Załaduj więcej
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchShelters(nextPage, true);
    }
  }, [loading, hasMore, page, fetchShelters]);

  // Odśwież listę
  const refresh = useCallback(() => {
    setPage(1);
    setShelters([]);
    setHasMore(true);
    fetchShelters(1, false);
  }, [fetchShelters]);

  return {
    shelters,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}
