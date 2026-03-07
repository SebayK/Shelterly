# Plan implementacji widoku Dashboard — Zarządzanie potrzebami

## 1. Przegląd

Widok Dashboard umożliwia zweryfikowanemu schronisku pełne zarządzanie listą potrzeb (CRUD) z pomocą AI. Główny cel to tabela potrzeb z sortowaniem i paginacją, operacjami tworzenia/edycji/usuwania/realizacji potrzeb, oraz integracją z AI do generowania opisów i linków zakupowych. Widok jest dostępny wyłącznie dla zalogowanych użytkowników z rolą `shelter`.

## 2. Routing widoku

- **Ścieżka:** `/dashboard`
- **Plik strony:** `src/pages/dashboard.astro`
- **Layout:** `DashboardLayout.astro` (dashboard chrome: Navbar, StatusBanner, Header, Sidebar, BottomNav, Toaster)
- **Guard:** Middleware wymaga sesji → redirect do `/auth/login?return=/dashboard`
- **StatusBanner:** Renderowany SSR w `DashboardLayout.astro` dla statusów ≠ `verified`

## 3. Struktura komponentów

```
dashboard.astro (Astro page)
└── DashboardLayout.astro (Navbar, StatusBanner, Header, Sidebar, BottomNav, Toaster)
  └── <slot> — zawartość strony:
    └── NeedsManager (React island, client:load)
      ├── NeedsToolbar
      │   ├── Button "Dodaj potrzebę" (otwiera NeedFormDialog w trybie create)
      │   └── Informacja o liczbie potrzeb
      ├── NeedsTable
      │   ├── NeedsTableHeader (nagłówki kolumn)
      │   ├── NeedsTableRow[] (wiersze danych)
      │   │   └── NeedActions (menu akcji: Edytuj, Zrealizuj, Usuń)
      │   ├── NeedsTableSkeleton (skeleton podczas ładowania)
      │   └── NeedsTableEmpty (pusty stan)
      ├── NeedsPagination (przyciski Poprzednia/Następna)
      ├── NeedFormDialog (Dialog do tworzenia/edycji)
      │   ├── Pola formularza (category, title, description, urgency, target_quantity, unit, current_quantity, shopping_url)
      │   └── AIGenerateButton (x2: dla description i shopping_url)
      ├── DeleteNeedAlertDialog (potwierdzenie usunięcia)
      └── FulfillNeedAlertDialog (potwierdzenie realizacji)
```

## 4. Szczegóły komponentów

### 4.1 `NeedsManager` (React island — root)
- **Opis:** Główny komponent React montowany jako wyspa (`client:load`). Zarządza stanem listy potrzeb, paginacją, otwieraniem/zamykaniem modali, oraz koordynuje operacje CRUD.
- **Główne elementy:** `<div>` wrapper zawierający `NeedsToolbar`, `NeedsTable` lub `NeedsTableSkeleton` lub `NeedsTableEmpty`, `NeedsPagination`, `NeedFormDialog`, `DeleteNeedAlertDialog`, `FulfillNeedAlertDialog`
- **Obsługiwane interakcje:**
  - Montowanie — fetch listy potrzeb (`GET /api/needs?shelter_id={profileId}`)
  - Kliknięcie "Dodaj potrzebę" → otwarcie `NeedFormDialog` w trybie create
  - Kliknięcie "Edytuj" w wierszu → otwarcie `NeedFormDialog` w trybie edit (z danymi)
  - Kliknięcie "Usuń" w wierszu → otwarcie `DeleteNeedAlertDialog`
  - Kliknięcie "Zrealizuj" w wierszu → otwarcie `FulfillNeedAlertDialog`
  - Zmiana strony paginacji → refetch z nowym offset
- **Walidacja:** Sprawdzenie `accountStatus` — jeśli ≠ `verified`, przyciski CRUD są `disabled` z tooltipem wyjaśniającym
- **Typy:** `NeedsManagerProps`, `NeedListItemDTO`, `NeedListResponseDTO`, `Pagination`
- **Propsy:** `{ profileId: string; accountStatus: ShelterStatus; aiUsageCount: number; aiUsageLimit: number }`

### 4.2 `NeedsToolbar`
- **Opis:** Pasek narzędziowy nad tabelą z przyciskiem dodawania potrzeby i informacją o liczbie wyników.
- **Główne elementy:** `<div>` flex z `<h2>`, `<span>` z liczbą potrzeb, `<Button>` "Dodaj potrzebę"
- **Obsługiwane interakcje:** Kliknięcie przycisku "Dodaj potrzebę" → callback `onAddNeed`
- **Walidacja:** Przycisk disabled gdy `accountStatus ≠ verified` z `Tooltip` "Twoje konto musi być zweryfikowane"
- **Typy:** brak dodatkowych
- **Propsy:** `{ totalNeeds: number; onAddNeed: () => void; isDisabled: boolean }`

### 4.3 `NeedsTable`
- **Opis:** Tabela HTML z semantycznymi znacznikami (`<table>`, `<thead>`, `<tbody>`, `<th scope="col">`, `<tr>`, `<td>`) wyświetlająca listę potrzeb. Kolumny: Kategoria, Tytuł, Pilność, Postęp, Akcje.
- **Główne elementy:** `<table role="table">`, `<thead>` z `<th scope="col">`, `<tbody>` z mapowaniem `NeedsTableRow`
- **Obsługiwane interakcje:** Brak bezpośrednich — deleguje do `NeedActions` w każdym wierszu
- **Walidacja:** Brak
- **Typy:** `NeedListItemDTO[]`
- **Propsy:** `{ needs: NeedListItemDTO[]; onEdit: (need: NeedListItemDTO) => void; onDelete: (need: NeedListItemDTO) => void; onFulfill: (need: NeedListItemDTO) => void; isDisabled: boolean }`

### 4.4 `NeedsTableRow`
- **Opis:** Pojedynczy wiersz tabeli z danymi potrzeby. Wyświetla kategorię (Badge), tytuł, pilność (Badge), postęp (Progress bar + tekst), oraz menu akcji. Potrzeby zrealizowane (`is_fulfilled=true`) renderowane z `opacity-50` i dodatkowym Badge "Zrealizowana".
- **Główne elementy:** `<tr>` (z `className="opacity-50"` jeśli fulfilled), `<td>` x5, `Badge` (kategoria, pilność), `Progress`, `NeedActions`
- **Obsługiwane interakcje:** Delegowane do `NeedActions`
- **Walidacja:** Brak
- **Typy:** `NeedListItemDTO`, mapy polskich etykiet (`categoryLabels`, `urgencyConfig`, `unitLabels`)
- **Propsy:** `{ need: NeedListItemDTO; onEdit: () => void; onDelete: () => void; onFulfill: () => void; isDisabled: boolean }`

### 4.5 `NeedActions`
- **Opis:** Menu akcji dla potrzeby — przyciski/dropdown: Edytuj, Oznacz jako zrealizowaną, Usuń.
- **Główne elementy:** `DropdownMenu` z `DropdownMenuTrigger` (Button z ikoną "..."), `DropdownMenuItem` x3
- **Obsługiwane interakcje:** Kliknięcie Edytuj → `onEdit()`, Zrealizuj → `onFulfill()`, Usuń → `onDelete()`
- **Walidacja:** Wszystkie akcje `disabled` gdy `isDisabled` (status konta ≠ verified) lub `isFulfilled` (potrzeba już zrealizowana). Tooltip z wyjaśnieniem.
- **Typy:** brak dodatkowych
- **Propsy:** `{ onEdit: () => void; onDelete: () => void; onFulfill: () => void; isDisabled: boolean; isFulfilled: boolean }`

### 4.6 `NeedsTableSkeleton`
- **Opis:** Widok szkieletu ładowania — animowane placeholdery w kształcie wierszy tabeli.
- **Główne elementy:** `<table>` z `<thead>` i `<tbody>` zawierającymi `Skeleton` komponenty (5 wierszy)
- **Obsługiwane interakcje:** Brak
- **Walidacja:** Brak
- **Typy:** Brak
- **Propsy:** `{ rows?: number }` (domyślnie 5)

### 4.7 `NeedsTableEmpty`
- **Opis:** Pusty stan wyświetlany gdy schronisko nie ma żadnych potrzeb. Zachęta do dodania pierwszej potrzeby z wyraźnym CTA.
- **Główne elementy:** `<div>` z ikoną, nagłówkiem "Brak potrzeb", opisem, `<Button>` "Dodaj pierwszą potrzebę"
- **Obsługiwane interakcje:** Kliknięcie CTA → `onAddNeed()`
- **Walidacja:** Przycisk CTA disabled gdy `isDisabled` (status ≠ verified)
- **Typy:** Brak
- **Propsy:** `{ onAddNeed: () => void; isDisabled: boolean }`

### 4.8 `NeedsPagination`
- **Opis:** Przyciski paginacji "Poprzednia" / "Następna" z informacją o bieżącej stronie.
- **Główne elementy:** `<nav aria-label="Paginacja">`, `<Button>` "Poprzednia" (disabled na pierwszej stronie), `<span>` "Strona X z Y", `<Button>` "Następna" (disabled na ostatniej)
- **Obsługiwane interakcje:** Kliknięcie Poprzednia → `onPrevPage()`, Kliknięcie Następna → `onNextPage()`
- **Walidacja:** Brak
- **Typy:** `Pagination`
- **Propsy:** `{ pagination: Pagination; currentPage: number; onPrevPage: () => void; onNextPage: () => void }`

### 4.9 `NeedFormDialog`
- **Opis:** Modal (Shadcn `Dialog`) do tworzenia i edycji potrzeby. Tytuł zmienia się w zależności od trybu: "Dodaj potrzebę" / "Edytuj potrzebę". Zawiera formularz z walidacją po stronie klienta.
- **Główne elementy:**
  - `Dialog` + `DialogContent` + `DialogHeader` + `DialogTitle` + `DialogDescription`
  - Formularz `<form>`: `Select` (category), `Input` (title), `Textarea` (description) + `AIGenerateButton`, `Select` (urgency), `Input` (target_quantity), `Select` (unit), `Input` (current_quantity — tylko w trybie edit), `Input` (shopping_url) + `AIGenerateButton`
  - `DialogFooter`: `Button` "Anuluj" + `Button` "Zapisz"/"Dodaj"
- **Obsługiwane interakcje:**
  - Zmiana pól formularza → walidacja inline
  - Submit formularza → `POST /api/needs` (create) lub `PATCH /api/needs/:id` (edit)
  - Kliknięcie AI Generate (description) → `POST /api/ai/generate-description`
  - Kliknięcie AI Generate (shopping_url) → `POST /api/ai/generate-shopping-link`
  - Zamknięcie modalu (Escape, kliknięcie overlay, przycisk X)
- **Walidacja (Create):**
  - `category` — wymagane (enum: food, textiles, cleaning, medical, toys, other)
  - `title` — wymagane, 3-255 znaków
  - `description` — opcjonalne, max 2000 znaków
  - `urgency` — wymagane (enum: low, normal, high, urgent, critical), domyślnie "normal"
  - `target_quantity` — wymagane, liczba > 0, max 2 miejsca dziesiętne, max 99999999.99
  - `unit` — wymagane (enum: pcs, kg, g, l, ml, pack)
  - `shopping_url` — opcjonalne, musi być prawidłowym URL
- **Walidacja (Edit — dodatkowe):**
  - `current_quantity` — opcjonalne, ≥ 0, ≤ target_quantity
  - Wymagane co najmniej jedno zmienione pole
- **Typy:** `CreateNeedCommand`, `UpdateNeedCommand`, `NeedCreateResponseDTO`, `NeedUpdateResponseDTO`, `NeedFormData` (nowy typ ViewModel)
- **Propsy:** `{ open: boolean; onOpenChange: (open: boolean) => void; mode: "create" | "edit"; initialData?: NeedListItemDTO; shelterId: string; onSuccess: (need: NeedCreateResponseDTO | NeedUpdateResponseDTO) => void; aiUsageCount: number; aiUsageLimit: number; onAiUsageIncremented: () => void }`
- **Uwaga — Dwuetapowe tworzenie:** Po pomyślnym `POST /api/needs` w trybie create, dialog NIE zamyka się, ale przełącza się wewnętrznie na tryb edit z otrzymanym `need_id` z `NeedCreateResponseDTO`. Wyświetla toast "Potrzeba utworzona — teraz możesz wygenerować opis AI" i udostępnia przyciski AI. Zamknięcie dialogu po przejściu do trybu edit odświeża listę potrzeb.

### 4.10 `AIGenerateButton`
- **Opis:** Przycisk inline obok pól `description` i `shopping_url` w formularzu. Wywołuje endpoint AI i ładuje wynik do pola.
- **Główne elementy:** `<Button variant="outline" size="sm">` z ikoną Sparkles + tekst "Generuj AI"
- **Obsługiwane interakcje:** Kliknięcie → wywołanie odpowiedniego API AI, załadowanie wyniku do pola formularza, aktualizacja licznika AI
- **Walidacja:** Disabled gdy: AI limit osiągnięty, brak wymaganych danych (need_id w trybie edit, title i category), operacja w toku (loading)
- **Typy:** `GenerateDescriptionCommand`, `GenerateShoppingLinkCommand`, `AIGenerateDescriptionResponseDTO`, `AIGenerateShoppingLinkResponseDTO`
- **Propsy:** `{ type: "description" | "shopping_url"; needId?: string; formData: { title: string; category: NeedCategory; target_quantity?: number; unit?: NeedUnit }; onResult: (value: string) => void; onAiUsageIncremented: () => void; disabled: boolean; aiUsageCount: number; aiUsageLimit: number }`

### 4.11 `DeleteNeedAlertDialog`
- **Opis:** Dialog potwierdzenia usunięcia (Shadcn `AlertDialog`). Wyświetla tytuł potrzeby i prosi o potwierdzenie.
- **Główne elementy:** `AlertDialog` + `AlertDialogContent` + `AlertDialogHeader` + `AlertDialogTitle` + `AlertDialogDescription` + `AlertDialogFooter` + `AlertDialogCancel` + `AlertDialogAction`
- **Obsługiwane interakcje:** Potwierdzenie → `DELETE /api/needs/:id`, Anulowanie → zamknięcie dialogu
- **Walidacja:** Brak
- **Typy:** `NeedDeleteResponseDTO`
- **Propsy:** `{ open: boolean; onOpenChange: (open: boolean) => void; need: NeedListItemDTO | null; onConfirm: () => void; isDeleting: boolean }`

### 4.12 `FulfillNeedAlertDialog`
- **Opis:** Dialog potwierdzenia oznaczenia jako zrealizowane (Shadcn `AlertDialog`). Wyświetla tytuł potrzeby.
- **Główne elementy:** Jak `DeleteNeedAlertDialog`, ale z odpowiednim tekstem
- **Obsługiwane interakcje:** Potwierdzenie → `POST /api/needs/:id/fulfill`, Anulowanie → zamknięcie
- **Walidacja:** Brak
- **Typy:** `NeedFulfillResponseDTO`
- **Propsy:** `{ open: boolean; onOpenChange: (open: boolean) => void; need: NeedListItemDTO | null; onConfirm: () => void; isFulfilling: boolean }`

## 5. Typy

### Istniejące typy z `src/types.ts` (do wykorzystania bez zmian):
- `NeedListItemDTO` — element listy potrzeb (id, shelter, category, title, description, urgency, target_quantity, current_quantity, unit, progress_percentage, is_fulfilled, created_at)
- `NeedListResponseDTO` — wrapper z paginacją (`{ data: NeedListItemDTO[]; pagination: Pagination }`)
- `NeedCreateResponseDTO` — odpowiedź po utworzeniu (id, shelter_id, category, title, description, shopping_url, urgency, target_quantity, current_quantity, unit, is_fulfilled, created_at)
- `NeedUpdateResponseDTO` — odpowiedź po aktualizacji (id, title, description, urgency, current_quantity, progress_percentage, updated_at)
- `NeedDeleteResponseDTO` — odpowiedź po usunięciu (message, deleted_at)
- `NeedFulfillResponseDTO` — odpowiedź po realizacji (id, is_fulfilled, updated_at)
- `AIGenerateDescriptionResponseDTO` — odpowiedź AI opis (description, ai_usage_incremented)
- `AIGenerateShoppingLinkResponseDTO` — odpowiedź AI link (shopping_url, ai_usage_incremented)
- `CreateNeedCommand` — body POST /api/needs
- `UpdateNeedCommand` — body PATCH /api/needs/:id
- `GenerateDescriptionCommand` — body POST /api/ai/generate-description
- `GenerateShoppingLinkCommand` — body POST /api/ai/generate-shopping-link
- `Pagination` — metadane paginacji (total, limit, offset)
- `ShelterStatus` — enum statusu konta
- `NeedCategory`, `UrgencyLevel`, `NeedUnit` — enumy
- `ErrorResponse`, `ErrorCode` — typy błędów API

### Nowe typy ViewModel (do zdefiniowania w `src/components/dashboard/types.ts`):

#### `NeedsManagerProps`
```typescript
interface NeedsManagerProps {
  profileId: string;           // UUID schroniska (do filtrowania GET /api/needs?shelter_id=)
  accountStatus: ShelterStatus; // Status konta (verified/pending/suspended/rejected)
  aiUsageCount: number;         // Aktualne wykorzystanie AI
  aiUsageLimit: number;         // Limit AI (z APP_CONFIG)
}
```

#### `NeedFormData`
```typescript
interface NeedFormData {
  category: NeedCategory | "";     // "" jako placeholder "Wybierz kategorię"
  title: string;
  description: string;
  urgency: UrgencyLevel;
  target_quantity: string;          // string dla input, konwertowane do number przy submit
  unit: NeedUnit | "";              // "" jako placeholder "Wybierz jednostkę"
  current_quantity: string;         // string dla input, tylko w trybie edit
  shopping_url: string;
}
```

#### `NeedFormFieldErrors`
```typescript
interface NeedFormFieldErrors {
  category?: string;
  title?: string;
  description?: string;
  urgency?: string;
  target_quantity?: string;
  unit?: string;
  current_quantity?: string;
  shopping_url?: string;
}
```

#### `NeedFormDialogProps`
```typescript
interface NeedFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: NeedListItemDTO;
  shelterId: string;
  onSuccess: (need: NeedCreateResponseDTO | NeedUpdateResponseDTO) => void;
  aiUsageCount: number;
  aiUsageLimit: number;
  onAiUsageIncremented: () => void;
}
```

## 6. Zarządzanie stanem

### Custom hook: `useNeeds`

Hook `useNeeds` centralizuje logikę pobierania, paginacji i operacji CRUD na potrzebach.

**Plik:** `src/components/hooks/useNeeds.ts`

**Stan wewnętrzny:**
- `needs: NeedListItemDTO[]` — aktualna lista potrzeb
- `pagination: Pagination | null` — metadane paginacji
- `isLoading: boolean` — ładowanie listy
- `error: string | null` — błąd pobierania
- `currentPage: number` — bieżąca strona (obliczana z offset/limit)

**Parametry:**
- `shelterId: string` — filtr shelter_id
- `pageSize: number` — liczba elementów na stronę (domyślnie 10)

**Zwracane wartości:**
- `needs`, `pagination`, `isLoading`, `error`, `currentPage`
- `fetchNeeds(page?: number)` — pobiera stronę potrzeb
- `refresh()` — odświeża bieżącą stronę
- `goToPage(page: number)` — nawigacja do strony
- `nextPage()` / `prevPage()` — nawigacja paginacji
- `totalPages: number` — obliczony z `pagination.total / limit`

### Stan w `NeedsManager` (komponent root):
- `formDialogOpen: boolean` — czy modal formularza jest otwarty
- `formDialogMode: "create" | "edit"` — tryb formularza
- `editingNeed: NeedListItemDTO | null` — potrzeba edytowana (null = create)
- `deleteDialogOpen: boolean` — czy dialog usuwania jest otwarty
- `deletingNeed: NeedListItemDTO | null` — potrzeba do usunięcia
- `isDeleting: boolean` — stan operacji usuwania
- `fulfillDialogOpen: boolean` — czy dialog realizacji jest otwarty
- `fulfillingNeed: NeedListItemDTO | null` — potrzeba do realizacji
- `isFulfilling: boolean` — stan operacji realizacji
- `aiUsageCount: number` — lokalny licznik AI (inicjalizowany z props, aktualizowany po operacji AI)

### Stan w `NeedFormDialog`:
- `formData: NeedFormData` — dane formularza
- `fieldErrors: NeedFormFieldErrors` — błędy pól
- `isSubmitting: boolean` — trwa zapisywanie
- `apiError: string | null` — błąd API

## 7. Integracja API

### 7.1 Pobieranie listy potrzeb
- **Endpoint:** `GET /api/needs?shelter_id={profileId}&limit={pageSize}&offset={offset}` (bez filtra fulfilled — wyświetlamy wszystkie, zrealizowane z wizualnym wygaszeniem)
- **Typ odpowiedzi:** `NeedListResponseDTO` (`{ data: NeedListItemDTO[], pagination: Pagination }`)
- **Wywołanie:** W `useNeeds` hook, przy montowaniu i zmianach strony
- **Obsługa błędów:** 400 → komunikat walidacji, 500 → toast z komunikatem ogólnym

### 7.2 Tworzenie potrzeby
- **Endpoint:** `POST /api/needs`
- **Typ żądania:** `CreateNeedCommand` (`{ category, title, urgency, target_quantity, unit, description?, shopping_url? }`)
- **Typ odpowiedzi:** `NeedCreateResponseDTO`
- **Wywołanie:** W `NeedFormDialog` po submit w trybie create
- **Obsługa błędów:** 400 → błędy walidacji, 401 → redirect do logowania, 403 → toast "Konto niezweryfikowane", 429 → toast "Zbyt wiele prób"

### 7.3 Edycja potrzeby
- **Endpoint:** `PATCH /api/needs/:id`
- **Typ żądania:** `UpdateNeedCommand` (częściowy — tylko zmienione pola)
- **Typ odpowiedzi:** `NeedUpdateResponseDTO`
- **Wywołanie:** W `NeedFormDialog` po submit w trybie edit
- **Obsługa błędów:** 400 → błędy walidacji (w tym current_quantity > target_quantity), 401 → redirect, 403 → toast, 404 → toast "Potrzeba nie znaleziona"

### 7.4 Usuwanie potrzeby
- **Endpoint:** `DELETE /api/needs/:id`
- **Typ odpowiedzi:** `NeedDeleteResponseDTO`
- **Wywołanie:** W `NeedsManager` po potwierdzeniu w `DeleteNeedAlertDialog`
- **Obsługa błędów:** 401 → redirect, 403 → toast, 404 → toast "Potrzeba nie znaleziona"

### 7.5 Oznaczenie jako zrealizowana
- **Endpoint:** `POST /api/needs/:id/fulfill`
- **Typ odpowiedzi:** `NeedFulfillResponseDTO`
- **Wywołanie:** W `NeedsManager` po potwierdzeniu w `FulfillNeedAlertDialog`
- **Obsługa błędów:** 401 → redirect, 403 → toast, 404 → toast "Potrzeba nie znaleziona lub już zrealizowana"

### 7.6 Generowanie opisu AI
- **Endpoint:** `POST /api/ai/generate-description`
- **Typ żądania:** `GenerateDescriptionCommand` (`{ need_id, category, title, target_quantity, unit }`)
- **Typ odpowiedzi:** `AIGenerateDescriptionResponseDTO` (`{ description, ai_usage_incremented }`)
- **Wywołanie:** W `AIGenerateButton` type="description"
- **Uwaga:** Wymaga `need_id` — dostępne tylko w trybie edit (po zapisaniu potrzeby). Po pomyślnym utworzeniu potrzeby w trybie create, dialog automatycznie przechodzi do trybu edit z nowym `need_id`, umożliwiając natychmiastowe użycie AI.
- **Obsługa błędów:** 403 → "Limit AI osiągnięty" lub "Brak uprawnień", 429 → "Zbyt wiele prób"

### 7.7 Generowanie linku zakupowego AI
- **Endpoint:** `POST /api/ai/generate-shopping-link`
- **Typ żądania:** `GenerateShoppingLinkCommand` (`{ need_id, title, category }`)
- **Typ odpowiedzi:** `AIGenerateShoppingLinkResponseDTO` (`{ shopping_url, ai_usage_incremented }`)
- **Wywołanie:** W `AIGenerateButton` type="shopping_url"
- **Uwaga:** Jak wyżej — wymaga `need_id`, dostępne po zapisaniu potrzeby (tryb edit lub po dwuetapowym create).
- **Obsługa błędów:** Jak 7.6

## 8. Interakcje użytkownika

1. **Ładowanie strony** → Widok wyświetla skeleton, hook `useNeeds` pobiera dane → wyświetlenie tabeli lub pustego stanu
2. **Kliknięcie "Dodaj potrzebę"** → Otwarcie `NeedFormDialog` (mode=create, pusty formularz, domyślna pilność "normal")
3. **Wypełnienie i submit formularza (create)** → Walidacja kliencka → `POST /api/needs` → sukces: toast "Potrzeba utworzona", dialog przechodzi automatycznie do trybu edit z nowym `need_id` (dwuetapowe tworzenie — umożliwia natychmiastowe użycie AI); błąd: komunikat w formularzu
4. **Kliknięcie "Edytuj" w wierszu** → Otwarcie `NeedFormDialog` (mode=edit, wypełniony danymi potrzeby)
5. **Edycja i submit formularza (edit)** → Walidacja → `PATCH /api/needs/:id` (tylko zmienione pola) → sukces: toast, zamknięcie, aktualizacja wiersza; błąd: komunikat
6. **Kliknięcie przycisku AI (description)** → Spinner na przycisku → `POST /api/ai/generate-description` → załadowanie tekstu do textarea + inkrementacja licznika AI
7. **Kliknięcie przycisku AI (shopping_url)** → Spinner → `POST /api/ai/generate-shopping-link` → załadowanie URL do pola input + inkrementacja licznika AI
8. **Kliknięcie "Usuń"** → `DeleteNeedAlertDialog` z nazwą potrzeby → Potwierdzenie → `DELETE /api/needs/:id` → toast, odświeżenie listy
9. **Kliknięcie "Oznacz jako zrealizowaną"** → `FulfillNeedAlertDialog` → Potwierdzenie → `POST /api/needs/:id/fulfill` → toast, odświeżenie listy
10. **Nawigacja paginacji** → Kliknięcie Poprzednia/Następna → fetch z nowym offset → aktualizacja tabeli
11. **Zamknięcie modalu** → Escape / kliknięcie overlay / przycisk X → reset formularza i błędów

## 9. Warunki i walidacja

### Walidacja na poziomie formularza (NeedFormDialog):

| Pole | Warunek | Komunikat |
|---|---|---|
| `category` | Wymagane, enum | "Wybierz kategorię" |
| `title` | Wymagane, 3-255 znaków | "Tytuł musi mieć 3-255 znaków" |
| `description` | Opcjonalne, max 2000 znaków | "Opis nie może przekraczać 2000 znaków" |
| `urgency` | Wymagane, enum | "Wybierz poziom pilności" |
| `target_quantity` | Wymagane, > 0, max 99999999.99, max 2 miejsca dziesiętne | "Ilość docelowa musi być liczbą większą od 0" |
| `unit` | Wymagane, enum | "Wybierz jednostkę" |
| `current_quantity` | (edit) Opcjonalne, ≥ 0, ≤ target_quantity | "Ilość bieżąca nie może przekraczać ilości docelowej" |
| `shopping_url` | Opcjonalne, prawidłowy URL | "Podaj prawidłowy adres URL" |

### Warunki na poziomie komponentów:

| Warunek | Dotyczy | Efekt |
|---|---|---|
| `accountStatus ≠ "verified"` | Przycisk "Dodaj potrzebę", menu akcji | `disabled` + Tooltip "Twoje konto musi być zweryfikowane, aby zarządzać potrzebami" |
| `need.is_fulfilled === true` | Akcje Edytuj, Zrealizuj | `disabled` — potrzeba już zrealizowana |
| `aiUsageCount >= aiUsageLimit` | AIGenerateButton | `disabled` + Tooltip "Osiągnięto limit wykorzystania AI" |
| `brak need_id` (tryb create, przed zapisaniem) | AIGenerateButton | `disabled` + Tooltip "Zapisz potrzebę, aby użyć generowania AI" |
| `brak title lub category w formularzu` | AIGenerateButton | `disabled` — brak wystarczających danych |
| Pierwsza strona paginacji | Przycisk "Poprzednia" | `disabled` |
| Ostatnia strona paginacji | Przycisk "Następna" | `disabled` |

## 10. Obsługa błędów

### Błędy sieciowe i timeout:
- Użycie `fetchWithTimeout` (wzorzec z `ProfileForm`) z timeout 15s dla operacji CRUD, 20s dla AI
- Błąd sieci / timeout → toast: "Nie udało się połączyć z serwerem. Sprawdź połączenie i spróbuj ponownie."

### Błędy API ze znanych kodów:
| Kod HTTP | ErrorCode | Akcja |
|---|---|---|
| 400 | VALIDATION_ERROR | Wyświetlenie błędów przy polach formularza |
| 400 | INVALID_REQUEST | Toast z komunikatem ogólnym |
| 401 | UNAUTHORIZED | Redirect do `/auth/login?return=/dashboard` |
| 403 | FORBIDDEN | Toast "Brak uprawnień do wykonania tej operacji" |
| 403 | ACCOUNT_PENDING | Toast "Twoje konto oczekuje na weryfikację" |
| 404 | NOT_FOUND | Toast "Potrzeba nie została znaleziona" + odświeżenie listy |
| 429 | RATE_LIMIT_EXCEEDED | Toast "Zbyt wiele prób. Spróbuj ponownie za chwilę." |
| 500 | INTERNAL_ERROR | Toast "Wystąpił problem z serwerem" |

### Optymistyczne aktualizacje:
- Nie stosujemy optymistycznych aktualizacji — po każdej operacji CRUD odświeżamy listę z serwera (`refresh()` z `useNeeds`), aby zachować spójność danych.

### Wyścigi (race conditions):
- Disable przycisku submit podczas operacji
- AbortController dla zduplikowanych żądań w `useNeeds`

## 11. Kroki implementacji

### Faza 1: Przygotowanie infrastruktury UI
1. Zainstalować brakujące komponenty Shadcn/ui: `dialog`, `alert-dialog`, `table`, `tooltip`, `textarea`, `skeleton`, `label`
   - Komenda: `npx shadcn@latest add dialog alert-dialog table tooltip textarea skeleton label`
2. Utworzyć katalog `src/components/dashboard/`
3. Utworzyć plik typów ViewModel `src/components/dashboard/types.ts` z nowymi typami (`NeedsManagerProps`, `NeedFormData`, `NeedFormFieldErrors`, `NeedFormDialogProps`)

### Faza 2: Walidacja formularza potrzeb
4. Utworzyć `src/lib/validation/need-form.schemas.ts` — walidacja po stronie klienta (frontendowa), wzorowana na `profile-form.schemas.ts`. Funkcje: `validateNeedField()`, `validateNeedForm()`, `hasNeedFormErrors()`, obsługa walidacji cross-field (`current_quantity ≤ target_quantity`)

### Faza 3: Custom hook `useNeeds`
5. Utworzyć `src/components/hooks/useNeeds.ts` — logika pobierania listy potrzeb z paginacją, obsługa ładowania/błędów, metody nawigacji stronami, AbortController

### Faza 4: Komponenty prezentacyjne (liście od dołu drzewa)
6. Utworzyć `src/components/dashboard/NeedsTableSkeleton.tsx` — szkielet ładowania tabeli
7. Utworzyć `src/components/dashboard/NeedsTableEmpty.tsx` — pusty stan z CTA
8. Utworzyć `src/components/dashboard/NeedsPagination.tsx` — nawigacja paginacji
9. Utworzyć `src/components/dashboard/NeedActions.tsx` — DropdownMenu z akcjami (Edytuj, Zrealizuj, Usuń)
10. Utworzyć `src/components/dashboard/NeedsTableRow.tsx` — wiersz tabeli z Badge, Progress, NeedActions
11. Utworzyć `src/components/dashboard/NeedsTable.tsx` — tabela HTML z nagłówkami i mapowaniem wierszy
12. Utworzyć `src/components/dashboard/NeedsToolbar.tsx` — pasek z przyciskiem "Dodaj potrzebę"

### Faza 5: Formularze i dialogi
13. Utworzyć `src/components/dashboard/AIGenerateButton.tsx` — przycisk AI z logiką wywołania API, spinner, obsługa błędów
14. Utworzyć `src/components/dashboard/NeedFormDialog.tsx` — modal Dialog z formularzem create/edit, walidacja, integracja z AIGenerateButton
15. Utworzyć `src/components/dashboard/DeleteNeedAlertDialog.tsx` — AlertDialog potwierdzenia usuwania
16. Utworzyć `src/components/dashboard/FulfillNeedAlertDialog.tsx` — AlertDialog potwierdzenia realizacji

### Faza 6: Komponent root i integracja
17. Utworzyć `src/components/dashboard/NeedsManager.tsx` — główny komponent React łączący hook `useNeeds`, wszystkie podkomponenty, zarządzanie stanami modali i operacjami CRUD
18. Zaktualizować `src/pages/dashboard.astro` — zamienić placeholder na `<NeedsManager client:load>` z propsami z profilu (profileId, accountStatus, aiUsageCount, aiUsageLimit)

### Faza 7: Polskie etykiety i mapy
19. Utworzyć `src/components/dashboard/constants.ts` — współdzielone mapy etykiet polskich (categoryLabels, urgencyConfig, unitLabels) + mapowanie błędów API na komunikaty PL. Reuse istniejących map z `NeedCard.tsx`.

### Faza 8: Weryfikacja
20. Weryfikacja manualna:
    - Sprawdzić ładowanie strony z pustą listą (empty state)
    - Przetestować tworzenie potrzeby (formularz walidacja + submit)
    - Przetestować edycję potrzeby (pre-fill, walidacja cross-field)
    - Przetestować usuwanie potrzeby (AlertDialog + toast)
    - Przetestować realizację potrzeby (AlertDialog + toast)
    - Przetestować paginację (nawigacja, disabled na krańcach)
    - Przetestować disabled state przy statusie konta `pending`
    - Przetestować przyciski AI (generate description, shopping link)
    - Przetestować obsługę błędów (401 redirect, 403 toast, 429 rate limit)
    - Sprawdzić dostępność: focus trap w modalach, Escape, aria atrybuty, screen reader
    - Sprawdzić responsywność (mobile vs desktop)
21. Weryfikacja lint + TypeScript:
    - `npm run lint` — brak nowych błędów ESLint
    - `npx tsc --noEmit` — brak błędów TypeScript
