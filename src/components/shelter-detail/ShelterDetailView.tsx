import { useState, useMemo } from "react";
import type { NeedListItemDTO, NeedCategory, UrgencyLevel } from "../../types";
import { NeedsFilter } from "./NeedsFilter";
import { NeedCard } from "./NeedCard";

interface ShelterDetailViewProps {
  needs: NeedListItemDTO[];
}

interface FilterState {
  category: NeedCategory | "all";
  urgency: UrgencyLevel | "all";
}

export function ShelterDetailView({ needs }: ShelterDetailViewProps) {
  const [filters, setFilters] = useState<FilterState>({
    category: "all",
    urgency: "all",
  });

  // Filter needs based on current filter state
  const filteredNeeds = useMemo(() => {
    return needs.filter((need) => {
      const categoryMatch = filters.category === "all" || need.category === filters.category;
      const urgencyMatch = filters.urgency === "all" || need.urgency === filters.urgency;
      return categoryMatch && urgencyMatch;
    });
  }, [needs, filters]);

  const handleCategoryChange = (category: NeedCategory | "all") => {
    setFilters((prev) => ({ ...prev, category }));
  };

  const handleUrgencyChange = (urgency: UrgencyLevel | "all") => {
    setFilters((prev) => ({ ...prev, urgency }));
  };

  return (
    <section className="space-y-6">
      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Potrzeby schroniska</h2>
        <NeedsFilter
          onCategoryChange={handleCategoryChange}
          onUrgencyChange={handleUrgencyChange}
          currentCategory={filters.category}
          currentUrgency={filters.urgency}
        />
      </div>

      {/* Needs List */}
      {filteredNeeds.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNeeds.map((need) => (
            <NeedCard key={need.id} need={need} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <svg
            className="w-16 h-16 text-gray-400 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Brak potrzeb</h3>
          <p className="text-gray-600">
            {filters.category !== "all" || filters.urgency !== "all"
              ? "Nie znaleziono potrzeb pasujących do wybranych filtrów."
              : "To schronisko nie ma obecnie żadnych potrzeb."}
          </p>
        </div>
      )}
    </section>
  );
}
