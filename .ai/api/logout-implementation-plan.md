# API Endpoint Implementation Plan: POST /api/auth/logout

## 1. Przegląd punktu końcowego

Endpoint `POST /api/auth/logout` kończy aktywną sesję użytkownika, unieważniając jego tokeny uwierzytelniające po stronie Supabase Auth. Jest to endpoint chroniony — wymaga tokenu `access_token` przesłanego w nagłówku `Authorization: Bearer {access_token}`. Endpoint nie przyjmuje żadnego request body i zwraca prostą wiadomość potwierdzającą wylogowanie.

Kluczową różnicą w stosunku do endpointów `login` i `signup` jest to, że `logout` wymaga **uwierzytelnionego** użytkownika. Middleware Astro już przekazuje nagłówek `Authorization` do klienta Supabase — dzięki temu `supabase.auth.getUser()` rozpozna bieżącego użytkownika, a `supabase.auth.signOut()` zakończy jego sesję.

## 2. Szczegóły żądania

- **Metoda HTTP:** POST
- **Struktura URL:** `/api/auth/logout`
- **Nagłówki:**
  - `Authorization: Bearer {access_token}` — **wymagany**
- **Parametry:**
  - Wymagane: brak (token w nagłówku)
  - Opcjonalne: brak
- **Request Body:** brak (endpoint nie oczekuje żadnych danych w body)

## 3. Wykorzystywane typy

### DTO (odpowiedź)

Endpoint zwraca prosty obiekt z wiadomością. Nie jest wymagane tworzenie dedykowanego DTO — odpowiedź to `{ message: string }`. Można jednak dodać typ dla spójności:

#### [NEW] `LogoutResponseDTO` w [types.ts](file:///Users/sebastian/Projects/Shelterly/src/types.ts)

```typescript
/**
 * DTO 22: POST /api/auth/logout - Successful logout response
 */
export interface LogoutResponseDTO {
  message: string;
}
```

### Command Model

Nie jest wymagany żaden Command Model — endpoint nie przyjmuje request body.

### Walidacja (Zod Schema)

Nie jest wymagana żadna walidacja request body — endpoint nie przyjmuje danych wejściowych.

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)

```json
{
  "message": "Logout successful"
}
```

### Kody błędów

| Kod HTTP | ErrorCode        | Opis                                                    |
| -------- | ---------------- | ------------------------------------------------------- |
| 200      | —                | Wylogowanie zakończone pomyślnie                        |
| 401      | `UNAUTHORIZED`   | Brak lub nieprawidłowy token (użytkownik niezalogowany) |
| 500      | `INTERNAL_ERROR` | Błąd Supabase Auth podczas wylogowywania                |

## 5. Przepływ danych

```
Klient → [Authorization: Bearer token] → POST /api/auth/logout
  │
  ├── 1. Middleware (index.ts): tworzy SupabaseClient z nagłówkiem Authorization
  │
  ├── 2. Route handler (logout.ts):
  │     ├── a. Sprawdź dostępność supabase z locals
  │     ├── b. Wywołaj AuthService.logout()
  │     │     ├── i.  supabase.auth.getUser() — weryfikacja tokenu
  │     │     │     └── (brak user → UnauthorizedError)
  │     │     ├── ii. supabase.auth.signOut() — unieważnienie sesji
  │     │     │     └── (błąd → InternalError)
  │     │     └── iii. Zwróć { message: "Logout successful" }
  │     └── c. Zwróć Response 200 z JSON
  │
  └── Obsługa błędów → mapowanie na HTTP response
```

## 6. Względy bezpieczeństwa

1. **Uwierzytelnienie obowiązkowe** — endpoint wymaga ważnego tokenu JWT w nagłówku `Authorization`. Brak tokenu lub token wygasły/nieprawidłowy skutkuje odpowiedzią `401 Unauthorized`.
2. **Weryfikacja tokenu po stronie serwera** — użycie `supabase.auth.getUser()` zamiast `getSession()`, ponieważ `getUser()` wykonuje zapytanie do serwera Auth i nie polega wyłącznie na danych z JWT, co zapobiega atakom z użyciem sfałszowanych tokenów.
3. **Brak request body** — endpoint nie przyjmuje żadnych danych, co eliminuje ryzyko injection, XSS w danych wejściowych i ataków typu mass assignment.
4. **Idempotentność** — wielokrotne wywołanie logout z tym samym (wygasłym/unieważnionym) tokenem powinno zwracać `401`, a nie powodować efektów ubocznych.
5. **Brak ujawniana informacji wewnętrznych** — wiadomości błędów `500` są sanityzowane przez `createErrorHttpResponse` — klient nie widzi stacktrace'ów ani szczegółów Supabase.

## 7. Obsługa błędów

| Scenariusz                       | Wyjątek             | HTTP | ErrorCode        |
| -------------------------------- | ------------------- | ---- | ---------------- |
| Brak klienta Supabase w locals   | —                   | 500  | `INTERNAL_ERROR` |
| Brak/wygasły/nieprawidłowy token | `UnauthorizedError` | 401  | `UNAUTHORIZED`   |
| Błąd Supabase przy `signOut()`   | `InternalError`     | 500  | `INTERNAL_ERROR` |
| Nieoczekiwany wyjątek w service  | niezdefiniowany     | 500  | `INTERNAL_ERROR` |

Logowanie błędów:

- Użycie `logErrorWithContext` z parametrami `{ endpoint: "POST /api/auth/logout", user_id }` dla błędów nieoczekiwanych.
- Użycie `logSuccess` po pomyślnym wylogowaniu.

## 8. Rozważania dotyczące wydajności

- Endpoint jest lekki — wykonuje co najwyżej 2 zapytania do Supabase Auth (`getUser` + `signOut`).
- Brak zapytań do bazy danych — nie ma potrzeby odpytywania tabeli `profiles`.
- Brak walidacji body — zero parsowania JSON.
- Brak potencjalnych wąskich gardeł — jedyny koszt to komunikacja z Supabase Auth.
- Operacja `signOut` w Supabase wykonuje jedynie unieważnienie refresh tokenu w bazie auth, co jest operacją o niskim koszcie.

## 9. Etapy wdrożenia

### Krok 1: Dodanie `LogoutResponseDTO` do `types.ts`

#### [MODIFY] [types.ts](file:///Users/sebastian/Projects/Shelterly/src/types.ts)

Dodać nowy typ `LogoutResponseDTO` w sekcji `// Auth DTOs`:

```typescript
/**
 * DTO 22: POST /api/auth/logout - Successful logout response
 */
export interface LogoutResponseDTO {
  message: string;
}
```

---

### Krok 2: Dodanie metody `logout()` do `AuthService`

#### [MODIFY] [auth.service.ts](file:///Users/sebastian/Projects/Shelterly/src/lib/services/auth.service.ts)

Dodać import `LogoutResponseDTO` i nową metodę `logout()`:

```typescript
/**
 * Ends the current user session.
 *
 * Flow:
 * 1. Verifies the user is authenticated via `supabase.auth.getUser()`.
 * 2. Calls `supabase.auth.signOut()` to invalidate the session.
 * 3. Returns a LogoutResponseDTO with confirmation message.
 *
 * @returns LogoutResponseDTO with success message
 * @throws UnauthorizedError if no valid user session exists
 * @throws InternalError if Supabase signOut fails
 */
async logout(): Promise<LogoutResponseDTO> {
  // 1. Verify the user is authenticated
  const { data: userData, error: userError } = await this.supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new UnauthorizedError("Authentication required");
  }

  // 2. Sign out — invalidate the session
  const { error: signOutError } = await this.supabase.auth.signOut();

  if (signOutError) {
    throw new InternalError("Logout failed");
  }

  // 3. Return confirmation
  return { message: "Logout successful" };
}
```

---

### Krok 3: Utworzenie route handlera `logout.ts`

#### [NEW] [logout.ts](file:///Users/sebastian/Projects/Shelterly/src/pages/api/auth/logout.ts)

Wzorowany na `login.ts`, ale znacznie prostszy:

```typescript
import type { APIRoute } from "astro";
import { AuthService } from "@/lib/services/auth.service";
import { createErrorHttpResponse, logErrorWithContext, logSuccess, UnauthorizedError } from "@/lib/errors";

export const prerender = false;

/**
 * POST /api/auth/logout
 *
 * Ends the current user session by invalidating auth tokens.
 * Requires a valid access_token in the Authorization header.
 *
 * Response: { message: "Logout successful" } (200 OK)
 */
export const POST: APIRoute = async ({ locals }) => {
  // 1. Verify Supabase client is available
  const supabase = locals.supabase;
  if (!supabase) {
    return createErrorHttpResponse("INTERNAL_ERROR", "Database connection not available", 500);
  }

  try {
    // 2. Delegate to service layer
    const authService = new AuthService(supabase);
    const result = await authService.logout();

    // 3. Log successful logout
    logSuccess("POST /api/auth/logout");

    // 4. Return 200 OK
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Map domain errors to HTTP responses
    if (error instanceof UnauthorizedError) {
      return createErrorHttpResponse("UNAUTHORIZED", error.message, 401);
    }

    // Unexpected errors
    logErrorWithContext({ endpoint: "POST /api/auth/logout" }, error);

    return createErrorHttpResponse("INTERNAL_ERROR", "An internal error occurred", 500);
  }
};
```

---

### Krok 4: Testy jednostkowe

#### [NEW] [logout.test.ts](file:///Users/sebastian/Projects/Shelterly/src/pages/api/auth/logout.test.ts)

Testy wzorowane na `login.test.ts`, pokrywające następujące scenariusze:

| #   | Scenariusz                                   | Oczekiwany wynik                       |
| --- | -------------------------------------------- | -------------------------------------- |
| 1   | Brak klienta Supabase w locals               | 500 `INTERNAL_ERROR`                   |
| 2   | `getUser` → error (brak/nieprawidłowy token) | 401 `UNAUTHORIZED`                     |
| 3   | `getUser` → user null (brak sesji)           | 401 `UNAUTHORIZED`                     |
| 4   | `signOut` → error                            | 500 `INTERNAL_ERROR`                   |
| 5   | Nieoczekiwany wyjątek w service              | 500 `INTERNAL_ERROR`                   |
| 6   | Pomyślne wylogowanie                         | 200 `{ message: "Logout successful" }` |

Testy korzystają z mocków Supabase (`auth.getUser` i `auth.signOut`) analogicznie do wzorca z `login.test.ts`.

## 10. Plan weryfikacji

### Testy automatyczne

Uruchomienie testów jednostkowych:

```bash
npx vitest run src/pages/api/auth/logout.test.ts
```

Testy pokrywają wszystkie scenariusze z tabeli ze Kroku 4, w tym:

- Brak klienta Supabase
- Użytkownik niezalogowany (brak/nieprawidłowy token)
- Błąd Supabase Auth przy `signOut`
- Nieoczekiwany wyjątek
- Pomyślne wylogowanie z poprawnym shape odpowiedzi
