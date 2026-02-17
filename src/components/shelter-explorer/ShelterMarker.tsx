import { memo } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { ProfileListItemDTO } from "@/types";

interface ShelterMarkerProps {
  shelter: ProfileListItemDTO;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

/**
 * Marker pojedynczego schroniska na mapie
 * Różne kolory w zależności od pilności potrzeb
 * Memoizowany dla lepszej wydajności
 */
function ShelterMarkerComponent({ shelter, isSelected, onSelect }: ShelterMarkerProps) {
  // Niestandardowe ikony dla markerów
  const createIcon = (isUrgent: boolean, selected: boolean) => {
    const color = isUrgent ? "#dc2626" : "#2563eb"; // czerwony dla pilnych, niebieski dla normalnych
    const size = selected ? 35 : 25;

    return L.divIcon({
      className: "custom-marker",
      html: `
        <div style="
          width: ${size}px;
          height: ${size}px;
          background-color: ${color};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ${selected ? "box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.3);" : ""}
          transition: all 0.2s ease;
        "></div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  };

  const icon = createIcon(shelter.has_urgent_needs, isSelected);

  const handleClick = () => {
    onSelect(shelter.id);
  };

  return (
    <Marker
      position={[shelter.location.lat, shelter.location.lon]}
      icon={icon}
      eventHandlers={{
        click: handleClick,
      }}
    >
      <Popup>
        <div className="p-2 min-w-[200px]">
          <h3 className="font-semibold text-base mb-2">{shelter.name}</h3>
          <div className="space-y-1 text-sm text-gray-600">
            <p className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{shelter.city}</span>
            </p>
            <p className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>
                {shelter.needs_count === 0
                  ? "Brak potrzeb"
                  : `${shelter.needs_count} ${shelter.needs_count === 1 ? "potrzeba" : shelter.needs_count < 5 ? "potrzeby" : "potrzeb"}`}
              </span>
            </p>
            {shelter.has_urgent_needs && (
              <span className="inline-block px-2 py-1 text-xs font-semibold text-white bg-red-500 rounded mt-2">
                Pilne potrzeby
              </span>
            )}
          </div>
          <a
            href={`/shelters/${shelter.id}`}
            className="inline-block mt-3 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            Zobacz szczegóły →
          </a>
        </div>
      </Popup>
    </Marker>
  );
}

// Memoizacja komponentu
export const ShelterMarker = memo(ShelterMarkerComponent);
