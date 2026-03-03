import { Button } from "@/components/ui/button";

interface LocationBannerProps {
  visible: boolean;
  onDismiss: () => void;
}

/**
 * Baner informacyjny o geolokalizacji
 * Wyświetlany gdy użytkownik odmówił dostępu lub geolokalizacja niedostępna
 */
export function LocationBanner({ visible, onDismiss }: LocationBannerProps) {
  if (!visible) return null;

  return (
    <div role="status" aria-live="polite" className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-blue-700">
            <strong>Wskazówka:</strong> Włącz lokalizację, aby zobaczyć schroniska posortowane według odległości od
            Ciebie.
          </p>
          <p className="text-xs text-blue-600 mt-1">Aktualnie wyświetlamy wszystkie schroniska w Polsce.</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          aria-label="Zamknij powiadomienie"
          className="ml-4 text-blue-700 hover:text-blue-900 hover:bg-blue-100"
        >
          ×
        </Button>
      </div>
    </div>
  );
}
