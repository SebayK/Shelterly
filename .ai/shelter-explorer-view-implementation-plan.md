# Plan implementacji widoku Shelter Explorer (Strona główna)

## 1. Przegląd

Widok Shelter Explorer to strona główna aplikacji Shelterly dostępna pod ścieżką `/`. Jego głównym celem jest umożliwienie darczyńcom szybkiego znalezienia najbliższego schroniska dla zwierząt i sprawdzenia jego potrzeb. Widok prezentuje interaktywną mapę Leaflet z klastrowaniem markerów zweryfikowanych schronisk oraz listę schronisk posortowaną wg odległości (jeśli użytkownik udostępnił geolokalizację) lub pilności potrzeb (przy braku geolokalizacji). Widok jest w pełni publiczny — nie wymaga autentykacji.

## 2. Routing widoku

- **Ścieżka:** `/`
- **Plik strony Astro:** `src/pages/index.astro`
- **Renderowanie:** Strona Astro z jedną wyspą React (`client:only="react"`) — komponent `ShelterExplorer` zarządzający całym widokiem interaktywnym.

## 3. Struktura komponentów

```
src/pages/index.astro
└── Layout
    └── ShelterExplorer (client:only="react")
        ├── LocationBanner
        ├── ShelterFilters
        ├── MapView
        │   └── ShelterMarker (×N)
        │       └── Popup (podstawowe dane schroniska)
        ├── ShelterList
        │   ├── ShelterCard (×N)
        │   ├── ShelterListSkeleton (stan ładowania)
        │   └── ShelterListEmpty (pusta lista)
        └── MobileViewToggle (FAB)
```

Pliki komponentów:

- `src/components/shelter-explorer/ShelterExplorer.tsx`
- `src/components/shelter-explorer/MapView.tsx`
- `src/components/shelter-explorer/ShelterMarker.tsx`
- `src/components/shelter-explorer/ShelterList.tsx`
- `src/components/shelter-explorer/ShelterCard.tsx`
- `src/components/shelter-explorer/ShelterFilters.tsx`
- `src/components/shelter-explorer/LocationBanner.tsx`
- `src/components/shelter-explorer/MobileViewToggle.tsx`
- `src/components/shelter-explorer/ShelterListSkeleton.tsx`
- `src/components/shelter-explorer/ShelterListEmpty.tsx`

Hooki:

- `src/components/hooks/useGeolocation.ts`
- `src/components/hooks/useShelters.ts`

## 4. Szczegóły komponentów

### ShelterExplorer

- **Opis:** Główny komponent-kontener zarządzający całym widokiem split-view. Orkiestruje pobieranie danych, zarządza stanem globalnym widoku (geolokalizacja, filtry, zaznaczenie schroniska, tryb mobilny) i przekazuje dane do komponentów dzieci. Renderowany jako wyspa React z dyrektywą `client:only="react"`.
- **Główne elementy:**
  - `<div>` z layoutem CSS Grid / Flexbox: na desktop mapa zajmuje 60% szerokości, lista 40%.
  - Warunkowo renderowany `<LocationBanner>`.
  - `<ShelterFilters>` nad sekcją listy.
  - `<MapView>` (lewa/górna strona).
  - `<ShelterList>` (prawa/dolna strona).
  - `<MobileViewToggle>` (widoczny tylko na mobile, pozycja fixed).
- **Obsługiwane interakcje:**
  - Inicjalizacja geolokalizacji przy montowaniu komponentu.
  - Zmiana filtrów (urgent_only, wyszukiwanie miasta) → re-fetch danych.
  - Zaznaczenie schroniska (z mapy lub listy) → synchronizacja podświetlenia.
  - Przełączanie widoku mobilnego (mapa/lista).
- **Obsługiwana walidacja:** Brak bezpośredniej walidacji — komponent deleguje walidację do hooka `useShelters`, który buduje poprawne query params.
- **Typy:** `ProfileListItemDTO`, `ProfileListResponseDTO`, `GeolocationState`, `MobileView`, `ShelterFiltersState`.
- **Propsy:** Brak (komponent najwyższego poziomu).

### MapView

- **Opis:** Komponent renderujący mapę Leaflet (za pomocą `react-leaflet`) z klastrowaniem markerów schronisk. Wyświetla pozycję użytkownika (jeśli dostępna) i pozwala na interakcję z markerami.
- **Główne elementy:**
  - `<MapContainer>` z `react-leaflet` z tilelayer OpenStreetMap.
  - `<MarkerClusterGroup>` z `react-leaflet-cluster` — grupowanie markerów.
  - Kolekcja `<ShelterMarker>` wewnątrz grupy klastrowej.
  - Opcjonalny marker lokalizacji użytkownika (niebieski punkt).
  - Element `<div>` z atrybutami `role="application"` i `aria-label="Mapa schronisk dla zwierząt"`.
- **Obsługiwane interakcje:**
  - Kliknięcie markera → wywołanie `onShelterSelect(id)`.
  - Automatyczne wycentrowanie mapy na lokalizacji użytkownika (jeśli jest).
  - Domyślny widok: centrum Polski (lat: 51.9194, lon: 19.1451) z zoomem obejmującym cały kraj (zoom ~6).
- **Obsługiwana walidacja:** Brak.
- **Typy:** `ProfileListItemDTO`, `Location`.
- **Propsy:**
  - `shelters: ProfileListItemDTO[]` — lista schronisk do wyświetlenia.
  - `userLocation: Location | null` — lokalizacja użytkownika.
  - `selectedShelterId: string | null` — ID aktualnie zaznaczonego schroniska.
  - `onShelterSelect: (id: string) => void` — callback wyboru schroniska.

### ShelterMarker

- **Opis:** Pojedynczy marker na mapie reprezentujący schronisko. Zawiera popup z podstawowymi danymi schroniska i linkiem do szczegółów. Marker pilnego schroniska powinien mieć wyróżniony kolor (np. czerwony vs. niebieski).
- **Główne elementy:**
  - `<Marker>` z `react-leaflet` z niestandardową ikoną (kolor zależny od `has_urgent_needs`).
  - `<Popup>` z `react-leaflet` zawierający:
    - Nazwa schroniska.
    - Miasto.
    - Liczba potrzeb / pilnych potrzeb.
    - Odległość (jeśli dostępna).
    - Link/przycisk „Zobacz szczegóły" prowadzący do `/shelters/{id}`.
- **Obsługiwane interakcje:**
  - Kliknięcie markera → otwiera popup, wywołuje `onSelect`.
- **Obsługiwana walidacja:** Brak.
- **Typy:** `ProfileListItemDTO`.
- **Propsy:**
  - `shelter: ProfileListItemDTO` — dane schroniska.
  - `isSelected: boolean` — czy marker jest podświetlony.
  - `onSelect: (id: string) => void` — callback kliknięcia.

### ShelterList

- **Opis:** Przewijalna lista kart schronisk. W stanie ładowania wyświetla skeletony, przy pustej liście — komunikat zachęcający do zmiany filtrów. Obsługuje paginację (infinite scroll lub przycisk „Załaduj więcej").
- **Główne elementy:**
  - `<div>` z `overflow-y-auto` jako kontener listy z `role="list"` i `aria-label="Lista schronisk"`.
  - Kolekcja `<ShelterCard>` z `role="listitem"`.
  - `<ShelterListSkeleton>` (w stanie loading).
  - `<ShelterListEmpty>` (gdy brak wyników).
  - Opcjonalny przycisk „Załaduj więcej" / detekcja scroll do dołu.
- **Obsługiwane interakcje:**
  - Kliknięcie karty → wywołanie `onShelterSelect(id)`.
  - Scroll do końca listy → wywołanie `onLoadMore()` (paginacja).
  - Automatyczny scroll do zaznaczonego schroniska (po kliknięciu markera na mapie).
- **Obsługiwana walidacja:** Brak.
- **Typy:** `ProfileListItemDTO[]`.
- **Propsy:**
  - `shelters: ProfileListItemDTO[]` — lista schronisk.
  - `loading: boolean` — stan ładowania.
  - `hasMore: boolean` — czy są kolejne strony.
  - `selectedShelterId: string | null` — ID zaznaczonego schroniska.
  - `onShelterSelect: (id: string) => void` — callback wyboru.
  - `onLoadMore: () => void` — callback ładowania kolejnej strony.

### ShelterCard

- **Opis:** Karta pojedynczego schroniska wyświetlana na liście. Prezentuje skrócone informacje: nazwa, miasto, odległość, liczbę potrzeb oraz flagę pilności. Podświetlana gdy zaznaczona.
- **Główne elementy:**
  - Komponent `<Card>` z Shadcn/ui jako baza.
  - `<CardHeader>`: nazwa schroniska, miasto.
  - `<CardContent>`:
    - Odległość (np. „5,2 km" — jeśli dostępna).
    - Liczba potrzeb (np. „12 potrzeb").
    - Liczba pilnych potrzeb (np. „3 pilne").
    - Badge/flaga pilności (gdy `has_urgent_needs === true`).
  - Link/przycisk prowadzący do strony szczegółowej (`/shelters/{id}`).
- **Obsługiwane interakcje:**
  - Kliknięcie karty → `onSelect(shelter.id)`.
  - Klawiatura: `Enter` / `Space` → to samo co kliknięcie.
- **Obsługiwana walidacja:** Brak.
- **Typy:** `ProfileListItemDTO`.
- **Propsy:**
  - `shelter: ProfileListItemDTO` — dane schroniska.
  - `isSelected: boolean` — czy karta jest podświetlona.
  - `onSelect: (id: string) => void` — callback kliknięcia.

### ShelterFilters

- **Opis:** Pasek filtrów nad listą schronisk. Zawiera toggle „Tylko pilne potrzeby" i opcjonalne pole wyszukiwania po mieście (filtrowanie po stronie klienta).
- **Główne elementy:**
  - `<div>` z atrybutem `role="search"`.
  - Toggle/switch „Tylko pilne potrzeby" (komponent Shadcn `Switch` lub `Toggle`) z `aria-label="Filtruj tylko pilne potrzeby"`.
  - Opcjonalne pole tekstowe `<Input>` z `aria-label="Szukaj po mieście"` i `placeholder="Szukaj miasta..."` (filtrowanie lokalne na kliencie).
- **Obsługiwane interakcje:**
  - Zmiana toggle → wywołanie `onUrgentOnlyChange(value)`.
  - Wpisanie tekstu → wywołanie `onCitySearchChange(value)` (debounce 300ms).
- **Obsługiwana walidacja:**
  - `urgentOnly` musi być wartością boolean.
  - `searchQuery` — opcjonalny string, przycinany (trim), filtrowanie case-insensitive.
- **Typy:** `ShelterFiltersState`.
- **Propsy:**
  - `urgentOnly: boolean` — aktualny stan filtra.
  - `citySearch: string` — aktualny tekst wyszukiwania.
  - `onUrgentOnlyChange: (value: boolean) => void`.
  - `onCitySearchChange: (value: string) => void`.

### LocationBanner

- **Opis:** Baner informacyjny wyświetlany gdy użytkownik odmówił udostępnienia geolokalizacji lub gdy geolokalizacja nie jest dostępna. Informuje o domyślnym widoku (cała Polska) i zachęca do włączenia lokalizacji.
- **Główne elementy:**
  - `<div>` z `role="status"` i `aria-live="polite"`.
  - Ikona informacyjna (Lucide `Info` lub `MapPin`).
  - Tekst informacyjny: „Nie udostępniono lokalizacji. Wyświetlamy schroniska z całej Polski. Włącz lokalizację, aby zobaczyć najbliższe schroniska."
  - Opcjonalny przycisk zamknięcia (×).
- **Obsługiwane interakcje:**
  - Kliknięcie przycisku zamknięcia → ukrycie banera.
- **Obsługiwana walidacja:** Brak.
- **Typy:** Brak dedykowanych.
- **Propsy:**
  - `visible: boolean` — czy baner jest widoczny.
  - `onDismiss: () => void` — callback zamknięcia.

### MobileViewToggle

- **Opis:** Floating Action Button (FAB) widoczny tylko na urządzeniach mobilnych (ukryty na desktop via Tailwind `md:hidden`). Pozwala przełączać między widokiem mapy a listy.
- **Główne elementy:**
  - `<Button>` (Shadcn) z `position: fixed`, `bottom`, `right`.
  - Ikona zmieniająca się w zależności od aktualnego widoku (Lucide `Map` / `List`).
  - `aria-label` aktualizowany dynamicznie: „Przełącz na widok listy" / „Przełącz na widok mapy".
- **Obsługiwane interakcje:**
  - Kliknięcie → `onToggle()`.
- **Obsługiwana walidacja:** Brak.
- **Typy:** `MobileView`.
- **Propsy:**
  - `currentView: MobileView` — aktualny widok.
  - `onToggle: () => void` — callback przełączenia.

### ShelterListSkeleton

- **Opis:** Komponent wyświetlający skeletony (placeholdery ładowania) w kształcie kart schronisk. Używany w stanie ładowania danych. Korzysta z komponentu `Skeleton` z Shadcn/ui.
- **Główne elementy:**
  - 3–5 elementów `<Card>` z `<Skeleton>` zamiast treści.
  - Każdy skeleton odwzorowuje układ `ShelterCard`.
- **Obsługiwane interakcje:** Brak.
- **Obsługiwana walidacja:** Brak.
- **Typy:** Brak.
- **Propsy:**
  - `count?: number` — liczba skeletonów (domyślnie 5).

### ShelterListEmpty

- **Opis:** Komunikat wyświetlany gdy lista schronisk jest pusta. Zachęca do zmiany filtrów lub wyłączenia trybu „Tylko pilne potrzeby".
- **Główne elementy:**
  - `<div>` wycentrowany z ikoną (Lucide `Search` lub `Building2`).
  - Nagłówek: „Nie znaleziono schronisk".
  - Tekst: „Spróbuj zmienić filtry lub wyłączyć tryb «Tylko pilne potrzeby»."
- **Obsługiwane interakcje:** Brak.
- **Obsługiwana walidacja:** Brak.
- **Typy:** Brak.
- **Propsy:**
  - `hasActiveFilters: boolean` — czy są aktywne filtry (wpływa na treść komunikatu).

## 5. Typy

### Istniejące typy (z `src/types.ts`)

```typescript
// Główny DTO elementu listy schronisk (odpowiedź z API)
interface ProfileListItemDTO {
  id: string;
  name: string;
  city: string;
  location: Location; // { lat: number; lon: number }
  distance_km?: number; // obecne tylko gdy podano geolokalizację
  has_urgent_needs: boolean;
  needs_count: number;
  urgent_needs_count: number;
}

// Wrapper odpowiedzi z API
interface ProfileListResponseDTO {
  data: ProfileListItemDTO[];
  pagination: Pagination; // { total: number; limit: number; offset: number }
}

// Parametry zapytania do API
interface ProfilesQueryParams {
  lat?: number;
  lon?: number;
  urgent_only?: boolean;
  limit?: number;
  offset?: number;
}

// Typ lokalizacji
interface Location {
  lat: number;
  lon: number;
}

// Paginacja
interface Pagination {
  total: number;
  limit: number;
  offset: number;
}

// Odpowiedź błędu z API
interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
  };
}
```

### Nowe typy ViewModel (do utworzenia w `src/components/shelter-explorer/types.ts`)

```typescript
/**
 * Stan geolokalizacji przeglądarki
 */
interface GeolocationState {
  status: "idle" | "requesting" | "granted" | "denied" | "unavailable";
  coordinates: Location | null;
  error: string | null;
}

/**
 * Stan filtrów widoku
 */
interface ShelterFiltersState {
  urgentOnly: boolean;
  citySearch: string;
}

/**
 * Tryb widoku mobilnego
 */
type MobileView = "map" | "list";

/**
 * Parametry wewnętrzne hooka useShelters
 */
interface UseSheltersParams {
  coordinates: Location | null;
  urgentOnly: boolean;
}

/**
 * Zwracany obiekt z hooka useShelters
 */
interface UseSheltersReturn {
  shelters: ProfileListItemDTO[];
  loading: boolean;
  error: string | null;
  pagination: Pagination | null;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
}

/**
 * Zwracany obiekt z hooka useGeolocation
 */
interface UseGeolocationReturn {
  status: GeolocationState["status"];
  coordinates: Location | null;
  error: string | null;
}
```

## 6. Zarządzanie stanem

### Custom Hook: `useGeolocation`

**Plik:** `src/components/hooks/useGeolocation.ts`

**Cel:** Zarządza żądaniem i stanem geolokalizacji przeglądarki. Przy montowaniu sprawdza dostępność API Geolocation i prosi użytkownika o udostępnienie lokalizacji. Dane lokalizacji nie są nigdzie przechowywane ani wysyłane — przetwarzane wyłącznie po stronie klienta.

**Stan wewnętrzny:**

- `status`: `'idle'` → `'requesting'` → `'granted'` | `'denied'` | `'unavailable'`
- `coordinates`: `Location | null`
- `error`: `string | null`

**Zachowanie:**

- Przy montowaniu sprawdza `navigator.geolocation`.
- Jeśli API niedostępne → `status: 'unavailable'`.
- Wywołuje `navigator.geolocation.getCurrentPosition()`.
- Sukces → `status: 'granted'`, ustawia `coordinates`.
- Odmowa/błąd → `status: 'denied'`, `coordinates: null`.

### Custom Hook: `useShelters`

**Plik:** `src/components/hooks/useShelters.ts`

**Cel:** Zarządza pobieraniem listy schronisk z API, paginacją i re-fetchowaniem przy zmianie filtrów.

**Parametry wejściowe:**

- `coordinates: Location | null` — lokalizacja użytkownika (przekazywana do API jako `lat`, `lon`).
- `urgentOnly: boolean` — filtr pilnych potrzeb.

**Stan wewnętrzny:**

- `shelters: ProfileListItemDTO[]` — skumulowana lista (dla infinite scroll).
- `loading: boolean` — czy trwa fetch.
- `error: string | null` — komunikat błędu.
- `pagination: Pagination | null` — metadane paginacji z ostatniej odpowiedzi.

**Zachowanie:**

- Wykonuje `fetch('/api/profiles?...')` z odpowiednimi query params.
- Przy zmianie `coordinates` lub `urgentOnly` → resetuje listę i pobiera od nowa.
- `loadMore()` → pobiera następną stronę (offset + limit) i dokłada do istniejącej listy.
- `refetch()` → resetuje i pobiera od nowa.

### Stan lokalny w `ShelterExplorer`

- `selectedShelterId: string | null` — ID aktualnie zaznaczonego schroniska (synchronizacja mapa ↔ lista).
- `mobileView: MobileView` — aktualny tryb na mobile (`'map'` | `'list'`), domyślnie `'map'`.
- `filters: ShelterFiltersState` — stan filtrów (`urgentOnly`, `citySearch`).
- `bannerDismissed: boolean` — czy użytkownik zamknął LocationBanner.

**Filtrowanie po mieście (client-side):**

- Filtr `citySearch` NIE jest wysyłany do API — filtrowanie lokalne na pobranej liście schronisk.
- `useMemo` do przefiltrowania `shelters` po `city.toLowerCase().includes(citySearch.toLowerCase())`.

## 7. Integracja API

### Endpoint: `GET /api/profiles`

**Typ zapytania:** `ProfilesQueryParams`

**Typ odpowiedzi:** `ProfileListResponseDTO`

**Budowanie URL w hooku `useShelters`:**

```typescript
const buildUrl = (params: UseSheltersParams, limit: number, offset: number): string => {
  const url = new URL("/api/profiles", window.location.origin);
  if (params.coordinates) {
    url.searchParams.set("lat", params.coordinates.lat.toString());
    url.searchParams.set("lon", params.coordinates.lon.toString());
  }
  if (params.urgentOnly) {
    url.searchParams.set("urgent_only", "true");
  }
  url.searchParams.set("limit", limit.toString());
  url.searchParams.set("offset", offset.toString());
  return url.toString();
};
```

**Logika fetcha:**

1. Wywołanie `fetch(url)`.
2. Sprawdzenie `response.ok`.
3. Parsowanie JSON jako `ProfileListResponseDTO`.
4. Przy błędzie: parsowanie `ErrorResponse` i wyciągnięcie czytelnego komunikatu.

**Warunki wstępne dla fetcha:**

- Hook czeka na rozstrzygnięcie geolokalizacji (status !== `'idle'` && status !== `'requesting'`) przed pierwszym fetchem.
- Zapewnia to, że API otrzymuje współrzędne jeśli są dostępne, lub jest świadomie wywoływane bez nich.

**Domyślna paginacja:**

- `limit`: 50 (domyślna wartość API).
- `offset`: 0 → inkrementowany o `limit` przy każdym `loadMore()`.

## 8. Interakcje użytkownika

| #   | Interakcja                                  | Oczekiwany wynik                                                                                                              |
| --- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | Wejście na stronę główną                    | System prosi o geolokalizację. Wyświetlane skeletony. Po odpowiedzi — fetch schronisk i renderowanie mapy + listy.            |
| 2   | Udostępnienie geolokalizacji                | Mapa centruje się na użytkowniku. Lista sortowana wg odległości. Marker lokalizacji użytkownika na mapie.                     |
| 3   | Odmowa geolokalizacji                       | Wyświetlenie `LocationBanner`. Mapa pokazuje całą Polskę. Lista sortowana wg pilności.                                        |
| 4   | Toggle „Tylko pilne potrzeby"               | Re-fetch z `urgent_only=true/false`. Reset listy i paginacji. Mapa aktualizuje markery.                                       |
| 5   | Wpisanie tekstu w pole wyszukiwania miasta  | Filtrowanie lokalne (client-side) po nazwie miasta. Mapa i lista aktualizują się natychmiast.                                 |
| 6   | Kliknięcie markera na mapie                 | Otwarcie popup z danymi schroniska. Podświetlenie odpowiedniej karty na liście. Automatyczny scroll listy do wybranej karty.  |
| 7   | Kliknięcie karty schroniska na liście       | Podświetlenie markera na mapie. Mapa centruje się na wybranym schronisku. Na mobile: automatyczne przełączenie na widok mapy. |
| 8   | Kliknięcie „Zobacz szczegóły" (popup/karta) | Nawigacja do strony szczegółowej schroniska: `/shelters/{id}`.                                                                |
| 9   | Kliknięcie FAB na mobile                    | Przełączenie między widokiem mapy a listy. Zmiana ikony i `aria-label` FAB.                                                   |
| 10  | Scroll do końca listy                       | Automatyczne załadowanie kolejnej strony schronisk (`loadMore()`), jeśli dostępne.                                            |
| 11  | Zamknięcie `LocationBanner`                 | Ukrycie banera (nie zmienia zachowania aplikacji).                                                                            |

## 9. Warunki i walidacja

| #   | Warunek                                                                          | Komponenty                          | Wpływ na stan UI                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Geolokalizacja niedostępna lub odrzucona                                         | `ShelterExplorer`, `LocationBanner` | Wyświetlenie banera informacyjnego. Fetch schronisk bez parametrów `lat`/`lon`. Mapa z domyślnym widokiem (cała Polska, zoom ~6). Lista sortowana wg pilności (brak `distance_km` w danych). |
| 2   | Brak schronisk w odpowiedzi API (`data.length === 0`)                            | `ShelterList`, `ShelterListEmpty`   | Wyświetlenie komponentu `ShelterListEmpty` z komunikatem zachęcającym do zmiany filtrów. Mapa pusta (brak markerów).                                                                         |
| 3   | Filtr `urgentOnly` aktywny i brak wyników                                        | `ShelterList`, `ShelterListEmpty`   | Komunikat sugerujący wyłączenie filtra „Tylko pilne potrzeby".                                                                                                                               |
| 4   | Paginacja: `offset + limit >= total`                                             | `ShelterList`                       | Ukrycie elementu „Załaduj więcej". `hasMore` = false.                                                                                                                                        |
| 5   | Współrzędne geolokalizacji — oba parametry (`lat` i `lon`) wymagane jednocześnie | `useShelters`                       | Hook wysyła `lat` i `lon` tylko gdy oba są dostępne (zapewnione przez `useGeolocation` — `coordinates` to obiekt `{lat, lon}` lub `null`).                                                   |
| 6   | Filtr miasta (client-side) — case-insensitive, trimmed                           | `ShelterFilters`, `ShelterExplorer` | Filtrowanie listy `shelters` po `city`. Markery na mapie również filtrowane lokalnie. Pusty wynik → `ShelterListEmpty`.                                                                      |

## 10. Obsługa błędów

| #   | Scenariusz błędu                                      | Obsługa                                                                                                                                                 |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Błąd API 400 (nieprawidłowe parametry)**            | Wyświetlenie komunikatu o błędzie walidacji w obszarze listy. Log błędu do konsoli. Przycisk „Spróbuj ponownie" wywołujący `refetch()`.                 |
| 2   | **Błąd API 500 (błąd serwera)**                       | Wyświetlenie ogólnego komunikatu o błędzie serwera: „Wystąpił błąd podczas ładowania schronisk. Spróbuj ponownie później." Przycisk „Spróbuj ponownie". |
| 3   | **Błąd sieci (brak połączenia)**                      | Wyświetlenie komunikatu: „Brak połączenia z internetem. Sprawdź połączenie i spróbuj ponownie." Przycisk „Spróbuj ponownie".                            |
| 4   | **Geolokalizacja odrzucona przez użytkownika**        | `LocationBanner` z informacją. Aplikacja działa normalnie bez geolokalizacji.                                                                           |
| 5   | **Geolocation API niedostępne (stary browser, HTTP)** | `status: 'unavailable'`. Zachowanie identyczne jak odmowa — `LocationBanner` + brak współrzędnych.                                                      |
| 6   | **Timeout geolokalizacji**                            | Traktowany jak odmowa — `status: 'denied'`. Opcja: ustawienie `timeout` w opcjach `getCurrentPosition` (np. 10s).                                       |
| 7   | **Błąd ładowania Leaflet (brakujące CSS/JS)**         | Użycie `client:only="react"` zapobiega SSR problemom. Dodatkowe zabezpieczenie: `ErrorBoundary` wokół `MapView` z fallbackiem do samej listy.           |
| 8   | **Błąd paginacji (loadMore z nieaktualnymi danymi)**  | Guard: sprawdzenie `hasMore` przed wywołaniem. Ignorowanie duplikatów (sprawdzanie po `id`).                                                            |
| 9   | **Pusta odpowiedź z prawidłowymi parametrami**        | Wyświetlenie `ShelterListEmpty` z odpowiednim komunikatem. Brak markerów na mapie.                                                                      |

## 11. Kroki implementacji

1. **Instalacja zależności:**
   - Dodać pakiety: `leaflet`, `react-leaflet`, `@types/leaflet`, `react-leaflet-cluster`.
   - Ewentualnie: komponent `Skeleton` z Shadcn/ui (`npx shadcn@latest add skeleton`), `Switch` (`npx shadcn@latest add switch`), `Sheet` (`npx shadcn@latest add sheet`) jeśli nie są zainstalowane.

2. **Utworzenie typów ViewModel:**
   - Utworzyć plik `src/components/shelter-explorer/types.ts` z typami: `GeolocationState`, `ShelterFiltersState`, `MobileView`, `UseSheltersParams`, `UseSheltersReturn`, `UseGeolocationReturn`.

3. **Implementacja hooka `useGeolocation`:**
   - Utworzyć `src/components/hooks/useGeolocation.ts`.
   - Zaimplementować logikę żądania i obsługi geolokalizacji przeglądarki.
   - Obsłużyć stany: idle → requesting → granted/denied/unavailable.

4. **Implementacja hooka `useShelters`:**
   - Utworzyć `src/components/hooks/useShelters.ts`.
   - Zaimplementować fetch do `GET /api/profiles` z query params.
   - Obsłużyć paginację (kumulowanie wyników), re-fetch przy zmianie filtrów, obsługę błędów.
   - Hook powinien czekać na rozstrzygnięcie geolokalizacji (status nie `idle`/`requesting`) przed pierwszym fetchem.

5. **Implementacja komponentów prezentacyjnych (bottom-up):**
   - `ShelterListSkeleton` — skeletony kart.
   - `ShelterListEmpty` — komunikat pustej listy.
   - `LocationBanner` — baner geolokalizacji.
   - `MobileViewToggle` — FAB.
   - `ShelterCard` — karta schroniska (używa Shadcn `Card`).
   - `ShelterFilters` — filtry (toggle + wyszukiwanie).

6. **Implementacja `ShelterMarker`:**
   - Marker z niestandardową ikoną Leaflet (kolor wg pilności).
   - Popup z danymi schroniska.

7. **Implementacja `MapView`:**
   - `MapContainer` z `TileLayer` (OpenStreetMap).
   - `MarkerClusterGroup` z kolekcją `ShelterMarker`.
   - Logika centrowania mapy (na użytkowniku lub domyślna Polska).
   - Atrybuty dostępności (`role="application"`, `aria-label`).
   - Import CSS Leaflet (np. w `global.css` lub dynamicznie).

8. **Implementacja `ShelterList`:**
   - Kontener z przewijaniem i automatycznym scrollem do wybranego elementu.
   - Renderowanie warunkowe: loading → skeletony, empty → empty state, dane → karty.
   - Obsługa paginacji (przycisk „Załaduj więcej" lub Intersection Observer).

9. **Implementacja `ShelterExplorer`:**
   - Integracja wszystkich komponentów i hooków.
   - Layout split-view (CSS Grid: `grid-cols-[3fr_2fr]` na desktop).
   - Responsywność: na mobile (`md:` breakpoint) — jeden widok na raz, kontrolowany przez `MobileView`.
   - Synchronizacja zaznaczenia schroniska między mapą a listą.
   - Filtrowanie lokalne po mieście (`useMemo`).
   - `React.ErrorBoundary` wokół `MapView`.

10. **Aktualizacja strony Astro (`src/pages/index.astro`):**
    - Zastąpić zawartość komponentem `<ShelterExplorer client:only="react" />`.
    - Dodać odpowiedni `title` i meta tagi.

11. **Dodanie CSS Leaflet:**
    - Zaimportować style Leaflet (`leaflet/dist/leaflet.css`) i MarkerCluster w `global.css` lub w samym komponencie `MapView`.

12. **Testy i dostępność:**
    - Zweryfikować nawigację klawiaturową (lista jako alternatywa dla mapy).
    - Sprawdzić atrybuty ARIA (role, aria-label, aria-live).
    - Przetestować scenariusze: z geolokalizacją, bez, z filtrami, pusty stan, błędy API.
    - Przetestować responsywność: desktop (split-view), mobile (toggle), tablet.
