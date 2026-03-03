import { useState, useEffect, useRef, memo } from "react";

interface ShelterFiltersProps {
  urgentOnly: boolean;
  searchQuery: string;
  onUrgentOnlyChange: (value: boolean) => void;
  onCitySearchChange: (value: string) => void;
}

/**
 * Pasek filtrów nad listą schronisk
 * Zawiera toggle "Tylko pilne potrzeby" i pole wyszukiwania po mieście
 * Memoizowany dla lepszej wydajności
 */
function ShelterFiltersComponent({
  urgentOnly,
  searchQuery,
  onUrgentOnlyChange,
  onCitySearchChange,
}: ShelterFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce dla wyszukiwania - 300ms
  useEffect(() => {
    // Wyczyść poprzedni timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Ustaw nowy timeout
    debounceRef.current = setTimeout(() => {
      onCitySearchChange(localSearch.trim());
    }, 300);

    // Cleanup
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [localSearch, onCitySearchChange]);

  return (
    <div role="search" className="space-y-3 mb-4 p-4 bg-white rounded-lg shadow-sm">
      {/* Toggle dla pilnych potrzeb */}
      <div className="flex items-center justify-between">
        <label htmlFor="urgent-filter" className="text-sm font-medium text-gray-700">
          Tylko pilne potrzeby
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={urgentOnly}
          id="urgent-filter"
          onClick={() => onUrgentOnlyChange(!urgentOnly)}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            ${urgentOnly ? "bg-blue-600" : "bg-gray-200"}
          `}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
              ${urgentOnly ? "translate-x-6" : "translate-x-1"}
            `}
          />
        </button>
      </div>

      {/* Pole wyszukiwania po mieście */}
      <div>
        <label htmlFor="city-search" className="sr-only">
          Szukaj po mieście
        </label>
        <input
          type="text"
          id="city-search"
          placeholder="Szukaj miasta..."
          aria-label="Szukaj po mieście"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="
            w-full px-3 py-2 text-sm border border-gray-300 rounded-md
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            placeholder:text-gray-400
          "
        />
      </div>
    </div>
  );
}

// Memoizacja komponentu
export const ShelterFilters = memo(ShelterFiltersComponent);
