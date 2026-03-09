import { memo, useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap } from "react-leaflet";

import type { Location } from "@/types";

interface ProfileLocationPreviewMapClientProps {
  location: Location;
  formattedAddress?: string;
}

const PREVIEW_ZOOM = 15;

const PreviewMapUpdater = memo(function PreviewMapUpdater({ location }: { location: Location }) {
  const map = useMap();

  useEffect(() => {
    map.setView([location.lat, location.lon], PREVIEW_ZOOM, {
      animate: false,
    });
  }, [location, map]);

  return null;
});

function ProfileLocationPreviewMapClientComponent({ location, formattedAddress }: ProfileLocationPreviewMapClientProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b bg-muted/40 px-4 py-3">
        <p className="text-sm font-medium">Podgląd lokalizacji</p>
        <p className="text-xs text-muted-foreground">
          {formattedAddress ?? `Współrzędne: ${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}`}
        </p>
      </div>

      <div className="h-56 w-full">
        <MapContainer
          center={[location.lat, location.lon]}
          zoom={PREVIEW_ZOOM}
          className="h-full w-full z-0"
          scrollWheelZoom={false}
          dragging={true}
          zoomControl={true}
          attributionControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <PreviewMapUpdater location={location} />
          <CircleMarker
            center={[location.lat, location.lon]}
            pathOptions={{
              color: "#ffffff",
              weight: 3,
              fillColor: "#0f766e",
              fillOpacity: 0.95,
            }}
            radius={10}
          />
        </MapContainer>
      </div>

      <div className="border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        Przeciągnij mapę lub zmień zoom, aby zweryfikować położenie przed zapisaniem profilu.
      </div>
    </div>
  );
}

export const ProfileLocationPreviewMapClient = memo(ProfileLocationPreviewMapClientComponent);