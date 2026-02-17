import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { ProfileListItemDTO } from "@/types";
import { ShelterCard } from "./ShelterCard";
import { ShelterListSkeleton } from "./ShelterListSkeleton";
import { ShelterListEmpty } from "./ShelterListEmpty";

interface ShelterListProps {
  shelters: ProfileListItemDTO[];
  selectedShelterId: string | null;
  loading: boolean;
  hasMore: boolean;
  hasFilters: boolean;
  onShelterSelect: (id: string) => void;
  onLoadMore: () => void;
}

/**
 * Lista schronisk z możliwością paginacji
 * Obsługuje scroll do wybranego elementu i ładowanie kolejnych stron
 */
export function ShelterList({
  shelters,
  selectedShelterId,
  loading,
  hasMore,
  hasFilters,
  onShelterSelect,
  onLoadMore,
}: ShelterListProps) {
  const selectedRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Automatyczny scroll do zaznaczonego schroniska
  useEffect(() => {
    if (selectedShelterId && selectedRef.current && listRef.current) {
      const offsetTop = selectedRef.current.offsetTop;
      const containerHeight = listRef.current.clientHeight;
      const elementHeight = selectedRef.current.clientHeight;

      // Wycentruj element w kontenerze
      listRef.current.scrollTo({
        top: offsetTop - containerHeight / 2 + elementHeight / 2,
        behavior: "smooth",
      });
    }
  }, [selectedShelterId]);

  return (
    <div className="flex flex-col h-full">
      <div ref={listRef} role="list" aria-label="Lista schronisk" className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Stan ładowania początkowego */}
        {loading && shelters.length === 0 && <ShelterListSkeleton />}

        {/* Pusta lista */}
        {!loading && shelters.length === 0 && <ShelterListEmpty hasFilters={hasFilters} />}

        {/* Lista schronisk */}
        {shelters.map((shelter) => (
          <div key={shelter.id} ref={shelter.id === selectedShelterId ? selectedRef : null} role="listitem">
            <ShelterCard shelter={shelter} isSelected={shelter.id === selectedShelterId} onSelect={onShelterSelect} />
          </div>
        ))}

        {/* Przycisk "Załaduj więcej" */}
        {hasMore && !loading && shelters.length > 0 && (
          <div className="flex justify-center pt-4">
            <Button onClick={onLoadMore} variant="outline" size="sm">
              Załaduj więcej
            </Button>
          </div>
        )}

        {/* Loader podczas ładowania kolejnych stron */}
        {loading && shelters.length > 0 && (
          <div className="flex justify-center py-4">
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
              role="status"
              aria-label="Ładowanie kolejnych schronisk"
            >
              <span className="sr-only">Ładowanie...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
