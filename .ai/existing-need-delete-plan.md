# API Endpoint Implementation Plan: DELETE /api/needs/:id

<analysis>

## Kluczowe punkty specyfikacji

- **Metoda:** DELETE
- **Ścieżka:** `/api/needs/:id`
- **Cel:** Soft delete potrzeby (ustawienie `deleted_at` zamiast usunięcia rekordu z bazy)
- **Autoryzacja:** Tylko właściciel potrzeby (shelter, który ją utworzył) może ją usunąć
- **Odpowiedź sukcesu:** `200 OK` z `{ message, deleted_at }`

## Parametry

- **Wymagane:** `id` (UUID) — parametr ścieżki
- **Opcjonalne:** brak
- **Request body:** brak (metoda DELETE)

## Typy DTO i Command Modele

- **NeedDeleteResponseDTO** — już zdefiniowany w `src/types.ts`: `{ message: string; deleted_at: string }`
- Brak Command Model — endpoint nie przyjmuje body

## Warstwa serwisowa

- Metoda `deleteNeed(needId: string, userId: string): Promise<NeedDeleteResponseDTO>` — **nowa** w istniejącej klasie `NeedsService`
- Wzorzec analogiczny do `fulfillNeed`:
  1. Pobranie potrzeby (z wykluczeniem soft-deleted)
  2. Weryfikacja istnienia
  3. Weryfikacja własności (`shelter_id === userId`)
  4. Update `deleted_at = now()`
  5. Zwrócenie DTO

## Walidacja danych wejściowych

- `id` — walidacja UUID za pomocą istniejącego `NeedIdParamsSchema`
- Brak body — nie wymaga walidacji Zod

## Obsługa błędów

| Scenariusz | Error class | HTTP status | Error code |
|---|---|---|---|
| Niepoprawny UUID | — (Zod) | 400 | VALIDATION_ERROR |
| Brak tokenu / niepoprawny | — | 401 | UNAUTHORIZED |
| Użytkownik nie jest właścicielem | ForbiddenError | 403 | FORBIDDEN |
| Potrzeba nie istnieje / już usunięta | NotFoundError | 404 | NOT_FOUND |
| Błąd bazy danych | InternalError | 500 | INTERNAL_ERROR |
| Nieoczekiwany błąd | — | 500 | INTERNAL_ERROR |

## Zagrożenia bezpieczeństwa

- **IDOR** — ktoś mógłby podać UUID cudzej potrzeby → ochrona przez sprawdzenie `shelter_id`
- **Brak autentykacji** — endpoint wymaga Bearer tokenu
- **Podwójne usunięcie** — próba usunięcia już soft-deleted → traktowane jako 404

</analysis>

## 1. Przegląd punktu końcowego

Endpoint `DELETE /api/needs/:id` realizuje **miękkie usunięcie** (soft delete) potrzeby schroniska. Zamiast fizycznego usuwania rekordu z tabeli `needs`, ustawiana jest kolumna `deleted_at` na aktualny timestamp. Operacja jest dostępna wyłącznie dla uwierzytelnionego właściciela potrzeby (shelter, którego `id` odpowiada `shelter_id` potrzeby).

## 2. Szczegóły żądania

- **Metoda HTTP:** `DELETE`
- **Struktura URL:** `/api/needs/:id`
- **Parametry:**
  - **Wymagane:** `id` (UUID) — identyfikator potrzeby w ścieżce URL
  - **Opcjonalne:** brak
- **Headers:**
  - `Authorization: Bearer {access_token}` — wymagany
- **Request Body:** brak

## 3. Wykorzystywane typy

### Istniejące typy (nie wymagają zmian)

- **`NeedDeleteResponseDTO`** (`src/types.ts`) — odpowiedź sukcesu:
  ```typescript
  interface NeedDeleteResponseDTO {
    message: string;
    deleted_at: string;
  }
  ```
- **`NeedIdParamsSchema`** (`src/lib/validation/needs.schemas.ts`) — walidacja parametru ścieżki UUID
- Klasy błędów z `src/lib/errors.ts`: `NotFoundError`, `ForbiddenError`, `InternalError`

### Brak nowych typów do utworzenia

Endpoint nie przyjmuje body, więc nie wymaga Command Model ani dodatkowych schematów walidacji.

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)

```json
{
  "message": "Need successfully deleted",
  "deleted_at": "2026-01-21T11:15:00Z"
}
```

### Błędy

| Status | Kod | Opis |
|--------|-----|------|
| 400 | `VALIDATION_ERROR` | Nieprawidłowy format UUID w parametrze `:id` |
| 401 | `UNAUTHORIZED` | Brak lub nieprawidłowy token uwierzytelniający |
| 403 | `FORBIDDEN` | Uwierzytelniony użytkownik nie jest właścicielem potrzeby |
| 404 | `NOT_FOUND` | Potrzeba nie istnieje lub została już usunięta (soft delete) |
| 500 | `INTERNAL_ERROR` | Błąd bazy danych lub nieoczekiwany wyjątek |

## 5. Przepływ danych

```
Klient → DELETE /api/needs/:id
  │
  ├─ 1. Walidacja parametru ścieżki (NeedIdParamsSchema)
  │     └─ Błąd → 400 VALIDATION_ERROR
  │
  ├─ 2. Sprawdzenie dostępności klienta Supabase (locals.supabase)
  │     └─ Brak → 500 INTERNAL_ERROR
  │
  ├─ 3. Uwierzytelnienie (supabase.auth.getUser())
  │     └─ Brak usera → 401 UNAUTHORIZED
  │
  ├─ 4. Wywołanie NeedsService.deleteNeed(id, userId)
  │     │
  │     ├─ 4a. SELECT needs WHERE id = :id AND deleted_at IS NULL
  │     │     └─ Brak rekordu → NotFoundError → 404
  │     │
  │     ├─ 4b. Sprawdzenie shelter_id === userId
  │     │     └─ Nie pasuje → ForbiddenError → 403
  │     │
  │     ├─ 4c. UPDATE needs SET deleted_at = now() WHERE id = :id
  │     │     └─ Błąd DB → InternalError → 500
  │     │
  │     └─ 4d. Zwrócenie NeedDeleteResponseDTO
  │
  └─ 5. Odpowiedź 200 OK z JSON
```

## 6. Względy bezpieczeństwa

1. **Uwierzytelnienie** — wymagany Bearer token w nagłówku `Authorization`. Weryfikacja przez `supabase.auth.getUser()`.
2. **Autoryzacja własności (IDOR protection)** — porównanie `shelter_id` potrzeby z `user.id` uwierzytelnionego użytkownika. Zapobiega usunięciu cudzych potrzeb.
3. **Idempotentność** — próba usunięcia już soft-deleted potrzeby zwraca 404 (warunek `deleted_at IS NULL` w zapytaniu SELECT). Nie ma ryzyka podwójnej modyfikacji.
4. **Brak body** — endpoint nie parsuje request body, co eliminuje ryzyko injection przez payload.
5. **Walidacja UUID** — parametr `:id` walidowany przez Zod, co zapobiega SQL injection i nieprawidłowym zapytaniom.

## 7. Rozważania dotyczące wydajności

1. **Optymalne zapytania** — Endpoint wykonuje co najwyżej 2 zapytania do bazy: SELECT (pobranie rekordu) + UPDATE (ustawienie `deleted_at`). Obie operacje wykorzystują klucz główny (`id`), więc są O(1).
2. **Brak joinów** — w przeciwieństwie do GET, nie trzeba pobierać danych profilu z tabeli `profiles`.
3. **Indeksy** — kolumna `id` jest kluczem głównym (PK), więc wyszukiwanie jest indeksowane. Brak konieczności dodatkowych indeksów.
4. **Soft delete vs hard delete** — soft delete nie powoduje reorganizacji indeksu, ale z czasem narastają "martwe" rekordy. Rozwiązanie: filtrowanie `deleted_at IS NULL` w zapytaniach listujących (już zaimplementowane w `getNeeds`).

## 8. Etapy wdrożenia

### Krok 1: Dodanie metody `deleteNeed` w `NeedsService`

**Plik:** `src/lib/services/needs.service.ts`

Dodać nową metodę `deleteNeed(needId: string, userId: string): Promise<NeedDeleteResponseDTO>` w klasie `NeedsService`:

1. **Pobranie potrzeby** — `SELECT id, shelter_id FROM needs WHERE id = :needId AND deleted_at IS NULL` (`.maybeSingle()`)
2. **Walidacja istnienia** — jeśli brak rekordu, rzucić `NotFoundError("Need not found")`
3. **Walidacja własności** — jeśli `shelter_id !== userId`, rzucić `ForbiddenError("You are not the owner of this need")`
4. **Soft delete** — `UPDATE needs SET deleted_at = now() WHERE id = :needId`, zwracając kolumnę `deleted_at` (`.select("deleted_at").single()`)
5. **Zwrócenie DTO** — `{ message: "Need successfully deleted", deleted_at: updated.deleted_at }`
6. **Obsługa błędów DB** — każdy błąd Supabase logowany przez `logErrorWithContext` i opakowany w `InternalError`

Wzorzec implementacji analogiczny do istniejących metod `fulfillNeed` i `updateNeed`.

### Krok 2: Dodanie handlera `DELETE` w route

**Plik:** `src/pages/api/needs/[id]/index.ts`

Wyeksportować nowy handler `export const DELETE: APIRoute` w istniejącym pliku route (obok `GET` i `PATCH`):

1. **Walidacja parametru ścieżki** — `NeedIdParamsSchema.safeParse({ id: params.id })` → 400 jeśli niepoprawny
2. **Sprawdzenie Supabase** — `locals.supabase` → 500 jeśli brak
3. **Uwierzytelnienie** — `supabase.auth.getUser()` → 401 jeśli brak usera
4. **Delegacja do serwisu** — `needsService.deleteNeed(id, user.id)`
5. **Mapowanie błędów domenowych:**
   - `NotFoundError` → 404 `NOT_FOUND`
   - `ForbiddenError` → 403 `FORBIDDEN`
   - `InternalError` → 500 `INTERNAL_ERROR`
   - Catch-all → 500 `INTERNAL_ERROR`
6. **Sukces** — `Response(JSON.stringify(result), { status: 200 })`
7. **Logowanie** — `logSuccess("DELETE /api/needs/:id", { need_id, user_id })` przy sukcesie

Struktura handlera powinna być identyczna z `POST /api/needs/:id/fulfill` — uproszczona (bez sprawdzania roli/statusu profilu, bo autoryzacja odbywa się w serwisie przez sprawdzenie `shelter_id`).

### Krok 3: Testy jednostkowe serwisu

**Plik:** `src/lib/services/needs.service.test.ts`

Dodać nową sekcję `describe("deleteNeed", ...)` z następującymi scenariuszami:

1. **Sukces** — potrzeba istnieje, `shelter_id` pasuje, zwraca `NeedDeleteResponseDTO`
2. **Not found** — potrzeba nie istnieje → rzuca `NotFoundError`
3. **Already deleted** — potrzeba ma `deleted_at` ustawione → SELECT zwraca null → `NotFoundError`
4. **Not owner** — `shelter_id !== userId` → rzuca `ForbiddenError`
5. **DB error on SELECT** — Supabase zwraca błąd → rzuca `InternalError`
6. **DB error on UPDATE** — Supabase zwraca błąd na etapie update → rzuca `InternalError`

### Krok 4: Testy jednostkowe handlera route

**Plik:** `src/pages/api/needs/[id]/index.test.ts`

Dodać nową sekcję `describe("DELETE /api/needs/:id", ...)` w istniejącym pliku testowym z następującymi scenariuszami:

1. **Niepoprawny UUID** → 400 `VALIDATION_ERROR`
2. **Brak klienta Supabase** (`locals.supabase = null`) → 500 `INTERNAL_ERROR`
3. **Brak uwierzytelnienia** (`getUser` zwraca null) → 401 `UNAUTHORIZED`
4. **Błąd uwierzytelnienia** (`getUser` zwraca error) → 401 `UNAUTHORIZED`
5. **Sukces** → 200 z `NeedDeleteResponseDTO`
6. **NotFoundError z serwisu** → 404 `NOT_FOUND`
7. **ForbiddenError z serwisu** → 403 `FORBIDDEN`
8. **InternalError z serwisu** → 500 `INTERNAL_ERROR`
9. **Nieoczekiwany błąd z serwisu** → 500 `INTERNAL_ERROR`

Wzorzec testów analogiczny do istniejących testów PATCH i fulfill — użycie `vi.doMock`, `vi.resetModules()`, dynamiczny import modułu route.
