# API Endpoint Implementation Plan: PATCH /api/needs/:id

## 1. Przegląd punktu końcowego

Endpoint `PATCH /api/needs/:id` umożliwia właścicielowi schroniska częściową aktualizację istniejącej potrzeby. Aktualizować można pola: `title`, `description`, `shopping_url`, `urgency`, `current_quantity`, `target_quantity`, `category` i `unit`. Endpoint wymaga uwierzytelnienia i autoryzacji — tylko właściciel (shelter, którego `id` zgadza się z `shelter_id` potrzeby) ze statusem `verified` może wykonać operację. Potrzeby usunięte miękko (soft-deleted) oraz nieistniejące traktowane są jako 404.

## 2. Szczegóły żądania

- **Metoda HTTP:** PATCH
- **Struktura URL:** `/api/needs/:id`
- **Parametry ścieżki:**
  - `id` (wymagany) — UUID potrzeby do zaktualizowania
- **Nagłówki:**
  - `Authorization: Bearer {access_token}` (wymagany)
  - `Content-Type: application/json`
- **Request Body (wszystkie pola opcjonalne, minimum jedno wymagane):**

| Pole               | Typ              | Opis                                                 |
| :----------------- | :--------------- | :--------------------------------------------------- |
| `title`            | `string`         | Tytuł potrzeby (3–255 znaków)                        |
| `description`      | `string \| null` | Opis potrzeby (maks. 2000 znaków, null = usunięcie)  |
| `shopping_url`     | `string \| null` | Link zakupowy (poprawny URL, null = usunięcie)       |
| `urgency`          | `UrgencyLevel`   | Poziom pilności: low, normal, high, urgent, critical |
| `current_quantity` | `number`         | Aktualna zebrana ilość (≥ 0, ≤ target_quantity)      |
| `target_quantity`  | `number`         | Docelowa ilość (> 0)                                 |
| `category`         | `NeedCategory`   | Kategoria potrzeby                                   |
| `unit`             | `NeedUnit`       | Jednostka miary                                      |

## 3. Wykorzystywane typy

### Istniejące typy (z `src/types.ts`)

- **`UpdateNeedCommand`** — Command Model opisujący dozwolone pola aktualizacji. Wszystkie pola opcjonalne.
- **`NeedUpdateResponseDTO`** — DTO odpowiedzi zawierający: `id`, `title`, `description`, `urgency`, `current_quantity`, `progress_percentage`, `updated_at`.

### Nowy schemat walidacji (do dodania w `src/lib/validation/needs.schemas.ts`)

- **`UpdateNeedSchema`** — schemat Zod do walidacji body żądania PATCH. Cechy:
  - Wszystkie pola opcjonalne (`.optional()`)
  - `description` i `shopping_url` akceptują `null` (czyszczenie wartości)
  - Schemat musi wymagać co najmniej jednego pola (`.refine()` — nie pusty obiekt)
  - `current_quantity` — `number`, ≥ 0, maks. 99999999.99, maks. 2 miejsca po przecinku
  - `target_quantity` — `number`, > 0, maks. 99999999.99, maks. 2 miejsca po przecinku
  - `title` — `.trim()`, min 3, maks. 255 znaków
  - `description` — maks. 2000 znaków, nullable
  - `shopping_url` — `.url()`, nullable
  - `urgency` — enum `['low','normal','high','urgent','critical']`
  - `category` — enum `['food','textiles','cleaning','medical','toys','other']`
  - `unit` — enum `['pcs','kg','g','l','ml','pack']`
  - Konieczna walidacja cross-field: jeśli podano jednocześnie `current_quantity` i `target_quantity`, to `current_quantity ≤ target_quantity`. Jeśli podano tylko `current_quantity`, walidacja cross-field z `target_quantity` z bazy danych odbywa się w warstwie serwisowej.

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)

```json
{
  "id": "uuid",
  "title": "Updated title",
  "description": "Updated description",
  "urgency": "high",
  "current_quantity": 25.0,
  "progress_percentage": 50,
  "updated_at": "2026-01-21T11:00:00Z"
}
```

### Odpowiedzi błędów

| Kod HTTP | ErrorCode          | Opis                                                                |
| :------- | :----------------- | :------------------------------------------------------------------ |
| 400      | `VALIDATION_ERROR` | Nieprawidłowe dane (puste body, nieprawidłowy format, złe typy)     |
| 400      | `INVALID_REQUEST`  | Body nie jest poprawnym JSON-em                                     |
| 400      | `VALIDATION_ERROR` | `current_quantity > target_quantity` (po uwzględnieniu wartości DB) |
| 401      | `UNAUTHORIZED`     | Brak lub nieważny token uwierzytelniający                           |
| 403      | `FORBIDDEN`        | Użytkownik nie jest właścicielem potrzeby                           |
| 403      | `ACCOUNT_PENDING`  | Konto schroniska oczekuje na weryfikację                            |
| 403      | `FORBIDDEN`        | Konto nie ma statusu `verified`                                     |
| 404      | `NOT_FOUND`        | Potrzeba nie istnieje lub jest usunięta (soft-deleted)              |
| 500      | `INTERNAL_ERROR`   | Nieoczekiwany błąd serwera / bazy danych                            |

## 5. Przepływ danych

```
Klient → [PATCH /api/needs/:id]
  │
  ├─ 1. Walidacja parametru ścieżki (NeedIdParamsSchema)
  │     └─ Błąd → 400 VALIDATION_ERROR
  │
  ├─ 2. Sprawdzenie klienta Supabase (locals.supabase)
  │     └─ Brak → 500 INTERNAL_ERROR
  │
  ├─ 3. Uwierzytelnienie (supabase.auth.getUser())
  │     └─ Błąd/brak usera → 401 UNAUTHORIZED
  │
  ├─ 4. Pobranie profilu schroniska z DB
  │     ├─ Profil nie istnieje → 404 NOT_FOUND
  │     ├─ Rola ≠ 'shelter' → 403 FORBIDDEN
  │     ├─ Status = 'pending' → 403 ACCOUNT_PENDING
  │     └─ Status ≠ 'verified' → 403 FORBIDDEN
  │
  ├─ 5. Parsowanie i walidacja body żądania (UpdateNeedSchema)
  │     └─ Błąd → 400 VALIDATION_ERROR / INVALID_REQUEST
  │
  ├─ 6. Delegacja do NeedsService.updateNeed(needId, userId, command)
  │     │
  │     ├─ 6a. Pobranie potrzeby z DB (SELECT z filtrami: id, deleted_at IS NULL)
  │     │     ├─ Nie znaleziono → NotFoundError → 404
  │     │     └─ shelter_id ≠ userId → ForbiddenError → 403
  │     │
  │     ├─ 6b. Walidacja cross-field: current_quantity ≤ target_quantity
  │     │     (uwzględnia wartości z DB, gdy nie podano obu pól w body)
  │     │     └─ Naruszenie → ValidationError → 400
  │     │
  │     ├─ 6c. UPDATE w DB + SELECT zaktualizowanego rekordu
  │     │     └─ Błąd DB → InternalError → 500
  │     │
  │     └─ 6d. Obliczenie progress_percentage i zwrot NeedUpdateResponseDTO
  │
  └─ 7. Zwrot odpowiedzi 200 OK z NeedUpdateResponseDTO
```

## 6. Względy bezpieczeństwa

1. **Uwierzytelnienie** — Endpoint wymaga poprawnego tokena Bearer. Middleware Supabase tworzy klienta z nagłówkiem Authorization; `getUser()` weryfikuje token po stronie serwera.

2. **Autoryzacja właściciela** — Porównanie `user.id` z `shelter_id` potrzeby w warstwie serwisowej. Użytkownik może edytować tylko własne potrzeby.

3. **Weryfikacja statusu konta** — Tylko schroniska ze statusem `verified` mogą aktualizować potrzeby. Konta pending/suspended/rejected otrzymują 403.

4. **Zabezpieczenie ról** — Tylko użytkownicy z rolą `shelter` mogą korzystać z endpointu. Konta `super_admin` otrzymują 403.

5. **Ochrona pól nieedytowalnych** — Schemat Zod przepuszcza tylko dozwolone pola (`title`, `description`, `shopping_url`, `urgency`, `current_quantity`, `target_quantity`, `category`, `unit`). Pole `shelter_id`, `id`, `is_fulfilled`, `created_at` są ignorowane/odrzucane dzięki `.strict()` lub stripowaniu.

6. **Walidacja danych wejściowych** — Zod chroni przed injection i nieprawidłowymi typami. `shopping_url` walidowany jako poprawny URL.

7. **Soft-deleted needs** — Zapytanie filtrowane przez `deleted_at IS NULL`, uniemożliwiając edycję usuniętych rekordów.

## 7. Obsługa błędów

### Warstwa routingu (`src/pages/api/needs/[id]/index.ts`)

| Scenariusz                           | Error Class       | HTTP Status | ErrorCode          |
| :----------------------------------- | :---------------- | :---------- | :----------------- |
| Nieprawidłowe UUID w URL             | —                 | 400         | `VALIDATION_ERROR` |
| Brak klienta Supabase                | —                 | 500         | `INTERNAL_ERROR`   |
| Brak/nieważny token                  | —                 | 401         | `UNAUTHORIZED`     |
| Profil nie znaleziony                | —                 | 404         | `NOT_FOUND`        |
| Rola ≠ shelter                       | —                 | 403         | `FORBIDDEN`        |
| Status = pending                     | —                 | 403         | `ACCOUNT_PENDING`  |
| Status ≠ verified                    | —                 | 403         | `FORBIDDEN`        |
| Body nie jest JSON-em                | —                 | 400         | `INVALID_REQUEST`  |
| Walidacja body Zod failed            | —                 | 400         | `VALIDATION_ERROR` |
| Potrzeba nie istnieje / soft-deleted | `NotFoundError`   | 404         | `NOT_FOUND`        |
| Nie jest właścicielem                | `ForbiddenError`  | 403         | `FORBIDDEN`        |
| current_quantity > target_quantity   | `ValidationError` | 400         | `VALIDATION_ERROR` |
| Błąd bazy danych                     | `InternalError`   | 500         | `INTERNAL_ERROR`   |
| Nieoczekiwany wyjątek                | `Error`           | 500         | `INTERNAL_ERROR`   |

### Logowanie błędów

- Błędy DB: `logErrorWithContext()` z kontekstem `endpoint`, `user_id`, `shelter_id`, `request_body` (bez wrażliwych danych).
- Nieoczekiwane wyjątki: `logError()` z kontekstem trasy.
- Sukces: `logSuccess()` z `need_id`, `user_id`.

## 8. Rozważania dotyczące wydajności

1. **Minimalne zapytania DB** — Dwie operacje: SELECT (pobranie potrzeby + weryfikacja własności) oraz UPDATE + SELECT (aktualizacja i pobranie wyniku). Profil schroniska pobierany osobno w warstwie routingu (jedno zapytanie).

2. **Brak zbędnych joinów** — W odróżnieniu od GET, UPDATE nie wymaga joinowania z `profiles` — informacja o shelter jest znaną w momencie zapytania UPDATE.

3. **Indeksy** — Zapytanie SELECT na potrzebę korzysta z PK (`id`) — O(1). Indeks na `shelter_id` wspomaga ewentualne przyszłe zapytania.

4. **Rozmiar odpowiedzi** — DTO zawiera minimalny zestaw pól (7 pól), minimalizując transfer.

5. **Brak rate limitingu** — Operacja PATCH nie jest tak wrażliwa jak POST (nie tworzy nowych zasobów). Opcjonalnie można dodać w przyszłości.

## 9. Etapy wdrożenia

### Krok 1: Schemat walidacji — `UpdateNeedSchema`

**Plik:** `src/lib/validation/needs.schemas.ts`

Dodać nowy schemat Zod `UpdateNeedSchema`:

```typescript
export const UpdateNeedSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Title must be at least 3 characters")
      .max(255, "Title must not exceed 255 characters")
      .optional(),
    description: z.string().max(2000, "Description must not exceed 2000 characters").nullable().optional(),
    shopping_url: z.string().url("Invalid URL format for shopping_url").nullable().optional(),
    urgency: z.enum(["low", "normal", "high", "urgent", "critical"] as const).optional(),
    current_quantity: z
      .number({ invalid_type_error: "current_quantity must be a number" })
      .min(0, "current_quantity must be non-negative")
      .max(99999999.99, "current_quantity is too large")
      .optional(),
    target_quantity: z
      .number({ invalid_type_error: "target_quantity must be a number" })
      .positive("target_quantity must be greater than 0")
      .max(99999999.99, "target_quantity is too large")
      .optional(),
    category: z.enum(["food", "textiles", "cleaning", "medical", "toys", "other"] as const).optional(),
    unit: z.enum(["pcs", "kg", "g", "l", "ml", "pack"] as const).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: "Request body must contain at least one field to update" })
  .refine(
    (data) => {
      if (data.current_quantity !== undefined && data.target_quantity !== undefined) {
        return data.current_quantity <= data.target_quantity;
      }
      return true;
    },
    {
      message: "current_quantity cannot exceed target_quantity",
      path: ["current_quantity"],
    }
  );
```

Wyeksportować typy `UpdateNeedInput` i `UpdateNeedOutput`.

### Krok 2: Metoda serwisowa — `NeedsService.updateNeed()`

**Plik:** `src/lib/services/needs.service.ts`

Dodać import `ValidationError` z `@/lib/errors` i typ `NeedUpdateResponseDTO`, `UpdateNeedCommand` z `@/types`.

Zaimplementować metodę:

```typescript
async updateNeed(
  needId: string,
  userId: string,
  command: UpdateNeedCommand
): Promise<NeedUpdateResponseDTO>
```

**Logika metody:**

1. **Pobranie potrzeby** — SELECT `id`, `shelter_id`, `target_quantity`, `current_quantity` WHERE `id = needId` AND `deleted_at IS NULL`. Użyj `.maybeSingle()`.
   - Brak wyniku → rzuć `NotFoundError("Need not found")`
   - Błąd DB → rzuć `InternalError("Unable to retrieve need")`

2. **Autoryzacja** — Porównaj `need.shelter_id !== userId` → rzuć `ForbiddenError("You are not the owner of this need")`

3. **Walidacja cross-field (current_quantity ≤ target_quantity)**:
   - Ustal efektywne wartości: `effectiveTarget = command.target_quantity ?? need.target_quantity` i `effectiveCurrent = command.current_quantity ?? need.current_quantity`.
   - Jeśli `effectiveCurrent > effectiveTarget` → rzuć `ValidationError("current_quantity cannot exceed target_quantity")`

4. **Budowanie obiektu aktualizacji** — Utwórz obiekt tylko z polami, które zostały podane w `command` (nie undefined). Nie uwzględniaj pól undefined.

5. **UPDATE w DB** — `.update(updateFields).eq("id", needId).select("id, title, description, urgency, target_quantity, current_quantity, updated_at").single()`
   - Błąd → rzuć `InternalError("Unable to update need")`

6. **Obliczenie `progress_percentage`** — `Math.round((updated.current_quantity / updated.target_quantity) * 100)`, z zabezpieczeniem dzielenia przez zero.

7. **Zwrot DTO** — `NeedUpdateResponseDTO`

### Krok 3: Handler trasy — `PATCH` w `src/pages/api/needs/[id]/index.ts`

**Plik:** `src/pages/api/needs/[id]/index.ts`

Dodać handler `PATCH` obok istniejącego `GET`. Wzorować się na `POST /api/needs` (uwierzytelnienie + weryfikacja profilu) i `POST /api/needs/:id/fulfill` (pattern delegacji do serwisu).

**Przepływ handlera:**

1. Walidacja parametru ścieżki — `NeedIdParamsSchema.safeParse({ id: params.id })`
2. Sprawdzenie `locals.supabase`
3. Uwierzytelnienie — `supabase.auth.getUser()`
4. Pobranie profilu — `supabase.from("profiles").select("id, status, role").eq("id", user.id).maybeSingle()`
   - Weryfikacja roli (`shelter`) i statusu (`verified`, z obsługą `pending`)
5. Parsowanie JSON body — `request.json()` w try/catch
6. Walidacja body — `UpdateNeedSchema.safeParse(rawBody)`
7. Delegacja — `needsService.updateNeed(id, user.id, command)`
8. `logSuccess("PATCH /api/needs/:id", { need_id, user_id })`
9. Zwrot 200 OK z `NeedUpdateResponseDTO`
10. Obsługa wyjątków — mapowanie `NotFoundError → 404`, `ForbiddenError → 403`, `ValidationError → 400`, `InternalError → 500`, catch-all → 500

### Krok 4: Testy jednostkowe — schemat walidacji

**Plik:** `src/lib/validation/needs.schemas.test.ts`

Dodać sekcję testów dla `UpdateNeedSchema`:

1. **Akceptacja poprawnych danych:**
   - Jedno pole (`{ title: "New title" }`)
   - Wiele pól jednocześnie
   - `description: null` i `shopping_url: null` (czyszczenie)
   - Wszystkie pola enumeracji walidowane poprawnie

2. **Odrzucenie nieprawidłowych danych:**
   - Puste body `{}`
   - `title` za krótki (< 3 znaków) i za długi (> 255 znaków)
   - `description` za długi (> 2000 znaków)
   - `shopping_url` z nieprawidłowym URL
   - `urgency` z niedozwoloną wartością
   - `current_quantity` ujemne
   - `target_quantity` ≤ 0
   - `current_quantity > target_quantity` (oba podane w body)
   - Nieznane pola (`.strict()` odrzuca)

### Krok 5: Testy jednostkowe — metoda serwisowa

**Plik:** `src/lib/services/needs.service.test.ts`

Dodać sekcję `describe("updateNeed")`:

1. **Sukces** — poprawna aktualizacja zwraca `NeedUpdateResponseDTO` z obliczonym `progress_percentage`
2. **NotFoundError** — potrzeba nie istnieje (maybeSingle zwraca null)
3. **ForbiddenError** — `shelter_id ≠ userId`
4. **ValidationError** — `current_quantity > target_quantity` (z wartością docelową z DB)
5. **InternalError** — błąd SELECT
6. **InternalError** — błąd UPDATE
7. **Obliczenie progress_percentage** — edge case: target_quantity = 0 (guard clause), 100% progress

### Krok 6: Testy jednostkowe — handler trasy PATCH

**Plik:** `src/pages/api/needs/[id]/index.test.ts` (nowy plik lub dodanie do istniejącego)

Zastosować wzorzec z `fulfill.test.ts` (dynamiczny import z `vi.doMock`):

1. **400** — nieprawidłowe UUID w URL
2. **500** — brak `locals.supabase`
3. **401** — brak/nieważny token
4. **404** — profil nie istnieje
5. **403** — rola ≠ shelter
6. **403** — status = pending (ACCOUNT_PENDING)
7. **403** — status ≠ verified
8. **400** — body nie jest JSON
9. **400** — puste body `{}`
10. **400** — nieprawidłowe dane (walidacja Zod)
11. **200** — sukces z poprawnymi danymi
12. **404** — serwis rzuca `NotFoundError`
13. **403** — serwis rzuca `ForbiddenError`
14. **400** — serwis rzuca `ValidationError`
15. **500** — serwis rzuca `InternalError`
16. **500** — serwis rzuca nieoczekiwany `Error`
