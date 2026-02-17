import { useState, useMemo, useCallback } from "react";
import { useGeolocation } from "@/components/hooks/useGeolocation";
import { useShelters } from "@/components/hooks/useShelters";
import { MapView } from "./MapView";
import { ShelterList } from "./ShelterList";
import { ShelterFilters } from "./ShelterFilters";
import { LocationBanner } from "./LocationBanner";
import { MobileViewToggle } from "./MobileViewToggle";

type MobileView = "map" | "list";

/**
 * Główny komponent widoku Shelter Explorer
 * Orkiestruje mapę, listę schronisk, filtry i geolokalizację
 */
export function ShelterExplorer() {
  // Stan geolokalizacji
  const geolocation = useGeolocation();

  // Stan filtrów
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [citySearch, setCitySearch] = useState("");

  // Stan widoku mobilnego
  const [mobileView, setMobileView] = useState<MobileView>("map");

  // Stan zaznaczonego schroniska
  const [selectedShelterId, setSelectedShelterId] = useState<string | null>(null);

  // Stan banera lokalizacji
  const [showLocationBanner, setShowLocationBanner] = useState(true);

  // Pobieranie schronisk z API
  const {
    shelters: allShelters,
    loading,
    error,
    hasMore,
    loadMore,
  } = useShelters({
    latitude: geolocation.latitude,
    longitude: geolocation.longitude,
    urgentOnly,
    limit: 20,
  });

  // Filtrowanie lokalne po mieście (client-side)
  const filteredShelters = useMemo(() => {
    if (!citySearch.trim()) {
      return allShelters;
    }

    const searchLower = citySearch.toLowerCase().trim();
    return allShelters.filter((shelter) => shelter.city.toLowerCase().includes(searchLower));
  }, [allShelters, citySearch]);

  // Handler wyboru schroniska
  const handleShelterSelect = useCallback((id: string) => {
    setSelectedShelterId(id);
    // Na mobile przełącz na listę po kliknięciu markera
    if (window.innerWidth < 768) {
      setMobileView("list");
    }
  }, []);

  // Handler zmiany filtra pilności
  const handleUrgentOnlyChange = useCallback((value: boolean) => {
    setUrgentOnly(value);
    setSelectedShelterId(null);
  }, []);

  // Handler zmiany wyszukiwania
  const handleCitySearchChange = useCallback((value: string) => {
    setCitySearch(value);
    setSelectedShelterId(null);
  }, []);

  // Handler zmiany widoku mobilnego
  const handleMobileViewChange = useCallback((view: MobileView) => {
    setMobileView(view);
  }, []);

  // Przygotuj lokalizację użytkownika
  const userLocation =
    geolocation.latitude !== null && geolocation.longitude !== null
      ? { lat: geolocation.latitude, lon: geolocation.longitude }
      : null;

  // Czy pokazać baner lokalizacji
  const shouldShowLocationBanner =
    showLocationBanner && (geolocation.denied || geolocation.error) && !geolocation.loading;

  // Czy są aktywne filtry
  const hasActiveFilters = urgentOnly || citySearch.trim().length > 0;

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Baner lokalizacji */}
      {shouldShowLocationBanner && (
        <LocationBanner visible={shouldShowLocationBanner} onDismiss={() => setShowLocationBanner(false)} />
      )}

      {/* Główny layout - split view na desktop, single view na mobile */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Mapa - widoczna zawsze na desktop, warunkowo na mobile */}
        <div
          className={`
            w-full md:w-3/5 h-full
            ${mobileView === "map" ? "block" : "hidden md:block"}
          `}
        >
          {geolocation.loading ? (
            <div className="h-full w-full flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <div
                  className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"
                  role="status"
                  aria-label="Ładowanie mapy"
                />
                <p className="text-gray-600">Ładowanie mapy...</p>
              </div>
            </div>
          ) : (
            <MapView
              shelters={filteredShelters}
              userLocation={userLocation}
              selectedShelterId={selectedShelterId}
              onShelterSelect={handleShelterSelect}
            />
          )}
        </div>

        {/* Lista - widoczna zawsze na desktop, warunkowo na mobile */}
        <div
          className={`
            w-full md:w-2/5 h-full flex flex-col bg-gray-50
            ${mobileView === "list" ? "block" : "hidden md:block"}
          `}
        >
          {/* Filtry */}
          <div className="flex-shrink-0">
            <ShelterFilters
              urgentOnly={urgentOnly}
              searchQuery={citySearch}
              onUrgentOnlyChange={handleUrgentOnlyChange}
              onCitySearchChange={handleCitySearchChange}
            />
          </div>

          {/* Komunikat o błędzie */}
          {error && (
            <div role="alert" className="mx-4 mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
              <p className="font-semibold">Błąd ładowania schronisk</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Lista schronisk */}
          <div className="flex-1 overflow-hidden">
            <ShelterList
              shelters={filteredShelters}
              selectedShelterId={selectedShelterId}
              loading={loading}
              hasMore={hasMore}
              hasFilters={hasActiveFilters}
              onShelterSelect={handleShelterSelect}
              onLoadMore={loadMore}
            />
          </div>
        </div>
      </div>

      {/* Przełącznik widoku mobilnego (FAB) */}
      <MobileViewToggle currentView={mobileView} onViewChange={handleMobileViewChange} />
    </div>
  );
}
