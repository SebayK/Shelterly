# API Endpoint Implementation Plan: POST /api/needs/:id/fulfill

## 1. Przegląd punktu końcowego

Endpoint `POST /api/needs/:id/fulfill` pozwala właścicielowi potrzeby (schronisku) oznaczyć ją jako zrealizowaną (`is_fulfilled = true`). Operacja jest dostępna wyłącznie dla uwierzytelnionego użytkownika, który jest właścicielem danej potrzeby. Endpoint nie przyjmuje body — jedynym parametrem jest `id` potrzeby w ścieżce URL.

## 2. Szczegóły żądania

- **Metoda HTTP:** POST
- **Struktura URL:** `/api/needs/:id/fulfill`
- **Parametry:**
  - **Wymagane:**
    - `id` (UUID, path param) — identyfikator potrzeby do oznaczenia jako zrealizowana
  - **Opcjonalne:** brak
- **Nagłówki:**
  - `Authorization: Bearer {access_token}` — wymagany
- **Request Body:** brak (endpoint nie przyjmuje żadnego ciała żądania)

## 3. Wykorzystywane typy

### DTO odpowiedzi

```typescript
// Istniejący DTO w src/types.ts (DTO 15)
export interface NeedFulfillResponseDTO {
  id: string;
  is_fulfilled: boolean;
  updated_at: string;
}
```

### Schemat walidacji (Zod)

Ponowne użycie istniejącego `NeedIdParamsSchema` z `src/lib/validation/needs.schemas.ts`:

```typescript
export const NeedIdParamsSchema = z.object({
  id: z.string().uuid("Invalid need ID format"),
});
```

### Command Model

Brak — endpoint nie przyjmuje request body. Nie jest wymagany nowy Command Model.

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)

```json
{
  "id": "uuid",
  "is_fulfilled": true,
  "updated_at": "2026-01-21T11:20:00Z"
}
```

### Odpowiedzi błędów

| HTTP Status | Kod błędu          | Opis                                                                    |
| ----------- | ------------------ | ----------------------------------------------------------------------- |
| 400         | `VALIDATION_ERROR` | `id` nie jest prawidłowym UUID                                          |
| 401         | `UNAUTHORIZED`     | Brak tokenu / nieprawidłowy token                                       |
| 403         | `FORBIDDEN`        | Użytkownik nie jest właścicielem potrzeby                               |
| 404         | `NOT_FOUND`        | Potrzeba nie istnieje, jest usunięta (soft delete) lub już zrealizowana |
| 500         | `INTERNAL_ERROR`   | Błąd serwera / bazy danych                                              |

## 5. Przepływ danych

```
Klient → POST /api/needs/:id/fulfill
  │
  ├─ 1. Walidacja path param (id → UUID via NeedIdParamsSchema)
  │     └─ Błąd → 400 VALIDATION_ERROR
  │
  ├─ 2. Sprawdzenie Supabase client (middleware)
  │     └─ Brak → 500 INTERNAL_ERROR
  │
  ├─ 3. Uwierzytelnienie (supabase.auth.getUser())
  │     └─ Błąd / brak usera → 401 UNAUTHORIZED
  │
  ├─ 4. Delegacja do NeedsService.fulfillNeed(needId, userId)
  │     │
  │     ├─ 4a. Pobranie potrzeby z bazy (needs.id, deleted_at IS NULL)
  │     │     └─ Nie znaleziono → NotFoundError → 404
  │     │
  │     ├─ 4b. Sprawdzenie własności (need.shelter_id === userId)
  │     │     └─ Nie pasuje → ForbiddenError → 403
  │     │
  │     ├─ 4c. Sprawdzenie czy potrzeba nie jest już zrealizowana
  │     │     └─ Już zrealizowana → NotFoundError → 404 (lub CONFLICT — patrz sekcja 6)
  │     │
  │     ├─ 4d. UPDATE needs SET is_fulfilled = true, updated_at = now() WHERE id = :id
  │     │     └─ Błąd DB → InternalError → 500
  │     │
  │     └─ 4e. Zwrócenie NeedFulfillResponseDTO
  │
  └─ 5. Zwrócenie Response 200 z JSON
```

### Interakcje z bazą danych

1. **SELECT** z tabeli `needs` — pobranie potrzeby po `id`, filtr `deleted_at IS NULL`
2. **UPDATE** tabeli `needs` — ustawienie `is_fulfilled = true`, `updated_at = now()`

Obie operacje korzystają z Supabase JS SDK (klient wstrzyknięty przez middleware).

## 6. Względy bezpieczeństwa

### Uwierzytelnianie

- Token Bearer jest wymagany — walidowany przez `supabase.auth.getUser()`
- Brak tokenu lub nieprawidłowy token → 401

### Autoryzacja (własność zasobu)

- Po pobraniu potrzeby z bazy, porównanie `need.shelter_id` z `user.id`
- Jeśli użytkownik nie jest właścicielem → 403 Forbidden
- Komunikat błędu nie powinien ujawniać istnienia zasobu do innych użytkowników — rozważyć zwrócenie 404 zamiast 403 dla nieuwierzytelnionych zapytań (w tym przypadku endpoint i tak wymaga auth, więc 403 jest odpowiednie)

### Walidacja danych wejściowych

- Path param `id` walidowany jako UUID przez Zod — zapobiega SQL injection i nieoczekiwanym wartościom
- Brak request body — brak potrzeby walidacji ciała żądania

### Ochrona przed nadużyciami

- Operacja jest idempotentna w sensie stanu końcowego (wielokrotne wywołanie nie zmieni stanu), ale warto rozważyć zwrócenie 404 dla potrzeby już zrealizowanej, aby zachować spójność z konwencją API
- Rate limiting nie jest wymagany dla tego endpointu (operacja nie tworzy zasobów ani nie wywołuje kosztownych usług zewnętrznych)

### Filtrowanie soft-deleted

- Potrzeby z `deleted_at IS NOT NULL` są traktowane jako nieistniejące (404)

## 7. Obsługa błędów

### Scenariusze błędów i mapowanie

| Scenariusz                                    | Wyjątek w service | HTTP Status | Error Code         |
| --------------------------------------------- | ----------------- | ----------- | ------------------ |
| `id` nie jest prawidłowym UUID                | — (walidacja Zod) | 400         | `VALIDATION_ERROR` |
| Brak/nieprawidłowy token autoryzacji          | —                 | 401         | `UNAUTHORIZED`     |
| Użytkownik nie jest właścicielem potrzeby     | `ForbiddenError`  | 403         | `FORBIDDEN`        |
| Potrzeba nie istnieje (lub soft-deleted)      | `NotFoundError`   | 404         | `NOT_FOUND`        |
| Potrzeba jest już oznaczona jako zrealizowana | `NotFoundError`   | 404         | `NOT_FOUND`        |
| Błąd bazy danych przy SELECT                  | `InternalError`   | 500         | `INTERNAL_ERROR`   |
| Błąd bazy danych przy UPDATE                  | `InternalError`   | 500         | `INTERNAL_ERROR`   |
| Nieoczekiwany błąd                            | dowolny `Error`   | 500         | `INTERNAL_ERROR`   |

### Logowanie błędów

- Błędy bazy danych: `logErrorWithContext()` ze structured context (endpoint, user_id, need_id)
- Nieoczekiwane błędy: `logError()` w route handler (catch-all)
- Sukces: `logSuccess()` z metadanymi (need_id, user_id)

## 8. Rozważania dotyczące wydajności

- **Pojedyncze zapytanie SELECT + UPDATE:** Endpoint wykonuje dwa zapytania do bazy. Operacja `fulfillNeed` w serwisie może być zoptymalizowana do wykonania UPDATE z warunkami w WHERE (np. `WHERE id = :id AND shelter_id = :userId AND deleted_at IS NULL AND is_fulfilled = false`), ale kosztem mniej precyzyjnych komunikatów o błędach. Rekomendacja: użyć osobnego SELECT + UPDATE dla czytelnych błędów.
- **Indeksy:** Zapytanie po `needs.id` (PK) jest natywnie szybkie. Brak potrzeby dodatkowych indeksów.
- **Brak cache:** Operacja modyfikująca — cache nie ma zastosowania.
- **Brak rate limitera:** Operacja jest lekka (brak zewnętrznych usług, brak tworzenia zasobów). Rate limiting nie jest konieczny.

## 9. Etapy wdrożenia

### Krok 1: Dodanie metody `fulfillNeed` w `NeedsService`

**Plik:** `src/lib/services/needs.service.ts`

Dodać nową metodę publiczną w klasie `NeedsService`:

```typescript
async fulfillNeed(needId: string, userId: string): Promise<NeedFulfillResponseDTO>
```

**Logika metody:**

1. Pobranie potrzeby z bazy:
   ```typescript
   this.supabase
     .from("needs")
     .select("id, shelter_id, is_fulfilled, deleted_at")
     .eq("id", needId)
     .is("deleted_at", null)
     .maybeSingle();
   ```
2. Jeśli błąd DB → `logError()` + throw `InternalError`
3. Jeśli brak danych → throw `NotFoundError("Need not found")`
4. Jeśli `data.shelter_id !== userId` → throw `ForbiddenError("You are not the owner of this need")`
5. Jeśli `data.is_fulfilled === true` → throw `NotFoundError("Need is already fulfilled")` (zachowanie spójne z API — fulfilled need jest traktowany jako "not actionable")
6. Aktualizacja potrzeby:
   ```typescript
   this.supabase
     .from("needs")
     .update({ is_fulfilled: true, updated_at: new Date().toISOString() })
     .eq("id", needId)
     .select("id, is_fulfilled, updated_at")
     .single();
   ```
7. Jeśli błąd DB → `logErrorWithContext()` + throw `InternalError`
8. Zwrócenie `NeedFulfillResponseDTO`

**Import typów:**

- Dodać `NeedFulfillResponseDTO` do importów z `@/types`
- Dodać `ForbiddenError` do importów z `@/lib/errors`

### Krok 2: Utworzenie pliku route handlera

**Plik:** `src/pages/api/needs/[id]/fulfill.ts`

Konieczne jest utworzenie katalogu `[id]` wewnątrz `src/pages/api/needs/` (Astro obsługuje zagnieżdżone dynamiczne segmenty).

**Struktura pliku:**

```typescript
import type { APIRoute } from "astro";
import { NeedsService } from "@/lib/services/needs.service";
import { NeedIdParamsSchema } from "@/lib/validation/needs.schemas";
import {
  NotFoundError,
  ForbiddenError,
  InternalError,
  createErrorHttpResponse,
  createValidationErrorResponse,
  logError,
  logErrorWithContext,
  logSuccess,
} from "@/lib/errors";

export const prerender = false;

export const POST: APIRoute = async ({ params, locals }) => { ... };
```

**Logika route handlera (POST):**

1. Walidacja `params.id` przez `NeedIdParamsSchema.safeParse()`
   - Błąd → `createValidationErrorResponse()`
2. Sprawdzenie `locals.supabase`
   - Brak → `createErrorHttpResponse("INTERNAL_ERROR", ..., 500)`
3. Uwierzytelnienie: `supabase.auth.getUser()`
   - Błąd / brak usera → `createErrorHttpResponse("UNAUTHORIZED", ..., 401)`
4. Delegacja do `NeedsService.fulfillNeed(id, user.id)` w bloku try/catch
5. Obsługa wyjątków:
   - `NotFoundError` → 404
   - `ForbiddenError` → 403
   - `InternalError` → 500 (z logowaniem)
   - Inne → 500 (catch-all z logowaniem)
6. Sukces → `logSuccess()` + Response 200 z JSON

### Krok 3: Testy jednostkowe serwisu

**Plik:** `src/lib/services/needs.service.test.ts` (rozszerzenie istniejącego pliku)

Dodać nową sekcję `describe("fulfillNeed", ...)` z testami:

1. **Sukces:** Potrzeba istnieje, użytkownik jest właścicielem, nie jest fulfilled → zwraca DTO
2. **NotFoundError:** Potrzeba nie istnieje (brak danych)
3. **NotFoundError:** Potrzeba jest soft-deleted (symulacja — brak danych po filtrze)
4. **ForbiddenError:** Użytkownik nie jest właścicielem (`shelter_id !== userId`)
5. **NotFoundError:** Potrzeba jest już fulfilled
6. **InternalError:** Błąd bazy na SELECT
7. **InternalError:** Błąd bazy na UPDATE

Mock Supabase musi obsługiwać łańcuch: `from("needs").select(...).eq(...).is(...).maybeSingle()` dla SELECT oraz `from("needs").update(...).eq(...).select(...).single()` dla UPDATE.

### Krok 4: Testy jednostkowe route handlera

**Plik:** `src/pages/api/needs/[id]/fulfill.test.ts`

Scenariusze testowe:

1. **400:** Nieprawidłowy UUID w `params.id`
2. **401:** Brak uwierzytelnienia (`getUser()` zwraca błąd)
3. **403:** Użytkownik nie jest właścicielem (service rzuca `ForbiddenError`)
4. **404:** Potrzeba nie istnieje (service rzuca `NotFoundError`)
5. **200:** Sukces — prawidłowa odpowiedź z `NeedFulfillResponseDTO`
6. **500:** Nieoczekiwany błąd (service rzuca nieokreślony błąd)

### Krok 5: Weryfikacja integracji

1. Uruchomienie `npm run lint` — brak błędów
2. Uruchomienie `npm run test` — wszystkie testy przechodzą
3. Manualne testowanie z Supabase (jeśli dostępna lokalna instancja)
