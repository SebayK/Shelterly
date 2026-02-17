import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProfileListItemDTO } from "@/types";

interface ShelterCardProps {
  shelter: ProfileListItemDTO;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

/**
 * Karta pojedynczego schroniska w liście
 * Wyświetla nazwę, miasto, odległość, liczbę potrzeb i flagę pilności
 * Memoizowana dla lepszej wydajności
 */
function ShelterCardComponent({ shelter, isSelected, onSelect }: ShelterCardProps) {
  const handleClick = () => {
    onSelect(shelter.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(shelter.id);
    }
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`
        cursor-pointer transition-all hover:shadow-md
        ${isSelected ? "ring-2 ring-blue-500 shadow-lg" : ""}
      `}
      aria-pressed={isSelected}
      aria-label={`Schronisko ${shelter.name} w ${shelter.city}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg line-clamp-2">{shelter.name}</CardTitle>
          {shelter.has_urgent_needs && (
            <span
              className="flex-shrink-0 px-2 py-1 text-xs font-semibold text-white bg-red-500 rounded"
              aria-label="Ma pilne potrzeby"
            >
              Pilne
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm text-gray-600">
          {/* Miasto */}
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>{shelter.city}</span>
          </div>

          {/* Odległość (jeśli dostępna) */}
          {shelter.distance_km !== null && shelter.distance_km !== undefined && (
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>
                {shelter.distance_km < 1
                  ? `${Math.round(shelter.distance_km * 1000)} m`
                  : `${shelter.distance_km.toFixed(1)} km`}
              </span>
            </div>
          )}

          {/* Liczba potrzeb */}
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>
              {shelter.needs_count === 0
                ? "Brak aktywnych potrzeb"
                : `${shelter.needs_count} ${shelter.needs_count === 1 ? "potrzeba" : shelter.needs_count < 5 ? "potrzeby" : "potrzeb"}`}
            </span>
          </div>
        </div>

        {/* Link do szczegółów */}
        <a
          href={`/shelters/${shelter.id}`}
          className="inline-block mt-4 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Zobacz szczegóły →
        </a>
      </CardContent>
    </Card>
  );
}

// Memoizacja komponentu dla lepszej wydajności
export const ShelterCard = memo(ShelterCardComponent);
