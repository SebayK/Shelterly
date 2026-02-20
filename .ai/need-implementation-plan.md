# API Endpoint Implementation Plan: GET /api/needs/:id

## 1. Przegląd punktu końcowego
Endpoint `GET /api/needs/:id` zwraca szczegóły pojedynczej potrzeby schroniska, widoczne publicznie tylko dla aktywnych (nieusuniętych soft-delete) rekordów i powiązanych ze zweryfikowanym schroniskiem.

Cel biznesowy:
- umożliwić prezentację pełnych danych potrzeby w widoku szczegółowym,
- zachować spójność z kontraktem DTO `NeedDetailDTO` z `src/types.ts`,
- zapewnić przewidywalną obsługę błędów (`400`, `404`, `500`) i zgodność ze standardem projektu.

Zakres:
- implementacja nowej trasy API `src/pages/api/needs/[id].ts`,
- rozszerzenie `NeedsService` o pobieranie szczegółu po `id`,
- dodanie walidacji parametru ścieżki w Zod,
- wykorzystanie istniejących helperów błędów i logowania.

## 2. Szczegóły żądania
- Metoda HTTP: `GET`
- URL: `/api/needs/:id`
- Path params:
  - wymagane: `id` (UUID)
  - opcjonalne: brak
- Query params: brak
- Request body: brak
- Uwierzytelnianie: brak (endpoint publiczny)

Walidacja wejścia:
- dodać schemat Zod, np. `NeedIdParamsSchema` w `src/lib/validation/needs.schemas.ts`:
  - `id: z.string().uuid("Invalid need ID format")`
- użyć `safeParse(params)` w route,
- przy błędzie walidacji zwrócić `400 VALIDATION_ERROR` + `details`.

## 3. Szczegóły odpowiedzi
### 3.1. Sukces (`200 OK`)
Body zgodne z `NeedDetailDTO`:
- `id`
- `shelter`: `id`, `name`, `city`, `phone_number`
- `category`, `title`, `description`, `shopping_url`, `urgency`
- `target_quantity`, `current_quantity`, `unit`
- `progress_percentage` (liczone jako `round(current_quantity / target_quantity * 100)`)
- `is_fulfilled`, `created_at`, `updated_at`

### 3.2. Błędy
- `400 Bad Request`:
  - kod: `VALIDATION_ERROR`
  - przypadek: niepoprawny format `id`
- `404 Not Found`:
  - kod: `NOT_FOUND`
  - przypadki: brak potrzeby, rekord soft-deleted, brak powiązanego zweryfikowanego schroniska
- `500 Internal Server Error`:
  - kod: `INTERNAL_ERROR`
  - przypadki: błąd warstwy DB/Supabase, brak klienta DB, wyjątek nieobsłużony

### 3.3. Wykorzystywane typy
DTO:
- `NeedDetailDTO`
- `ShelterDetailInfo`
- `ErrorResponse`

Command modele:
- brak (endpoint odczytowy GET bez body)

Walidacja:
- nowy schemat parametrów: `NeedIdParamsSchema`

## 4. Przepływ danych
1. Klient wywołuje `GET /api/needs/:id`.
2. Route `src/pages/api/needs/[id].ts` pobiera `params.id`.
3. Route waliduje `id` przez `NeedIdParamsSchema`.
4. Route pobiera klienta Supabase z `context.locals.supabase` (zgodnie z middleware).
5. Route wywołuje `NeedsService.getNeedById(id)`.
6. Service wykonuje zapytanie do `needs` z join do `profiles`, z filtrami:
   - `needs.id = :id`
   - `needs.deleted_at IS NULL`
   - `profiles.status = 'verified'`
7. Service mapuje rekord do `NeedDetailDTO` i liczy `progress_percentage`.
8. Route zwraca `200` z JSON.
9. W przypadku wyjątków route mapuje błędy na `404`/`500` i loguje je przez `logError`.

Proponowany select (koncept):
- z `needs`: `id, category, title, description, shopping_url, urgency, target_quantity, current_quantity, unit, is_fulfilled, created_at, updated_at`
- z `profiles!inner`: `id, name, city, phone_number, status`

## 5. Względy bezpieczeństwa
- **Walidacja identyfikatora**: odrzucać nie-UUID (`400`), aby ograniczyć błędne/botowe żądania.
- **Kontrola widoczności danych**: zwracać tylko pola z kontraktu DTO, bez danych wrażliwych profilu.
- **Soft delete enforcement**: obowiązkowy filtr `deleted_at IS NULL`, aby nie ujawniać archiwalnych rekordów.
- **Status schroniska**: wymagać `profiles.status = 'verified'` dla publicznego dostępu.
- **Neutralny komunikat 404**: nie ujawniać, czy rekord istniał i został usunięty.
- **Źródło klienta DB**: używać wyłącznie `context.locals.supabase` (bez importu globalnego klienta w route).

## 6. Obsługa błędów
Scenariusze i mapowanie:
- `id` nie jest UUID -> `400 VALIDATION_ERROR`.
- brak klienta DB w `locals` -> `500 INTERNAL_ERROR`.
- Supabase zwraca `error` lub brak rekordu po filtrach ->
  - brak rekordu: rzucić `NotFoundError` -> `404 NOT_FOUND`,
  - błąd zapytania: rzucić `InternalError` -> `500 INTERNAL_ERROR`.
- niespójne dane relacyjne (np. brak wymaganych pól schroniska) -> `InternalError` + log.
- nieoczekiwany wyjątek -> `500 INTERNAL_ERROR`.

Logowanie:
- używać `logError("[GET /api/needs/:id]", error)` w route,
- używać `logError("[NeedsService.getNeedById]", error)` w serwisie,
- brak dedykowanej tabeli błędów w obecnym zakresie; jeśli wymagany audit trail, dodać osobny task architektoniczny (np. tabela `error_logs`) poza tym endpointem.

Uwagi o kodach statusu (zgodność globalna):
- `200` używane w tym endpointcie,
- `201` nie dotyczy endpointu GET (stosować przy tworzeniu zasobów),
- `400`, `401`, `404`, `500` pozostają częścią wspólnego standardu API projektu.

## 7. Wydajność
- Zapytanie po `needs.id` korzysta z PK (bardzo selektywne, szybkie).
- Dodatkowe filtry (`deleted_at`, join po `shelter_id`, `profiles.status`) mają niski koszt przy pojedynczym rekordzie.
- Unikać dodatkowych zapytań (jedno zapytanie z joinem zamiast N+1).
- Brak potrzeby paginacji i cache dla pojedynczego zasobu; można opcjonalnie dodać krótki `Cache-Control` dla publicznych odczytów.
- Obliczenie `progress_percentage` wykonywać w aplikacji (stały koszt O(1)).

## 8. Kroki implementacji
1. **Walidacja params**
   - W `src/lib/validation/needs.schemas.ts` dodać `NeedIdParamsSchema`.
   - Wyeksportować typy input/output, jeśli zespół utrzymuje ten wzorzec.

2. **Rozszerzenie service**
   - W `src/lib/services/needs.service.ts` dodać metodę `getNeedById(id: string): Promise<NeedDetailDTO>`.
   - Wykonać `select` z joinem `profiles!inner`, filtrami `id`, `deleted_at IS NULL`, `profiles.status = verified`.
   - Przy braku rekordu rzucić `NotFoundError("Need not found or deleted")`.
   - Przy błędzie DB rzucić `InternalError("Unable to retrieve need details")`.
   - Zamapować dane do `NeedDetailDTO` i policzyć `progress_percentage`.

3. **Nowa trasa endpointu**
   - Utworzyć `src/pages/api/needs/[id].ts`.
   - Dodać `export const prerender = false`.
   - Zaimplementować handler `GET`:
     - walidacja params,
     - pobranie `locals.supabase`,
     - wywołanie serwisu,
     - odpowiedź `200`.

4. **Mapowanie błędów HTTP**
   - `NotFoundError` -> `404 NOT_FOUND`.
   - Błąd walidacji -> `400 VALIDATION_ERROR`.
   - Pozostałe błędy -> `500 INTERNAL_ERROR`.
   - Użyć istniejących helperów `createErrorHttpResponse`, `createValidationErrorResponse`, `logError`.

5. **Spójność kontraktu API**
   - Zweryfikować, że odpowiedź odpowiada `NeedDetailDTO` z `src/types.ts`.
   - Potwierdzić, że `shelter` zawiera dokładnie: `id`, `name`, `city`, `phone_number`.

6. **Testy manualne / integracyjne (minimum)**
   - `GET /api/needs/{valid-id}` dla istniejącej potrzeby -> `200`.
   - `GET /api/needs/{invalid-uuid}` -> `400`.
   - `GET /api/needs/{non-existing-id}` -> `404`.
   - `GET /api/needs/{soft-deleted-id}` -> `404`.
   - symulacja błędu DB (np. brak klienta w locals) -> `500`.

7. **Jakość i lint**
   - Uruchomić lint/typowanie dla zmienionych plików.
   - Upewnić się, że implementacja pozostaje zgodna z zasadami Astro + backend (`locals.supabase`, Zod, service layer).

8. **Definition of Done (DoD)**
   - Endpoint dostępny pod `GET /api/needs/:id`.
   - Wszystkie scenariusze statusów (`200`, `400`, `404`, `500`) działają zgodnie z kontraktem.
   - Brak regresji dla istniejącego `GET /api/needs`.
   - Kod i struktura plików zgodne z regułami projektu.