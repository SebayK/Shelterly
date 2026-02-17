import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet.markercluster";
import { useEffect, memo } from "react";
import type { ProfileListItemDTO, Location } from "@/types";
import { ShelterMarker } from "./ShelterMarker";

interface MapViewProps {
  shelters: ProfileListItemDTO[];
  userLocation: Location | null;
  selectedShelterId: string | null;
  onShelterSelect: (id: string) => void;
}

/**
 * Komponent pomocniczy do aktualizacji widoku mapy
 * Memoizowany aby uniknąć niepotrzebnych aktualizacji
 */
const MapUpdater = memo(function MapUpdater({
  shelters,
  userLocation,
}: {
  shelters: ProfileListItemDTO[];
  userLocation: Location | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (shelters.length === 0) return;

    // Zbierz wszystkie punkty (schroniska + lokalizacja użytkownika)
    const points: [number, number][] = shelters.map((s) => [s.location.lat, s.location.lon]);

    if (userLocation) {
      points.push([userLocation.lat, userLocation.lon]);
    }

    // Dopasuj widok mapy do wszystkich punktów
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 12,
      });
    }
  }, [shelters, userLocation, map]);

  return null;
});

/**
 * Główny komponent mapy z Leaflet
 * Wyświetla schroniska jako markery z klasterowaniem
 * Memoizowany dla lepszej wydajności
 */
function MapViewComponent({ shelters, userLocation, selectedShelterId, onShelterSelect }: MapViewProps) {
  // Domyślny widok: centrum Polski
  const defaultCenter: [number, number] = [51.9194, 19.1451];
  const defaultZoom = 6;

  // Ikona dla lokalizacji użytkownika
  const userLocationIcon = L.divIcon({
    className: "user-location-marker",
    html: `
      <div style="
        width: 20px;
        height: 20px;
        background-color: #3b82f6;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3), 0 2px 8px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        className="h-full w-full z-0"
        scrollWheelZoom={true}
        zoomControl={true}
        attributionControl={true}
      >
        {/* TileLayer - mapa podkładowa z OpenStreetMap */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Aktualizacja widoku mapy */}
        <MapUpdater shelters={shelters} userLocation={userLocation} />

        {/* Marker lokalizacji użytkownika */}
        {userLocation && <Marker position={[userLocation.lat, userLocation.lon]} icon={userLocationIcon} />}

        {/* Markery schronisk z klasterowaniem */}
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={60}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
          zoomToBoundsOnClick={true}
          iconCreateFunction={(cluster: L.MarkerCluster) => {
            const count = cluster.getChildCount();
            const size = count < 10 ? 40 : count < 100 ? 50 : 60;

            return L.divIcon({
              html: `
                <div style="
                  width: ${size}px;
                  height: ${size}px;
                  background-color: #3b82f6;
                  border: 3px solid white;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  font-weight: bold;
                  font-size: ${size / 3}px;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                ">
                  ${count}
                </div>
              `,
              className: "custom-cluster-icon",
              iconSize: [size, size],
            });
          }}
        >
          {shelters.map((shelter) => (
            <ShelterMarker
              key={shelter.id}
              shelter={shelter}
              isSelected={shelter.id === selectedShelterId}
              onSelect={onShelterSelect}
            />
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      {/* Overlay z atrybutami dostępności */}
      <div role="application" aria-label="Mapa schronisk dla zwierząt" className="sr-only">
        Interaktywna mapa pokazująca {shelters.length} schronisk dla zwierząt w Polsce
      </div>
    </div>
  );
}

// Memoizacja głównego komponentu mapy
export const MapView = memo(MapViewComponent);
