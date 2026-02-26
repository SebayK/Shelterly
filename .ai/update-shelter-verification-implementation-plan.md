# API Endpoint Implementation Plan: PATCH /api/admin/shelters/:id/status

## 1. Przegląd punktu końcowego

Endpoint umożliwia super administratorowi aktualizację statusu weryfikacji schroniska. Służy do zatwierdzania (`verified`), odrzucania (`rejected`) lub zawieszania (`suspended`) kont schronisk w procesie weryfikacji. Operacja wykonywana jest na tabeli `profiles` — pole `status` (typ `shelter_status`). Endpoint wymaga uwierzytelnienia oraz roli `super_admin`.

## 2. Szczegóły żądania

- **Metoda HTTP:** PATCH
- **Struktura URL:** `/api/admin/shelters/:id/status`
- **Parametry ścieżki:**
  - `id` (wymagany) — UUID schroniska (profilu), którego status jest aktualizowany
- **Nagłówki:**
  - `Authorization: Bearer {access_token}` (wymagany)
- **Request Body (JSON):**
  - `status` (wymagany) — nowy status schroniska; dozwolone wartości: `"verified"`, `"rejected"`, `"suspended"`
  - `rejection_reason` (opcjonalny, `string | null`) — powód odrzucenia; wymagany gdy `status === "rejected"`, ignorowany/null dla innych statusów

### Walidacja danych wejściowych

| Pole               | Typ              | Wymagane | Walidacja                                                                                                                                   |
| :----------------- | :--------------- | :------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| `id` (path param)  | `string` (UUID)  | Tak      | Musi być poprawny format UUID v4                                                                                                            |
| `status`           | `string` (enum)  | Tak      | Dozwolone: `"verified"`, `"rejected"`, `"suspended"`. Wartość `"pending"` **nie jest dozwolona** — admin nie może cofnąć statusu do pending |
| `rejection_reason` | `string \| null` | Nie      | Wymagany gdy `status === "rejected"` (min 3 znaki, max 500 znaków). Musi być `null` lub nieobecny dla innych statusów                       |

## 3. Wykorzystywane typy

### Istniejące typy z `src/types.ts`

- **`ShelterStatusUpdateResponseDTO`** (DTO 8) — odpowiedź endpointu:
  ```typescript
  interface ShelterStatusUpdateResponseDTO {
    id: string;
    status: ShelterStatus;
    updated_at: string;
  }
  ```
- **`UpdateShelterStatusCommand`** (Command 7) — model żądania:
  ```typescript
  interface UpdateShelterStatusCommand {
    status: ShelterStatus;
    rejection_reason?: string | null;
  }
  ```
- **`ShelterStatus`** — enum: `"pending" | "verified" | "suspended" | "rejected"`
- **`ErrorResponse`**, **`ErrorDetail`**, **`ErrorCode`** — typy błędów

### Nowe artefakty do stworzenia

- **`UpdateShelterStatusSchema`** — schemat walidacji Zod w `src/lib/validation/admin.schemas.ts`
- **`ShelterIdParamSchema`** — schemat walidacji parametru ścieżki `:id` (UUID) w `src/lib/validation/admin.schemas.ts`

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)

```json
{
  "id": "uuid",
  "status": "verified",
  "updated_at": "2026-01-21T12:00:00Z"
}
```

Nagłówki: `Content-Type: application/json`, `Cache-Control: no-store`

### Odpowiedzi błędów

| Kod HTTP | Kod błędu          | Opis                                                                                            |
| :------- | :----------------- | :---------------------------------------------------------------------------------------------- |
| 400      | `VALIDATION_ERROR` | Nieprawidłowy format UUID, niepoprawna wartość statusu, brak `rejection_reason` przy `rejected` |
| 401      | `UNAUTHORIZED`     | Brak lub niepoprawny token uwierzytelnienia                                                     |
| 403      | `FORBIDDEN`        | Użytkownik nie ma roli `super_admin`                                                            |
| 404      | `NOT_FOUND`        | Schronisko o podanym ID nie istnieje                                                            |
| 500      | `INTERNAL_ERROR`   | Błąd bazy danych lub nieoczekiwany wyjątek                                                      |

## 5. Przepływ danych

```
Klient → [PATCH /api/admin/shelters/:id/status]
  │
  ├─ 1. Walidacja parametru ścieżki (:id) → ShelterIdParamSchema
  │     └─ 400 jeśli nie UUID
  │
  ├─ 2. Parsowanie i walidacja body → UpdateShelterStatusSchema
  │     └─ 400 jeśli nieprawidłowe dane
  │
  ├─ 3. Weryfikacja supabase client (locals.supabase)
  │     └─ 500 jeśli niedostępny
  │
  ├─ 4. Uwierzytelnienie (supabase.auth.getUser())
  │     └─ 401 jeśli brak sesji / błąd auth
  │
  ├─ 5. Autoryzacja — pobranie profilu użytkownika, sprawdzenie role === 'super_admin'
  │     └─ 403 jeśli nie admin
  │
  ├─ 6. Delegacja do AdminService.updateShelterStatus(id, command)
  │     ├─ Sprawdzenie czy schronisko istnieje (SELECT z profiles WHERE id = :id AND role = 'shelter')
  │     │   └─ NotFoundError → 404
  │     ├─ UPDATE profiles SET status, updated_at WHERE id = :id
  │     │   └─ InternalError → 500
  │     └─ Zwrócenie ShelterStatusUpdateResponseDTO
  │
  └─ 7. Odpowiedź 200 z JSON DTO
```

### Interakcje z bazą danych (w ramach AdminService)

1. **SELECT** — pobranie profilu schroniska po `id`, sprawdzenie czy istnieje i ma `role = 'shelter'`
2. **UPDATE** — aktualizacja `status` i `updated_at` (na `now()`) w tabeli `profiles`
3. **SELECT (po update)** — odczyt zaktualizowanych pól przez `.select()` w ramach chain query Supabase

## 6. Względy bezpieczeństwa

1. **Uwierzytelnienie** — weryfikacja tokena przez `supabase.auth.getUser()`. Brak poprawnej sesji → 401.
2. **Autoryzacja** — dodatkowe sprawdzenie roli użytkownika z tabeli `profiles`. Tylko `super_admin` ma dostęp → 403.
3. **Walidacja wejścia** — wszystkie dane wejściowe walidowane przez Zod (UUID, enum, warunki warunkowe) przed operacjami na bazie.
4. **Ochrona przed eskalacją** — admin nie może ustawić statusu na `"pending"` (cofnięcie weryfikacji); dozwolone tylko: `verified`, `rejected`, `suspended`.
5. **Brak cachowania** — odpowiedź ma header `Cache-Control: no-store` ze względu na wrażliwy, dynamiczny charakter danych.
6. **Logowanie** — błędy logowane z kontekstem (endpoint, user_id, shelter_id), bez danych wrażliwych.
7. **Brak wycieków informacji** — odpowiedzi błędów nie ujawniają szczegółów wewnętrznych (np. nazw tabel, stack trace).

## 7. Obsługa błędów

### Scenariusze błędów i mapowanie na kody HTTP

| Scenariusz                                     | Wyjątek serwisu | HTTP | Kod błędu          | Komunikat                                              |
| :--------------------------------------------- | :-------------- | :--- | :----------------- | :----------------------------------------------------- |
| Niepoprawny UUID w ścieżce                     | —               | 400  | `VALIDATION_ERROR` | "Invalid shelter ID format"                            |
| Brak pola `status` w body                      | —               | 400  | `VALIDATION_ERROR` | "Status is required"                                   |
| Niedozwolona wartość `status`                  | —               | 400  | `VALIDATION_ERROR` | "Status must be one of: verified, rejected, suspended" |
| `status === 'rejected'` bez `rejection_reason` | —               | 400  | `VALIDATION_ERROR` | "Rejection reason is required when status is rejected" |
| `rejection_reason` zbyt krótki/długi           | —               | 400  | `VALIDATION_ERROR` | Wiadomość walidacji Zod                                |
| Brak tokena / niepoprawna sesja                | —               | 401  | `UNAUTHORIZED`     | "Authentication required"                              |
| Użytkownik nie jest super_admin                | —               | 403  | `FORBIDDEN`        | "Access restricted to super administrators"            |
| Profil użytkownika nie znaleziony              | —               | 403  | `FORBIDDEN`        | "Access restricted to super administrators"            |
| Schronisko o podanym ID nie istnieje           | `NotFoundError` | 404  | `NOT_FOUND`        | "Shelter not found"                                    |
| Błąd bazy danych (SELECT/UPDATE)               | `InternalError` | 500  | `INTERNAL_ERROR`   | "An unexpected error occurred..."                      |
| Nieoczekiwany wyjątek                          | `Error`         | 500  | `INTERNAL_ERROR`   | "An unexpected error occurred..."                      |

### Logowanie błędów

- Błędy bazy danych logowane przez `logErrorWithContext()` ze strukturą: `endpoint`, `user_id`, `shelter_id`
- Nieoczekiwane wyjątki logowane przez `logError()` z kontekstem endpointu
- Sukces operacji logowany przez `logSuccess()` z metadata: `shelter_id`, `new_status`

## 8. Rozważania dotyczące wydajności

1. **Minimalna liczba zapytań do bazy** — dwa zapytania w service: (a) sprawdzenie istnienia schroniska, (b) aktualizacja statusu. Ewentualnie można zredukować do jednego zapytania UPDATE z `.select()` i sprawdzeniem czy `data` jest null (brak wiersza = 404).
2. **Indeks na `profiles.status`** — istniejący indeks BTREE przyspiesza filtrowanie.
3. **Brak cache** — dane admin są wrażliwe i rzadko odczytywane, brak potrzeby cachowania.
4. **Brak N+1** — endpoint operuje na pojedynczym rekordzie.

## 9. Etapy wdrożenia

### Krok 1: Schemat walidacji Zod (`src/lib/validation/admin.schemas.ts`)

Rozszerzenie istniejącego pliku o dwa nowe schematy:

```typescript
// Schemat walidacji parametru ścieżki :id
export const ShelterIdParamSchema = z.object({
  id: z.string().uuid("Invalid shelter ID format"),
});

// Schemat walidacji body PATCH /api/admin/shelters/:id/status
export const UpdateShelterStatusSchema = z
  .object({
    status: z.enum(["verified", "rejected", "suspended"], {
      required_error: "Status is required",
      invalid_type_error: "Status must be a string",
    }),
    rejection_reason: z
      .string()
      .min(3, "Rejection reason must be at least 3 characters")
      .max(500, "Rejection reason must not exceed 500 characters")
      .nullable()
      .optional()
      .transform((val) => val ?? null),
  })
  .superRefine((data, ctx) => {
    if (data.status === "rejected" && (!data.rejection_reason || data.rejection_reason === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Rejection reason is required when status is rejected",
        path: ["rejection_reason"],
      });
    }
  });
```

Eksportować również typy: `ShelterIdParamOutput`, `UpdateShelterStatusOutput`.

### Krok 2: Metoda serwisu (`src/lib/services/admin.service.ts`)

Dodanie nowej metody `updateShelterStatus` do klasy `AdminService`:

```typescript
async updateShelterStatus(
  shelterId: string,
  command: UpdateShelterStatusCommand
): Promise<ShelterStatusUpdateResponseDTO>
```

Logika:

1. Sprawdzenie czy profil o danym `id` istnieje i ma `role = 'shelter'` (query: `SELECT id FROM profiles WHERE id = :id AND role = 'shelter'`)
2. Jeśli nie znaleziono — rzucenie `NotFoundError("Shelter not found")`
3. Wykonanie `UPDATE profiles SET status = :status, updated_at = now() WHERE id = :id` z `.select("id, status, updated_at")` i `.single()`
4. Jeśli błąd — rzucenie `InternalError` z kontekstem logowania
5. Zwrócenie `ShelterStatusUpdateResponseDTO`

Uwaga: pole `rejection_reason` nie istnieje w tabeli `profiles` w bieżącym schemacie bazy danych. Wartość ta nie jest zapisywana — jest to informacja przesyłana w request body, ale nie jest persistowana. Jeśli w przyszłości zajdzie potrzeba zapisania powodu odrzucenia, wymagana będzie migracja bazy danych. Na potrzeby MVP, parametr `rejection_reason` jest walidowany, ale nie jest przechowywany w bazie.

### Krok 3: Route handler — plik strony (`src/pages/api/admin/shelters/[id]/status.ts`)

Utworzenie nowego pliku z eksportem `PATCH: APIRoute`:

1. `export const prerender = false`
2. Walidacja paramu `:id` przez `ShelterIdParamSchema`
3. Parsowanie body `await request.json()` z obsługą błędu parsowania JSON
4. Walidacja body przez `UpdateShelterStatusSchema`
5. Sprawdzenie `locals.supabase`
6. Uwierzytelnienie: `supabase.auth.getUser()`
7. Autoryzacja: pobranie profilu użytkownika, sprawdzenie `role === 'super_admin'`
8. Delegacja do `AdminService.updateShelterStatus(id, command)`
9. Mapowanie wyjątków:
   - `NotFoundError` → 404
   - `ForbiddenError` → 403
   - `InternalError` → 500
   - Catch-all → 500
10. Odpowiedź 200 z DTO + `Cache-Control: no-store`

### Krok 4: Testy jednostkowe serwisu (`src/lib/services/admin.service.test.ts`)

Dodanie nowej sekcji `describe("AdminService.updateShelterStatus()")`:

**Scenariusze testowe:**

- Pomyślna aktualizacja statusu na `verified` — zwraca poprawne DTO
- Pomyślna aktualizacja statusu na `rejected` — zwraca poprawne DTO
- Pomyślna aktualizacja statusu na `suspended` — zwraca poprawne DTO
- Rzuca `NotFoundError` gdy schronisko nie istnieje
- Rzuca `NotFoundError` gdy profil ma rolę `super_admin` (nie jest schroniskiem)
- Rzuca `InternalError` przy błędzie SELECT
- Rzuca `InternalError` przy błędzie UPDATE
- Poprawnie wywołuje zapytania Supabase z prawidłowymi parametrami

### Krok 5: Testy integracyjne route'a (`src/pages/api/admin/shelters/[id]/status.test.ts`)

Testy analogiczne do wzorca z `pending.test.ts`:

**Scenariusze testowe:**

- 200 — pomyślna aktualizacja z poprawnym body DTO
- 400 — nieprawidłowy UUID w ścieżce
- 400 — brak `status` w body
- 400 — niedozwolona wartość `status` (np. `"pending"`)
- 400 — `status === "rejected"` bez `rejection_reason`
- 400 — nieprawidłowy JSON w body
- 401 — brak uwierzytelnienia
- 403 — użytkownik z rolą `shelter` (nie admin)
- 403 — profil nie znaleziony
- 404 — schronisko nie istnieje (service rzuca `NotFoundError`)
- 500 — błąd serwisu (`InternalError`)
- Sprawdzenie nagłówka `Cache-Control: no-store`

### Krok 6: Walidacja końcowa

1. Uruchomienie pełnego zestawu testów: `npx vitest run`
2. Sprawdzenie linterem: `npx eslint src/pages/api/admin/shelters/[id]/status.ts src/lib/services/admin.service.ts src/lib/validation/admin.schemas.ts`
3. Weryfikacja typów: `npx tsc --noEmit`
4. Przegląd kodu pod kątem spójności z istniejącymi wzorcami (pending.ts, needs/[id].ts)
