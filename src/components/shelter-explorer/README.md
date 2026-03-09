# Shelter Explorer - Dokumentacja komponentów

## Przegląd

Widok Shelter Explorer to interaktywny widok głównej strony aplikacji Shelterly, który łączy mapę z listą schronisk dla zwierząt. Użytkownicy mogą przeglądać schroniska, filtrować po pilnych potrzebach i wyszukiwać po mieście.

## Struktura komponentów

### Główny komponent
- **ShelterExplorer.tsx** - Orkiestrator całego widoku, zarządza stanem globalnym

### Komponenty mapy
- **MapView.tsx** - Mapa Leaflet z klasterowaniem markerów (zoptymalizowana z React.memo)
- **ShelterMarker.tsx** - Marker pojedynczego schroniska (memoizowany)

### Komponenty listy
- **ShelterList.tsx** - Lista schronisk z paginacją i auto-scroll
- **ShelterCard.tsx** - Karta schroniska (memoizowana)
- **ShelterFilters.tsx** - Filtry z debounce 300ms (memoizowane)

### Komponenty pomocnicze
- **LocationBanner.tsx** - Powiadomienie o geolokalizacji
- **MobileViewToggle.tsx** - FAB dla przełączania widoku mobile
- **ShelterListSkeleton.tsx** - Szkielet ładowania
- **ShelterListEmpty.tsx** - Pusty stan listy

### Custom Hooks
- **useGeolocation.ts** - Zarządzanie geolokalizacją użytkownika
- **useShelters.ts** - Pobieranie i paginacja schronisk z API

## Funkcje

### Geolokalizacja
- Automatyczne pobieranie lokalizacji użytkownika przy montowaniu
- Sortowanie schronisk według odległości (jeśli lokalizacja dostępna)
- Obsługa błędów i odmowy dostępu
- Banner informacyjny dla użytkowników bez geolokalizacji

### Filtrowanie i wyszukiwanie
- Toggle "Tylko pilne potrzeby" - filtrowanie po stronie API
- Wyszukiwanie po mieście - filtrowanie lokalne z debounce 300ms
- Resetowanie zaznaczenia przy zmianie filtrów

### Interakcja mapa-lista
- Kliknięcie markera podświetla schronisko na liście
- Automatyczny scroll do zaznaczonego elementu
- Synchronizacja zaznaczenia między mapą a listą

### Responsywność
- **Desktop (≥768px)**: Split-view - mapa 60%, lista 40%
- **Mobile (<768px)**: Toggle-view z FAB w prawym dolnym rogu

### Paginacja
- Lazy loading - "Załaduj więcej" na dole listy
- 20 schronisk na stronę
- Obsługa błędów ładowania

## Optymalizacje wydajności

### React.memo
Zoptymalizowane komponenty:
- `MapView` - zapobiega ponownemu renderowaniu mapy
- `MapUpdater` - helper dla aktualizacji mapy
- `ShelterMarker` - pojedynczy marker
- `ShelterCard` - karta schroniska
- `ShelterFilters` - pasek filtrów

### useCallback
Wszystkie handlery w `ShelterExplorer` są memoizowane:
```tsx
const handleShelterSelect = useCallback((id: string) => { ... }, []);
const handleUrgentOnlyChange = useCallback((value: boolean) => { ... }, []);
const handleCitySearchChange = useCallback((value: string) => { ... }, []);
```

### useMemo
Filtrowanie lokalne po mieście:
```tsx
const filteredShelters = useMemo(() => { ... }, [allShelters, citySearch]);
```

### Debounce
Wyszukiwanie po mieście używa debounce 300ms z `useEffect` i `useRef`.

## Dostępność (ARIA)

### Role i atrybuty
- `role="application"` - mapa
- `role="list"` / `role="listitem"` - lista schronisk
- `role="search"` - pasek filtrów
- `role="button"` - interaktywne karty
- `role="switch"` - toggle filtra
- `role="status"` - loadery i powiadomienia
- `role="alert"` - błędy

### Labels
Wszystkie interaktywne elementy mają odpowiednie `aria-label`:
- Przyciski
- Pola formularzy
- Markery na mapie
- Loadery

### Nawigacja klawiaturowa
- Karty schronisk: `Tab`, `Enter`, `Space`
- Filtry: normalna nawigacja po polach
- Toggle: `Space`, `Enter`

### Screen readers
- `sr-only` dla opisu mapy
- Live regions dla dynamicznych zmian (`aria-live="polite"`)
- Opisowe komunikaty dla stanów ładowania

## Testowanie

### Runtime endpoint
W trybie dev i production explorer korzysta z tego samego endpointu runtime:
```
/api/profiles
```

Lokalny development wymaga seedowanych danych Supabase zamiast automatycznego fallbacku do mocków.

### Funkcje do przetestowania
- ✓ Wyświetlanie mapy z markerami
- ✓ Klasterowanie markerów przy przybliżeniu
- ✓ Kliknięcie markera → podświetlenie karty
- ✓ Kliknięcie karty → zaznaczenie (bez akcji)
- ✓ Filtr "Tylko pilne" → przefiltrowanie listy
- ✓ Wyszukiwanie po mieście → wyniki na liście
- ✓ Paginacja "Załaduj więcej"
- ✓ Responsywność (zmiana szerokości okna)
- ✓ FAB na mobile

## API Integration

### Endpoint produkcyjny
```
GET /api/profiles
```

Query params:
- `lat` - szerokość geograficzna użytkownika
- `lon` - długość geograficzna użytkownika
- `urgent_only` - boolean, tylko pilne potrzeby
- `limit` - liczba wyników na stronę (domyślnie 20)
- `offset` - offset dla paginacji

### Response format
```typescript
{
  data: ProfileListItemDTO[],
  pagination: {
    total: number,
    limit: number,
    offset: number
  }
}
```

## Znane ograniczenia

1. **Link "Zobacz szczegóły"** - prowadzi do `/shelter/{id}` (widok szczegółów schroniska)
2. **Geolokalizacja** - wymaga HTTPS w produkcji
3. **Leaflet CSS** - obecnie ładowany z CDN (można przenieść do buildu)

## Przyszłe usprawnienia

- [ ] Lazy loading mapy (React.lazy + Suspense)
- [ ] Infinite scroll zamiast przycisku "Załaduj więcej"
- [ ] Zapisywanie preferencji filtrów w localStorage
- [ ] Animacje przejść między markerami
- [ ] Eksport do PDF/CSV
- [ ] Strona szczegółów schroniska

## License

Projekt Shelterly - 2026
