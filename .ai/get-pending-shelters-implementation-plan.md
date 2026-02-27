# API Endpoint Implementation Plan: GET /api/admin/shelters/pending

## 1. Przegląd punktu końcowego

Endpoint zwraca paginowaną listę schronisk oczekujących na weryfikację (`status = 'pending'`). Dostęp jest **wyłącznie dla superadministratorów** (`role = 'super_admin'`). Odpowiedź zawiera wrażliwe dane (NIP, email, ścieżka dokumentu weryfikacyjnego), które nie są dostępne publicznie.

Kluczowym wyzwaniem jest to, że pole `email` przechowywane jest w tabeli `auth.users` (zarządzanej przez Supabase Auth), a nie w tabeli `profiles`. Wymagane jest po jego stronie bezpieczne pobieranie danych z poziomu backendu — bez ujawniania klucza service role po stronie klienta.

---

## 2. Szczegóły żądania

- **Metoda HTTP:** `GET`
- **Struktura URL:** `/api/admin/shelters/pending`
- **Nagłówki:** `Authorization: Bearer {access_token}` (wymagany)
- **Parametry:**
  - Wymagane: brak
  - Opcjonalne:
    - `limit` — liczba wyników na stronie (integer, min: 1, max: 100, domyślnie: 20)
    - `offset` — przesunięcie paginacji (integer, min: 0, domyślnie: 0)
- **Request Body:** brak (metoda GET)

---

## 3. Wykorzystywane typy

Wszystkie typy są już zdefiniowane w `src/types.ts`:

```typescript
// Typ elementu listy oczekujących schronisk (DTO 7)
PendingShelterListItemDTO {
  id: string;
  name: string | null;
  nip: string | null;
  city: string | null;
  email: string;              // pochodzi z auth.users
  verification_doc_path: string | null;
  created_at: string;
}

// Wrapper odpowiedzi listy (DTO 19)
PendingShelterListResponseDTO {
  data: PendingShelterListItemDTO[];
  pagination: Pagination;     // { total, limit, offset }
}

// Parametry zapytania
PendingSheltersQueryParams {
  limit?: number;
  offset?: number;
}
```

Wymagane jest stworzenie nowego schematu Zod:

```typescript
// src/lib/validation/admin.schemas.ts
PendingSheltersQueryParamsSchema; // walidacja limit i offset
```

---

## 4. Szczegóły odpowiedzi

### Sukces — 200 OK

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Schronisko XYZ",
      "nip": "1234567890",
      "city": "Kraków",
      "email": "shelter@example.com",
      "verification_doc_path": "verification-docs/uuid/doc.pdf",
      "created_at": "2026-01-20T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 20,
    "offset": 0
  }
}
```

### Błędy

| Status | Error Code         | Opis                                       |
| ------ | ------------------ | ------------------------------------------ |
| 400    | `VALIDATION_ERROR` | Nieprawidłowe parametry paginacji          |
| 401    | `UNAUTHORIZED`     | Brak lub nieprawidłowy token               |
| 403    | `FORBIDDEN`        | Zalogowany użytkownik nie jest super_admin |
| 500    | `INTERNAL_ERROR`   | Błąd bazy danych lub nieoczekiwany         |

---

## 5. Przepływ danych

```
Request
  │
  ├─► [Walidacja Zod] limit, offset
  │     └─► 400 jeśli nieprawidłowe
  │
  ├─► [Supabase Auth] supabase.auth.getUser()
  │     └─► 401 jeśli brak sesji
  │
  ├─► [DB Query] profiles WHERE id = user.id → sprawdzenie role
  │     └─► 403 jeśli role !== 'super_admin'
  │
  ├─► [AdminService.getPendingShelters(params)]
  │     ├─► Query: profiles WHERE status = 'pending', ORDER BY created_at DESC
  │     │          z {count: 'exact'} i paginacją
  │     └─► RPC call: get_pending_shelters_with_email(limit, offset)
  │         (funkcja DB z SECURITY DEFINER joinująca auth.users)
  │
  └─► Response 200 z PendingShelterListResponseDTO
```

### Strategia pobierania `email`

Pole `email` jest przechowywane w `auth.users`, do której aplikacja nie ma bezpośredniego dostępu przez klienta z kluczem anonimowym. Zalecane podejście:

**Opcja A (zalecana): PostgreSQL RPC z SECURITY DEFINER**

Stworzyć funkcję bazodanową w migracji:

```sql
CREATE OR REPLACE FUNCTION get_pending_shelters_with_email(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  nip TEXT,
  city TEXT,
  email TEXT,
  verification_doc_path TEXT,
  created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER  -- wykonuje jako właściciel funkcji (dostęp do auth.users)
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.nip,
    p.city,
    u.email::TEXT,
    p.verification_doc_path,
    p.created_at,
    COUNT(*) OVER()::BIGINT AS total_count
  FROM profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE p.status = 'pending'
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
```

Wywołanie z poziomu serwisu:

```typescript
const { data, error } = await this.supabase.rpc("get_pending_shelters_with_email", {
  p_limit: limit,
  p_offset: offset,
});
```

**Opcja B (alternatywa): Supabase Admin Client**

Stworzyć dedykowany klient z service role key w `src/db/supabase.admin.ts`, używany wyłącznie po stronie serwera do `supabase.auth.admin.listUsers()`. Wymaga dodania `SUPABASE_SERVICE_ROLE_KEY` do zmiennych środowiskowych.

---

## 6. Względy bezpieczeństwa

1. **Uwierzytelnienie:** Każde żądanie musi zawierać prawidłowy token JWT weryfikowany przez `supabase.auth.getUser()`.

2. **Autoryzacja na poziomie roli:** Po weryfikacji tożsamości, pobieramy profil użytkownika i sprawdzamy `role === 'super_admin'`. Nigdy nie polegamy wyłącznie na tokenie — rola musi być zweryfikowana z bazy danych.

3. **Dostęp do wrażliwych danych:** `nip`, `email`, `verification_doc_path` są dostępne tylko dla super_admin. Funkcja RPC musi być dostępna tylko dla ról z odpowiednimi uprawnieniami (lub ograniczona przez samą logikę).

4. **SECURITY DEFINER:** Funkcja SQL powinna mieć `SET search_path = public` aby zapobiec atakowi przez podmianę schematu (schema injection).

5. **Walidacja wejścia:** `limit` i `offset` walidowane przez Zod — zapobiega wstrzyknięciom przez parametry zapytania.

6. **Brak cachowania:** Odpowiedź nie powinna być cachowana (`Cache-Control: no-store`) — dane wrażliwe i dynamiczne.

---

## 7. Obsługa błędów

| Scenariusz                                        | Typ błędu           | Status | Error Code         |
| ------------------------------------------------- | ------------------- | ------ | ------------------ |
| Brak nagłówka Authorization lub wygasły token     | `UnauthorizedError` | 401    | `UNAUTHORIZED`     |
| Użytkownik istnieje, ale `role !== 'super_admin'` | `ForbiddenError`    | 403    | `FORBIDDEN`        |
| Nieprawidłowy `limit` (np. ujemny, nie-liczba)    | Zod validation      | 400    | `VALIDATION_ERROR` |
| Nieprawidłowy `offset` (np. ujemny, nie-liczba)   | Zod validation      | 400    | `VALIDATION_ERROR` |
| Błąd Supabase przy pobieraniu profilu admina      | `InternalError`     | 500    | `INTERNAL_ERROR`   |
| Błąd wywołania RPC                                | `InternalError`     | 500    | `INTERNAL_ERROR`   |
| Nieoczekiwany błąd                                | `Error`             | 500    | `INTERNAL_ERROR`   |

Użyć `createErrorHttpResponse()` i `createValidationErrorResponse()` z `src/lib/errors.ts` do generowania odpowiedzi błędu w formacie standardowym projektu.

---

## 8. Rozważania dotyczące wydajności

1. **Indeks na `profiles.status`:** Kolumna `status` ma indeks BTREE — filtrowanie po `status = 'pending'` jest wydajne.

2. **Paginacja po stronie DB:** Zapytanie używa `LIMIT` / `OFFSET` bezpośrednio w SQL — nie pobieramy wszystkich rekordów do pamięci.

3. **`COUNT(*) OVER()`:** Window function zamiast osobnego zapytania `COUNT` — pobieramy łączną liczbę rekordów w jednym przebiegu.

4. **JOIN zamiast N+1:** Funkcja RPC joinuje `auth.users` bezpośrednio w SQL — eliminujemy N+1 problem (brak pętli z `getUserById` per każdy profil).

5. **Brak cachowania:** Endpoint nie powinien być cachowany — dane mogą zmieniać się często (nowe rejestracje, zmiany statusu).

---

## 9. Etapy wdrożenia

### Krok 1: Migracja bazy danych — funkcja RPC

Stworzyć nowy plik migracji `supabase/migrations/YYYYMMDD000000_add_get_pending_shelters_fn.sql` z funkcją `get_pending_shelters_with_email` (kod SQL opisany w sekcji "Przepływ danych").

### Krok 2: Schemat walidacji Zod

Stworzyć plik `src/lib/validation/admin.schemas.ts`:

```typescript
import { z } from "zod";

export const PendingSheltersQueryParamsSchema = z.object({
  limit: z.union([z.coerce.number().int().min(1).max(100), z.null(), z.undefined()]).transform((val) => val ?? 20),
  offset: z.union([z.coerce.number().int().min(0), z.null(), z.undefined()]).transform((val) => val ?? 0),
});

export type PendingSheltersQueryParamsOutput = z.output<typeof PendingSheltersQueryParamsSchema>;
```

### Krok 3: AdminService

Stworzyć plik `src/lib/services/admin.service.ts`:

```typescript
import type { SupabaseClient } from "@/db/supabase.client";
import type { PendingShelterListResponseDTO, PendingShelterListItemDTO } from "@/types";
import { InternalError } from "@/lib/errors";

export class AdminService {
  constructor(private supabase: SupabaseClient) {}

  async getPendingShelters(params: { limit: number; offset: number }): Promise<PendingShelterListResponseDTO> {
    const { limit, offset } = params;

    const { data, error } = await this.supabase.rpc("get_pending_shelters_with_email", {
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      throw new InternalError("Failed to retrieve pending shelters");
    }

    const total = data?.[0]?.total_count ?? 0;

    const items: PendingShelterListItemDTO[] = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      nip: row.nip,
      city: row.city,
      email: row.email,
      verification_doc_path: row.verification_doc_path,
      created_at: row.created_at,
    }));

    return {
      data: items,
      pagination: { total, limit, offset },
    };
  }
}
```

### Krok 4: Endpoint Astro

Stworzyć plik `src/pages/api/admin/shelters/pending.ts`:

```typescript
import type { APIRoute } from "astro";
import { AdminService } from "@/lib/services/admin.service";
import { PendingSheltersQueryParamsSchema } from "@/lib/validation/admin.schemas";
import { createValidationErrorResponse, createErrorHttpResponse, logError, ForbiddenError } from "@/lib/errors";

export const prerender = false;

/**
 * GET /api/admin/shelters/pending
 * Returns paginated list of shelters pending verification.
 * Requires authentication and super_admin role.
 */
export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const supabase = locals.supabase;
    if (!supabase) {
      return createErrorHttpResponse("INTERNAL_ERROR", "Database connection not available", 500);
    }

    // 1. Uwierzytelnienie
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return createErrorHttpResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    // 2. Autoryzacja — weryfikacja roli super_admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return createErrorHttpResponse("INTERNAL_ERROR", "Failed to verify user role", 500);
    }

    if (profile.role !== "super_admin") {
      return createErrorHttpResponse("FORBIDDEN", "Access restricted to super administrators", 403);
    }

    // 3. Walidacja parametrów zapytania
    const validationResult = PendingSheltersQueryParamsSchema.safeParse({
      limit: url.searchParams.get("limit"),
      offset: url.searchParams.get("offset"),
    });

    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error.errors);
    }

    // 4. Pobranie danych przez serwis
    const adminService = new AdminService(supabase);
    const result = await adminService.getPendingShelters(validationResult.data);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logError("[GET /api/admin/shelters/pending]", error);
    return createErrorHttpResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred while retrieving pending shelters",
      500
    );
  }
};
```

### Krok 5: Weryfikacja typów i linting

Uruchomić `tsc --noEmit` i `eslint` aby upewnić się, że typy są spójne między serwisem, endpointem a DTO.

### Krok 6: Testy jednostkowe

Stworzyć `src/lib/services/admin.service.test.ts` testując:

- Prawidłowe mapowanie danych z RPC na `PendingShelterListItemDTO`
- Obsługę pustej listy (brak pending shelters)
- Rzucanie `InternalError` przy błędzie Supabase
- Poprawne wartości `pagination.total` z `total_count`

### Krok 7: Testy integracyjne endpointu

Stworzyć `src/pages/api/admin/shelters/pending.test.ts` testując:

- 401 gdy brak tokenu
- 403 gdy użytkownik ma `role !== 'super_admin'`
- 400 gdy `limit` lub `offset` są nieprawidłowe
- 200 ze zwrotem `PendingShelterListResponseDTO` dla super_admin
