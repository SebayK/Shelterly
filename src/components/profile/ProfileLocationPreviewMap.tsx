import { lazy, memo, Suspense, useEffect, useState } from "react";

import type { Location } from "@/types";

interface ProfileLocationPreviewMapProps {
  location: Location;
  formattedAddress?: string;
}

const LazyPreviewMap = lazy(() =>
  import("./ProfileLocationPreviewMapClient").then((module) => ({
    default: module.ProfileLocationPreviewMapClient,
  }))
);

function ProfileLocationPreviewMapSkeleton({ location, formattedAddress }: ProfileLocationPreviewMapProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b bg-muted/40 px-4 py-3">
        <p className="text-sm font-medium">Podgląd lokalizacji</p>
        <p className="text-xs text-muted-foreground">
          {formattedAddress ?? `Współrzędne: ${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}`}
        </p>
      </div>

      <div className="flex h-56 w-full items-center justify-center bg-muted/20 text-sm text-muted-foreground">
        Ładowanie mapy…
      </div>

      <div className="border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        Przeciągnij mapę lub zmień zoom, aby zweryfikować położenie przed zapisaniem profilu.
      </div>
    </div>
  );
}

function ProfileLocationPreviewMapComponent({ location, formattedAddress }: ProfileLocationPreviewMapProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <ProfileLocationPreviewMapSkeleton location={location} formattedAddress={formattedAddress} />;
  }

  return (
    <Suspense fallback={<ProfileLocationPreviewMapSkeleton location={location} formattedAddress={formattedAddress} />}>
      <LazyPreviewMap location={location} formattedAddress={formattedAddress} />
    </Suspense>
  );
}

export const ProfileLocationPreviewMap = memo(ProfileLocationPreviewMapComponent);