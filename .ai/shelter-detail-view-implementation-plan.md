# Plan implementacji widoku Szczegółów Schroniska

## 1. Przegląd

Widok szczegółów schroniska prezentuje pełne informacje o wybranej placówce oraz jej aktualne potrzeby. Głównym celem jest umożliwienie darczyńcom zapoznania się z danymi kontaktowymi schroniska, przejrzenia listy potrzeb z wizualnymi wskaźnikami postępu oraz podjęcia konkretnej akcji pomocy poprzez zakup produktów online. Widok jest renderowany po stronie serwera (SSR) dla optymalnej wydajności i SEO, z elementami interaktywnymi zaimplementowanymi jako React Islands.

## 2. Routing widoku

- **Ścieżka**: `/shelter/[id]`
- **Plik**: `src/pages/shelter/[id].astro`
- **Parametr dynamiczny**: `id` - UUID identyfikujący schronisko
- **Typ**: Publiczny widok (bez wymaganej autentykacji)
- **Dostępność**: Zwraca 404 gdy schronisko nie istnieje lub nie ma statusu `verified`

## 3. Struktura komponentów

```
shelter/[id].astro (Astro SSR Page)
├── <head> (Meta tags, OG tags, Title)
├── <Breadcrumb> (Astro static component)
├── <ShelterHeader> (Astro static component)
│   ├── Nazwa schroniska (h1)
│   ├── Adres i miasto
│   ├── Numer telefonu (clickable tel: link)
│   └── Strona WWW (external link z target="_blank")
├── <NeedsSummarySection> (Astro static component)
│   ├── Statystyka: Wszystkie potrzeby
│   ├── Statystyka: Pilne potrzeby
│   └── Statystyka: Zrealizowane potrzeby
└── <ShelterDetailView> (React island, client:load)
    ├── <NeedsFilter> (React)
    │   ├── Select: Kategoria (all | food | textiles | cleaning | medical | toys | other)
    │   └── Select: Pilność (all | low | medium | high | critical)
    └── <div> Needs List Container
        ├── <NeedCard> (React) × N
        │   ├── <CategoryIcon> (Lucide React)
        │   ├── <div> Header
        │   │   ├── Tytuł potrzeby (h3)
        │   │   └── <UrgencyBadge>
        │   ├── <p> Opis potrzeby
        │   ├── <ProgressBar>
        │   │   ├── Progress text (np. "5/50 kg")
        │   │   └── Visual bar (div z width based on percentage)
        │   └── <a> "Kup online" button (if shopping_url exists)
        └── <NeedsEmptyState> (React, shown when no needs match filters)
```

## 4. Szczegóły komponentów

### 4.1. `shelter/[id].astro` (Astro Page)

**Opis komponentu**:
Główny plik strony odpowiedzialny za server-side rendering. Pobiera dane schroniska i jego potrzeb z API w sekcji frontmatter, waliduje dostępność danych, generuje meta tagi oraz renderuje strukturę strony ze statycznymi komponentami Astro i interaktywną wyspą React.

**Główne elementy**:

- Frontmatter (TypeScript):
  - Walidacja parametru `id` z URL
  - Wywołanie `ProfileService.getProfileById(id)`
  - Wywołanie `NeedsService.getNeeds({ shelter_id: id })`
  - Obsługa błędów (404 gdy brak danych lub schronisko niezweryfikowane)
- `<Layout>` wrapper z metadanymi strony
- `<Breadcrumb>` komponent statyczny
- `<ShelterHeader>` komponent statyczny
- `<NeedsSummarySection>` komponent statyczny
- `<ShelterDetailView>` React island z dyrektywą `client:load`

**Obsługiwane interakcje**:

- Brak (komponent statyczny, interakcje w React islands)

**Obsługiwana walidacja**:

- Walidacja formatu UUID parametru `id` (pattern: `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
- Sprawdzenie czy schronisko istnieje (response !== null)
- Sprawdzenie czy schronisko jest zweryfikowane (implied by ProfileService logic)
- Przekierowanie do 404 jeśli którykolwiek warunek nie jest spełniony

**Typy**:

- `ProfileDetailDTO` (from types.ts)
- `NeedListResponseDTO` (from types.ts)
- `NeedListItemDTO[]` (from types.ts)

**Propsy**:

- Brak (strona top-level)

---

### 4.2. `<Breadcrumb>` (Astro Component)

**Opis komponentu**:
Statyczny komponent nawigacyjny wyświetlający ścieżkę: Strona główna → [Nazwa schroniska]. Poprawia UX i pomaga w nawigacji oraz wspiera SEO poprzez strukturalną hierarchię.

**Główne elementy**:

- `<nav aria-label="Breadcrumb">`
- `<ol>` lista z separatorami (np. "/" lub ">")
- `<li>` Link do strony głównej: `<a href="/">Strona główna</a>`
- `<li>` Aktualny element (aria-current="page"): `<span>{shelterName}</span>`

**Obsługiwane interakcje**:

- Kliknięcie na "Strona główna" → nawigacja do `/`

**Obsługiwana walidacja**:

- Brak

**Typy**:

```typescript
interface BreadcrumbProps {
  shelterName: string;
}
```

**Propsy**:

- `shelterName: string` - nazwa schroniska do wyświetlenia

---

### 4.3. `<ShelterHeader>` (Astro Component)

**Opis komponentu**:
Statyczny nagłówek prezentujący podstawowe informacje o schronisku: nazwę, adres, miasto oraz dane kontaktowe (telefon i strona www). Elementy kontaktowe są interaktywne (clickable links).

**Główne elementy**:

- `<header>` sekcja
- `<h1>` Nazwa schroniska
- `<div>` Sekcja adresowa
  - `<p>` Adres
  - `<p>` Miasto
- `<div>` Sekcja kontaktowa
  - `<a href="tel:{phone_number}">` Numer telefonu (if exists)
  - `<a href="{website_url}" target="_blank" rel="noopener noreferrer">` Strona WWW (if exists)

**Obsługiwane interakcje**:

- Kliknięcie na numer telefonu → otwarcie dialera
- Kliknięcie na WWW → otwarcie strony w nowej karcie

**Obsługiwana walidacja**:

- Sprawdzenie czy `phone_number` nie jest null przed wyświetleniem
- Sprawdzenie czy `website_url` nie jest null przed wyświetleniem

**Typy**:

```typescript
interface ShelterHeaderProps {
  name: string;
  address: string;
  city: string;
  phoneNumber: string | null;
  websiteUrl: string | null;
}
```

**Propsy**:

- `name: string` - nazwa schroniska
- `address: string` - adres schroniska
- `city: string` - miasto
- `phoneNumber: string | null` - numer telefonu
- `websiteUrl: string | null` - adres strony www

---

### 4.4. `<NeedsSummarySection>` (Astro Component)

**Opis komponentu**:
Statyczna sekcja prezentująca podsumowanie potrzeb schroniska w formie trzech kart statystycznych: łączna liczba potrzeb, liczba pilnych potrzeb oraz liczba zrealizowanych potrzeb.

**Główne elementy**:

- `<section>` container
- `<h2>` Tytuł sekcji (np. "Podsumowanie potrzeb")
- `<div>` Grid z trzema kartami statystyk
  - Karta 1: Ikona + Label "Wszystkie potrzeby" + Liczba `{total}`
  - Karta 2: Ikona + Label "Pilne potrzeby" + Liczba `{urgent}`
  - Karta 3: Ikona + Label "Zrealizowane" + Liczba `{fulfilled}`

**Obsługiwane interakcje**:

- Brak

**Obsługiwana walidacja**:

- Brak

**Typy**:

```typescript
interface NeedsSummarySectionProps {
  summary: NeedsSummary; // from types.ts
}
```

**Propsy**:

- `summary: NeedsSummary` - obiekt zawierający total, urgent, fulfilled

---

### 4.5. `<ShelterDetailView>` (React Component)

**Opis komponentu**:
Główny interaktywny kontener React (wyspa) zarządzający listą potrzeb i ich filtrowaniem. Komponent utrzymuje stan filtrów, przetwarza listę potrzeb zgodnie z wybranymi filtrami i renderuje komponenty potomne.

**Główne elementy**:

- `<section>` główny kontener
- `<NeedsFilter>` komponent filtrowania
- `<div>` Grid kontener z listą kart potrzeb
- `<NeedCard>` × N - mapowanie przefiltrowanej listy
- `<NeedsEmptyState>` - wyświetlany gdy brak wyników

**Obsługiwane interakcje**:

- Zmiana filtrów → aktualizacja stanu → przeliczenie przefiltrowanej listy

**Obsługiwana walidacja**:

- Walidacja wartości filtrów (muszą być valid enum values lub 'all')

**Typy**:

```typescript
import type { NeedListItemDTO, NeedCategory, UrgencyLevel } from "../types";

interface ShelterDetailViewProps {
  needs: NeedListItemDTO[];
}

interface FilterState {
  category: NeedCategory | "all";
  urgency: UrgencyLevel | "all";
}
```

**Propsy**:

- `needs: NeedListItemDTO[]` - pełna lista potrzeb schroniska

---

### 4.6. `<NeedsFilter>` (React Component)

**Opis komponentu**:
Komponent filtrowania pozwalający na wybór kategorii potrzeb oraz poziomu pilności. Używa komponentów Shadcn/ui Select do przyjaznej interakcji.

**Główne elementy**:

- `<div>` kontener z dwoma select fields
- `<Select>` (Shadcn/ui) dla kategorii
  - Options: "Wszystkie", "Karma", "Tekstylia", "Środki czystości", "Medyczne", "Zabawki", "Inne"
- `<Select>` (Shadcn/ui) dla pilności
  - Options: "Wszystkie", "Niska", "Średnia", "Wysoka", "Krytyczna"

**Obsługiwane interakcje**:

- onChange category select → wywołanie `onCategoryChange(value)`
- onChange urgency select → wywołanie `onUrgencyChange(value)`

**Obsługiwana walidacja**:

- Wybrana wartość musi być valid enum value lub 'all'

**Typy**:

```typescript
import type { NeedCategory, UrgencyLevel } from "../types";

interface NeedsFilterProps {
  onCategoryChange: (category: NeedCategory | "all") => void;
  onUrgencyChange: (urgency: UrgencyLevel | "all") => void;
  currentCategory: NeedCategory | "all";
  currentUrgency: UrgencyLevel | "all";
}
```

**Propsy**:

- `onCategoryChange: (category: NeedCategory | 'all') => void` - callback przy zmianie kategorii
- `onUrgencyChange: (urgency: UrgencyLevel | 'all') => void` - callback przy zmianie pilności
- `currentCategory: NeedCategory | 'all'` - aktualna wartość filtra kategorii
- `currentUrgency: UrgencyLevel | 'all'` - aktualna wartość filtra pilności

---

### 4.7. `<NeedCard>` (React Component)

**Opis komponentu**:
Karta pojedynczej potrzeby prezentująca wszystkie kluczowe informacje: kategorię (ikona), tytuł, pilność (badge), opis, pasek postępu oraz przycisk "Kup online" (jeśli dostępny link).

**Główne elementy**:

- `<article>` semantyczny kontener
- `<div>` Header sekcja
  - `<CategoryIcon category={need.category}>` - ikona kategorii
  - `<h3>` Tytuł potrzeby
  - `<UrgencyBadge urgency={need.urgency}>` - badge pilności
- `<p>` Opis potrzeby (if exists)
- `<ProgressBar>` - komponent paska postępu
- `<a>` Przycisk/link "Kup online" (if shopping_url exists)
  - `target="_blank"`
  - `rel="noopener noreferrer"`
  - `aria-label="Kup online - otworzy się w nowej karcie"`

**Obsługiwane interakcje**:

- Kliknięcie "Kup online" → otwarcie shopping_url w nowej karcie

**Obsługiwana walidacja**:

- Przycisk "Kup online" wyświetlany tylko gdy `shopping_url !== null`

**Typy**:

```typescript
import type { NeedListItemDTO } from "../types";

interface NeedCardProps {
  need: NeedListItemDTO;
}
```

**Propsy**:

- `need: NeedListItemDTO` - obiekt z pełnymi danymi potrzeby

---

### 4.8. `<ProgressBar>` (React Component)

**Opis komponentu**:
Wizualny wskaźnik postępu zbiórki prezentujący aktualną wartość względem wartości docelowej w formie tekstowej (np. "5/50 kg") oraz graficznego paska. Implementuje wymagania ARIA dla dostępności.

**Główne elementy**:

- `<div>` główny kontener
- `<div>` Tekst postępu: `{currentQuantity}/{targetQuantity} {unit}`
- `<div>` Progress bar container
  - `role="progressbar"`
  - `aria-valuenow={currentQuantity}`
  - `aria-valuemin="0"`
  - `aria-valuemax={targetQuantity}`
  - `aria-label="Postęp zbiórki: {progressPercentage}%"`
  - Wewnętrzny `<div>` z `width: {progressPercentage}%` i background color

**Obsługiwane interakcje**:

- Brak (komponent wizualny)

**Obsługiwana walidacja**:

- Brak

**Typy**:

```typescript
import type { NeedUnit } from "../types";

interface ProgressBarProps {
  currentQuantity: number;
  targetQuantity: number;
  unit: NeedUnit;
  progressPercentage: number;
}
```

**Propsy**:

- `currentQuantity: number` - aktualna ilość zebranych zasobów
- `targetQuantity: number` - docelowa ilość
- `unit: NeedUnit` - jednostka (szt, kg, l)
- `progressPercentage: number` - procent realizacji (0-100)

---

### 4.9. `<UrgencyBadge>` (React Component)

**Opis komponentu**:
Kolorowy badge wizualizujący poziom pilności potrzeby. Używa różnych kolorów tła i tekstu dla każdego poziomu urgency (low, medium, high, critical).

**Główne elementy**:

- `<span>` badge element z dynamiczną klasą Tailwind CSS
  - `urgency === 'low'` → klasy: bg-green-100, text-green-800
  - `urgency === 'medium'` → klasy: bg-yellow-100, text-yellow-800
  - `urgency === 'high'` → klasy: bg-orange-100, text-orange-800
  - `urgency === 'critical'` → klasy: bg-red-100, text-red-800
- Tekst labela (przetłumaczony):
  - low → "Niska"
  - medium → "Średnia"
  - high → "Wysoka"
  - critical → "Krytyczna"

**Obsługiwane interakcje**:

- Brak

**Obsługiwana walidacja**:

- Brak

**Typy**:

```typescript
import type { UrgencyLevel } from "../types";

interface UrgencyBadgeProps {
  urgency: UrgencyLevel;
}
```

**Propsy**:

- `urgency: UrgencyLevel` - poziom pilności

---

### 4.10. `<CategoryIcon>` (React Component)

**Opis komponentu**:
Komponent wyświetlający ikonę Lucide React odpowiadającą kategorii potrzeby. Mapuje enum `NeedCategory` na konkretną ikonę.

**Główne elementy**:

- Conditional rendering ikony Lucide:
  - `category === 'food'` → `<Utensils>` icon
  - `category === 'textiles'` → `<Shirt>` icon
  - `category === 'cleaning'` → `<Sparkles>` icon
  - `category === 'medical'` → `<HeartPulse>` icon
  - `category === 'toys'` → `<Dog>` icon
  - `category === 'other'` → `<Package>` icon

**Obsługiwane interakcje**:

- Brak

**Obsługiwana walidacja**:

- Brak

**Typy**:

```typescript
import type { NeedCategory } from "../types";

interface CategoryIconProps {
  category: NeedCategory;
  className?: string;
}
```

**Propsy**:

- `category: NeedCategory` - kategoria potrzeby
- `className?: string` - opcjonalne dodatkowe klasy CSS

---

### 4.11. `<NeedsEmptyState>` (React Component)

**Opis komponentu**:
Komponent wyświetlany gdy lista potrzeb po filtrowaniu jest pusta. Informuje użytkownika o braku wyników i sugeruje zmianę filtrów.

**Główne elementy**:

- `<div>` kontener z centrowaniem
- Ikona (np. `<PackageOpen>` z Lucide)
- `<p>` Komunikat: "Nie znaleziono potrzeb pasujących do wybranych filtrów"
- `<p>` Podpowiedź: "Spróbuj zmienić kryteria wyszukiwania"

**Obsługiwane interakcje**:

- Brak

**Obsługiwana walidacja**:

- Brak

**Typy**:

```typescript
interface NeedsEmptyStateProps {
  // brak props
}
```

**Propsy**:

- Brak

---

## 5. Typy

### 5.1. Istniejące typy (z `src/types.ts`)

Wszystkie potrzebne typy DTO są już zdefiniowane w `src/types.ts`:

**ProfileDetailDTO**:

```typescript
{
  id: string;
  name: string;
  city: string;
  address: string;
  location: Location; // { lat: number; lon: number; }
  phone_number: string | null;
  website_url: string | null;
  created_at: string;
  needs_summary: NeedsSummary; // { total: number; urgent: number; fulfilled: number; }
}
```

**NeedListItemDTO**:

```typescript
{
  id: string;
  shelter: ShelterInfo; // { id: string; name: string; city: string; }
  category: NeedCategory; // enum
  title: string;
  description: string | null;
  urgency: UrgencyLevel; // enum
  target_quantity: number;
  current_quantity: number;
  unit: NeedUnit; // enum
  progress_percentage: number;
  is_fulfilled: boolean;
  created_at: string;
}
```

**Enumy**:

- `NeedCategory`: 'food' | 'textiles' | 'cleaning' | 'medical' | 'toys' | 'other'
- `UrgencyLevel`: 'low' | 'medium' | 'high' | 'critical'
- `NeedUnit`: 'szt' | 'kg' | 'l'

### 5.2. Nowe typy komponentów

**FilterState** (stan filtrów w ShelterDetailView):

```typescript
interface FilterState {
  category: NeedCategory | "all";
  urgency: UrgencyLevel | "all";
}
```

- `category`: Obecnie wybrany filtr kategorii, wartość 'all' oznacza brak filtrowania
- `urgency`: Obecnie wybrany filtr pilności, wartość 'all' oznacza brak filtrowania

**Props interface dla każdego komponentu** (szczegóły w sekcji 4 powyżej):

- `BreadcrumbProps`
- `ShelterHeaderProps`
- `NeedsSummarySectionProps`
- `ShelterDetailViewProps`
- `NeedsFilterProps`
- `NeedCardProps`
- `ProgressBarProps`
- `UrgencyBadgeProps`
- `CategoryIconProps`
- `NeedsEmptyStateProps`

## 6. Zarządzanie stanem

### 6.1. Stan server-side (Astro frontmatter)

Dane są pobierane jednokrotnie podczas SSR i przekazywane do komponentów jako props. Brak persystencji stanu po stronie serwera poza czasem renderowania.

**Pobierane dane**:

```typescript
const shelterProfile: ProfileDetailDTO = await ProfileService.getProfileById(id);
const needsResponse: NeedListResponseDTO = await NeedsService.getNeeds({ shelter_id: id });
const needs: NeedListItemDTO[] = needsResponse.data;
```

### 6.2. Stan client-side (React)

**W komponencie `<ShelterDetailView>`**:

```typescript
const [filterState, setFilterState] = useState<FilterState>({
  category: "all",
  urgency: "all",
});

const filteredNeeds = useMemo(() => {
  return needs.filter((need) => {
    const categoryMatch = filterState.category === "all" || need.category === filterState.category;
    const urgencyMatch = filterState.urgency === "all" || need.urgency === filterState.urgency;
    return categoryMatch && urgencyMatch;
  });
}, [needs, filterState]);
```

**Callbacks dla filtrów**:

```typescript
const handleCategoryChange = (category: NeedCategory | "all") => {
  setFilterState((prev) => ({ ...prev, category }));
};

const handleUrgencyChange = (urgency: UrgencyLevel | "all") => {
  setFilterState((prev) => ({ ...prev, urgency }));
};
```

### 6.3. Custom Hooks (opcjonalnie)

Dla uproszczenia logiki filtrowania można wydzielić custom hook:

```typescript
// src/components/hooks/useNeedsFilter.ts
export function useNeedsFilter(needs: NeedListItemDTO[]) {
  const [filterState, setFilterState] = useState<FilterState>({
    category: "all",
    urgency: "all",
  });

  const filteredNeeds = useMemo(() => {
    return needs.filter((need) => {
      const categoryMatch = filterState.category === "all" || need.category === filterState.category;
      const urgencyMatch = filterState.urgency === "all" || need.urgency === filterState.urgency;
      return categoryMatch && urgencyMatch;
    });
  }, [needs, filterState]);

  const setCategory = (category: NeedCategory | "all") => {
    setFilterState((prev) => ({ ...prev, category }));
  };

  const setUrgency = (urgency: UrgencyLevel | "all") => {
    setFilterState((prev) => ({ ...prev, urgency }));
  };

  return {
    filteredNeeds,
    filterState,
    setCategory,
    setUrgency,
  };
}
```

## 7. Integracja API

### 7.1. Server-side API calls (w Astro frontmatter)

**Endpoint 1: Pobieranie danych schroniska**

```typescript
// Request
const shelterProfile = await ProfileService.getProfileById(id);

// Response type: ProfileDetailDTO
// Success (200):
{
  id: string;
  name: string;
  city: string;
  address: string;
  location: {
    lat: number;
    lon: number;
  }
  phone_number: string | null;
  website_url: string | null;
  created_at: string;
  needs_summary: {
    total: number;
    urgent: number;
    fulfilled: number;
  }
}

// Error handling:
// - 404: Shelter not found or not verified → redirect to 404 page
// - 500: Internal error → display error page
```

**Endpoint 2: Pobieranie listy potrzeb**

```typescript
// Request
const needsResponse = await NeedsService.getNeeds({
  shelter_id: id,
  fulfilled: false // only active needs
});

// Response type: NeedListResponseDTO
{
  data: NeedListItemDTO[];
  pagination: { total: number; limit: number; offset: number; };
}

// Wykorzystywane pole: needsResponse.data
```

### 7.2. Client-side API calls

**Brak** - wszystkie dane są pobierane podczas SSR. Widok jest read-only bez potrzeby aktualizacji danych po stronie klienta.

## 8. Interakcje użytkownika

### 8.1. Nawigacja Breadcrumb

- **Akcja**: Użytkownik klika "Strona główna" w breadcrumb
- **Reakcja**: Przejście do `/` (strona główna z mapą)

### 8.2. Kontakt telefoniczny

- **Akcja**: Użytkownik klika numer telefonu w ShelterHeader
- **Reakcja**: Otwarcie aplikacji telefonu/dialera z wypełnionym numerem (`tel:` protocol)

### 8.3. Otwarcie strony WWW schroniska

- **Akcja**: Użytkownik klika link strony WWW w ShelterHeader
- **Reakcja**: Otwarcie strony w nowej karcie przeglądarki (`target="_blank"`, `rel="noopener noreferrer"`)

### 8.4. Filtrowanie po kategorii

- **Akcja**: Użytkownik wybiera kategorię z dropdownu (np. "Karma")
- **Reakcja**:
  - Aktualizacja stanu `filterState.category`
  - Przeliczenie `filteredNeeds` (useMemo)
  - Re-render listy kart potrzeb z tylko tymi, które pasują do wybranej kategorii
  - Jeśli brak wyników → wyświetlenie `<NeedsEmptyState>`

### 8.5. Filtrowanie po pilności

- **Akcja**: Użytkownik wybiera pilność z dropdownu (np. "Wysoka")
- **Reakcja**:
  - Aktualizacja stanu `filterState.urgency`
  - Przeliczenie `filteredNeeds` (useMemo)
  - Re-render listy kart potrzeb z tylko tymi, które pasują do wybranego poziomu pilności
  - Jeśli brak wyników → wyświetlenie `<NeedsEmptyState>`

### 8.6. Combined filtering

- **Akcja**: Użytkownik ustawia zarówno kategorię jak i pilność
- **Reakcja**: Lista filtrowana według obu kryteriów jednocześnie (AND logic)

### 8.7. Kliknięcie "Kup online"

- **Akcja**: Użytkownik klika przycisk "Kup online" w NeedCard
- **Reakcja**:
  - Otwarcie `need.shopping_url` w nowej karcie
  - Użytkownik jest przekierowany do zewnętrznej strony (np. Ceneo, Google Shopping)
  - Oryginalny tab pozostaje na stronie schroniska

### 8.8. Wizualizacja postępu

- **Akcja**: Użytkownik przegląda karty potrzeb
- **Reakcja**:
  - Wizualna prezentacja postępu przez `<ProgressBar>`
  - Tekst informacyjny (np. "15/50 kg")
  - Pasek wypełniony proporcjonalnie do `progress_percentage`
  - Screen readery odczytują `aria-label` z informacją o procentowym postępie

## 9. Warunki i walidacja

### 9.1. Walidacja server-side (Astro frontmatter)

**Walidacja ID parametru**:

- **Warunek**: `id` musi być poprawnym UUID
- **Komponent**: Astro page frontmatter
- **Implementacja**: Użycie `ProfileIdParamsSchema` z Zod (z `src/lib/validation/profile.schemas.ts`)
- **Wpływ na UI**: Jeśli niepoprawny format → zwrócenie 404

**Walidacja istnienia schroniska**:

- **Warunek**: Schronisko o podanym ID musi istnieć w bazie
- **Komponent**: Astro page frontmatter
- **Implementacja**: `ProfileService.getProfileById(id)` throw NotFoundError jeśli nie istnieje
- **Wpływ na UI**: Catch NotFoundError → zwrócenie 404

**Walidacja statusu weryfikacji**:

- **Warunek**: Schronisko musi mieć status `verified`
- **Komponent**: Astro page frontmatter (logika w ProfileService)
- **Implementacja**: Service layer filtruje tylko zweryfikowane schroniska
- **Wpływ na UI**: Niezweryfikowane schroniska traktowane jako not found → 404

### 9.2. Walidacja client-side (React)

**Walidacja wartości filtrów**:

- **Warunek**: Wybrane wartości filtrów muszą być valid enum values lub 'all'
- **Komponent**: `<NeedsFilter>`
- **Implementacja**: TypeScript type checking + controlled Select components (Shadcn/ui)
- **Wpływ na UI**: Niemożliwe wybranie niepoprawnej wartości dzięki Select options

**Walidacja dostępności shopping_url**:

- **Warunek**: Przycisk "Kup online" wyświetlany tylko gdy `need.shopping_url !== null`
- **Komponent**: `<NeedCard>`
- **Implementacja**: Conditional rendering `{need.shopping_url && <a>...}</a>}`
- **Wpływ na UI**: Przycisk nie jest renderowany jeśli brak linku

**Walidacja opcjonalnych pól kontaktowych**:

- **Warunek**: Telefon i strona WWW wyświetlane tylko gdy nie są null
- **Komponent**: `<ShelterHeader>`
- **Implementacja**:
  ```tsx
  {
    phoneNumber && <a href={`tel:${phoneNumber}`}>...</a>;
  }
  {
    websiteUrl && <a href={websiteUrl}>...</a>;
  }
  ```
- **Wpływ na UI**: Brak wyświetlenia elementu jeśli wartość null

**Walidacja opisu potrzeby**:

- **Warunek**: Opis wyświetlany tylko gdy `need.description !== null`
- **Komponent**: `<NeedCard>`
- **Implementacja**: `{need.description && <p>{need.description}</p>}`
- **Wpływ na UI**: Paragraf opisu nie jest renderowany jeśli brak opisu

## 10. Obsługa błędów

### 10.1. Błędy server-side

**Scenario 1: Niepoprawny format ID**

- **Typ błędu**: Validation error
- **Kod HTTP**: 400 (lub redirect do 404)
- **Obsługa**: Walidacja w frontmatter → return Astro.redirect('/404')
- **Komunikat użytkownikowi**: Standardowa strona 404 "Nie znaleziono schroniska"

**Scenario 2: Schronisko nie istnieje**

- **Typ błędu**: NotFoundError
- **Kod HTTP**: 404
- **Obsługa**: Catch NotFoundError w try-catch → return Astro.redirect('/404')
- **Komunikat użytkownikowi**: Standardowa strona 404 "Nie znaleziono schroniska"

**Scenario 3: Schronisko niezweryfikowane**

- **Typ błędu**: Logika biznesowa (traktowane jako not found)
- **Kod HTTP**: 404
- **Obsługa**: ProfileService zwraca null → redirect to 404
- **Komunikat użytkownikowi**: Standardowa strona 404 (z bezpieczeństwa nie ujawniamy, że schronisko istnieje ale jest niezweryfikowane)

**Scenario 4: Błąd połączenia z bazą danych**

- **Typ błędu**: Database error / Internal error
- **Kod HTTP**: 500
- **Obsługa**: Catch generic Error → display error page
- **Komunikat użytkownikowi**: "Wystąpił błąd podczas ładowania danych. Spróbuj ponownie później."
- **Logging**: console.error z pełnymi szczegółami błędu

**Scenario 5: Błąd podczas pobierania listy potrzeb**

- **Typ błędu**: Service error
- **Kod HTTP**: 500
- **Obsługa**: Catch w try-catch → display error page lub render page z pustą listą + komunikatem
- **Komunikat użytkownikowi**: "Nie udało się załadować listy potrzeb."

### 10.2. Błędy client-side

**Scenario 6: Brak wyników po filtrowaniu**

- **Typ błędu**: Nie jest błędem, ale edge case
- **Obsługa**: Sprawdzenie `filteredNeeds.length === 0` → render `<NeedsEmptyState>`
- **Komunikat użytkownikowi**: "Nie znaleziono potrzeb pasujących do wybranych filtrów. Spróbuj zmienić kryteria wyszukiwania."

**Scenario 7: Nieprawidłowy shopping_url**

- **Typ błędu**: Potencjalnie malformed URL (nie powinno się zdarzyć przy poprawnej walidacji w backend)
- **Obsługa**: Walidacja URL przed renderowaniem linku, lub pozwolenie przeglądarce obsłużyć
- **Komunikat użytkownikowi**: Link może nie działać, użytkownik zobaczy błąd przeglądarki

**Scenario 8: Brak uprawnień do geolokalizacji (nie dotyczy tego widoku)**

- Nie applicable - widok nie używa geolokalizacji

## 11. Kroki implementacji

### Krok 1: Przygotowanie struktury plików

1. Utworzenie katalogu `src/pages/shelter/`
2. Utworzenie pliku `src/pages/shelter/[id].astro`
3. Utworzenie katalogu `src/components/shelter-detail/`
4. Utworzenie plików komponentów React w `src/components/shelter-detail/`:
   - `ShelterDetailView.tsx`
   - `NeedsFilter.tsx`
   - `NeedCard.tsx`
   - `ProgressBar.tsx`
   - `UrgencyBadge.tsx`
   - `CategoryIcon.tsx`
   - `NeedsEmptyState.tsx`
5. Utworzenie komponentów Astro (jeśli nie istnieją):
   - `src/components/Breadcrumb.astro`
   - `src/components/shelter-detail/ShelterHeader.astro`
   - `src/components/shelter-detail/NeedsSummarySection.astro`

### Krok 2: Implementacja serwisów (jeśli nie istnieją)

1. Sprawdzenie czy `ProfileService.getProfileById()` istnieje w `src/lib/services/profile.service.ts`
2. Sprawdzenie czy `NeedsService.getNeeds()` istnieje w `src/lib/services/needs.service.ts`
3. Implementacja brakujących metod zgodnie z API requirements

### Krok 3: Implementacja walidacji

1. Sprawdzenie czy `ProfileIdParamsSchema` istnieje w `src/lib/validation/profile.schemas.ts`
2. Implementacja schematu Zod jeśli nie istnieje:
   ```typescript
   export const ProfileIdParamsSchema = z.object({
     id: z.string().uuid(),
   });
   ```

### Krok 4: Implementacja komponentów leaf (od najmniejszych do największych)

1. **CategoryIcon.tsx**:
   - Import ikon Lucide (Utensils, Shirt, Sparkles, HeartPulse, Dog, Package)
   - Stworzenie mapy category → icon component
   - Implementacja conditional rendering

2. **UrgencyBadge.tsx**:
   - Stworzenie mapy urgency → klasy Tailwind (bg-_, text-_)
   - Stworzenie mapy urgency → polskie labele
   - Implementacja renderowania span z dynamicznymi klasami

3. **ProgressBar.tsx**:
   - Implementacja struktury HTML z semantic progress bar
   - Dodanie atrybutów ARIA (role, aria-valuenow, etc.)
   - Stylowanie paska postępu z Tailwind
   - Obliczenie width% na podstawie progressPercentage

4. **NeedsEmptyState.tsx**:
   - Import ikony PackageOpen z Lucide
   - Implementacja komunikatu z centrowaniem

### Krok 5: Implementacja komponentów kompozytowych

1. **NeedCard.tsx**:
   - Import komponentów leaf (CategoryIcon, UrgencyBadge, ProgressBar)
   - Struktura semantyczna HTML (article, h3)
   - Conditional rendering description i shopping_url
   - Implementacja przycisku "Kup online" z odpowiednimi atrybutami accessibility

2. **NeedsFilter.tsx**:
   - Import Select component z Shadcn/ui
   - Stworzenie opcji dla kategorii (z tłumaczeniami)
   - Stworzenie opcji dla pilności (z tłumaczeniami)
   - Implementacja controlled components z callbackami onChange

### Krok 6: Implementacja custom hook (opcjonalnie)

1. Utworzenie pliku `src/components/hooks/useNeedsFilter.ts`
2. Implementacja hooka zgodnie z sekcją 6.3
3. Export hooka

### Krok 7: Implementacja głównego komponentu React

1. **ShelterDetailView.tsx**:
   - Import wszystkich child components
   - Import useState, useMemo z React
   - Implementacja stanu filterState lub użycie custom hooka
   - Implementacja logiki filtrowania w useMemo
   - Implementacja callback functions dla filtrów
   - Renderowanie NeedsFilter + lista NeedCard
   - Conditional rendering NeedsEmptyState

### Krok 8: Implementacja komponentów Astro statycznych

1. **Breadcrumb.astro**:
   - Implementacja struktury nav > ol > li
   - Stylowanie z Tailwind
   - Dodanie odpowiednich atrybutów ARIA

2. **ShelterHeader.astro**:
   - Implementacja struktury header z h1, adresem, kontaktami
   - Conditional rendering phone i website
   - Implementacja clickable tel: i https:// linków
   - Stylowanie z Tailwind

3. **NeedsSummarySection.astro**:
   - Implementacja grid z trzema kartami statystyk
   - Import ikon z Lucide (opcjonalnie)
   - Wyświetlenie total, urgent, fulfilled
   - Stylowanie z Tailwind

### Krok 9: Implementacja głównej strony Astro

1. **shelter/[id].astro frontmatter**:
   - Import ProfileService, NeedsService
   - Import validation schema
   - Destrukturyzacja `const { id } = Astro.params`
   - Walidacja ID z użyciem Zod
   - Try-catch block:
     - Wywołanie ProfileService.getProfileById(id)
     - Wywołanie NeedsService.getNeeds({ shelter_id: id })
     - Catch NotFoundError → return Astro.redirect('/404')
     - Catch generic Error → console.error + return error page
   - Przygotowanie danych do przekazania do komponentów

2. **shelter/[id].astro template**:
   - Wrap w `<Layout>` z metadanymi:
     - title: `${shelter.name} - Shelterly`
     - description: Dynamiczny opis z nazwą schroniska i miastem
     - OG tags dla social sharing
   - Renderowanie `<Breadcrumb shelterName={shelter.name}>`
   - Renderowanie `<ShelterHeader {...shelterHeaderProps}>`
   - Renderowanie `<NeedsSummarySection summary={shelter.needs_summary}>`
   - Renderowanie `<ShelterDetailView needs={needs.data} client:load>`

### Krok 10: Stylowanie i responsywność

1. Przejście przez wszystkie komponenty i dodanie responsive Tailwind classes
2. Testowanie na różnych rozmiarach ekranu (mobile, tablet, desktop)
3. Upewnienie się, że grid layouts adaptują się (np. 1 kolumna na mobile, 2-3 na desktop)
4. Testowanie dark mode support (jeśli wymagane)

### Krok 11: Testy accessibility

1. Uruchomienie strony i testowanie z keyboard navigation (Tab, Enter)
2. Testowanie z screen readerem (VoiceOver na macOS, NVDA na Windows)
3. Sprawdzenie czy wszystkie elementy interaktywne są focusable
4. Sprawdzenie kontrastów kolorów (WCAG AA standard)
5. Walidacja HTML semantyki (W3C Validator)
6. Sprawdzenie atrybutów ARIA we wszystkich komponentach

### Krok 12: Testy funkcjonalne

1. **Test flow 1**: Otwarcie strony z poprawnym ID → sprawdzenie czy dane się ładują
2. **Test flow 2**: Otwarcie strony z niepoprawnym ID → sprawdzenie 404
3. **Test flow 3**: Filtrowanie po kategorii "Karma" → sprawdzenie czy lista się aktualizuje
4. **Test flow 4**: Filtrowanie po pilności "Wysoka" → sprawdzenie czy lista się aktualizuje
5. **Test flow 5**: Combined filtering → sprawdzenie logiki AND
6. **Test flow 6**: Ustawienie filtrów bez wyników → sprawdzenie empty state
7. **Test flow 7**: Kliknięcie "Kup online" → sprawdzenie otwierania nowej karty
8. **Test flow 8**: Kliknięcie telefonu → sprawdzenie tel: protocol
9. **Test flow 9**: Kliknięcie WWW → sprawdzenie otwierania w nowej karcie
10. **Test flow 10**: Breadcrumb navigation → sprawdzenie przekierowania do home

### Krok 13: Optymalizacja wydajności

1. Sprawdzenie czy `useMemo` jest użyte dla filtered needs (zapobiega re-computation)
2. Sprawdzenie czy komponenty child nie re-renderują się niepotrzebnie
3. Rozważenie użycia `React.memo()` dla drogich komponentów (jeśli potrzebne)
4. Sprawdzenie bundle size (czy Lucide icons są tree-shaken)
5. Sprawdzenie Lighthouse score (Performance, Accessibility, SEO)

### Krok 14: SEO i meta tags

1. Implementacja dynamicznych meta tags w head:
   - `<title>{shelter.name} - Shelterly</title>`
   - `<meta name="description" content="...">`
   - Open Graph tags: og:title, og:description, og:type
   - Twitter Card tags
2. Dodanie structured data (JSON-LD) dla organizacji (opcjonalnie)
3. Sprawdzenie czy canonical URL jest poprawny

### Krok 15: Code review i refactoring

1. Review kodu pod kątem zgodności z project coding guidelines
2. Sprawdzenie type safety (brak any types)
3. Sprawdzenie czy wszystkie importy są poprawne
4. Usunięcie console.logs (zostawienie tylko error logging)
5. Sprawdzenie czy nazwy zmiennych i funkcji są czytelne
6. Dodanie komentarzy JSDoc gdzie potrzebne

### Krok 16: Dokumentacja

1. Dodanie README.md w `src/components/shelter-detail/` z opisem komponentów
2. Dokumentacja props interfaces z JSDoc comments
3. Dodanie przykładów użycia w kommentarzach (jeśli pomocne)

### Krok 17: Final testing

1. End-to-end test pełnego user flow
2. Cross-browser testing (Chrome, Firefox, Safari)
3. Mobile testing (iOS Safari, Android Chrome)
4. Testing z wyłączonym JavaScript (SSR fallback)
5. Testing z wolnym połączeniem internetowym

### Krok 18: Deployment preparation

1. Sprawdzenie czy wszystkie environment variables są poprawnie skonfigurowane
2. Testing na staging environment (jeśli dostępny)
3. Przygotowanie release notes
4. Code merge i deployment do produkcji
