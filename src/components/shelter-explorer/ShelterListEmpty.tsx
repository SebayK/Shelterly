import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ShelterListEmptyProps {
  hasFilters: boolean;
}

/**
 * Komponent wyświetlany gdy lista schronisk jest pusta
 * Różne komunikaty w zależności czy filtry są aktywne
 */
export function ShelterListEmpty({ hasFilters }: ShelterListEmptyProps) {
  return (
    <Card className="border-dashed" role="status">
      <CardHeader>
        <CardTitle className="text-center text-gray-500">{hasFilters ? "Brak wyników" : "Brak schronisk"}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-center text-gray-400 text-sm">
          {hasFilters
            ? "Spróbuj zmienić filtry, aby zobaczyć więcej schronisk"
            : "Nie znaleziono żadnych schronisk w bazie danych"}
        </p>
      </CardContent>
    </Card>
  );
}
