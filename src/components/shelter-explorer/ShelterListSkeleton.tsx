import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Komponent szkieletu dla pojedynczej karty schroniska
 * Wyświetlany podczas ładowania danych
 */
function ShelterCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader>
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Komponent szkieletu dla listy schronisk
 * Wyświetla 3 karty-szkielety podczas ładowania
 */
export function ShelterListSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Ładowanie schronisk">
      <ShelterCardSkeleton />
      <ShelterCardSkeleton />
      <ShelterCardSkeleton />
      <span className="sr-only">Ładowanie schronisk...</span>
    </div>
  );
}
