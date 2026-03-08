# Plan implementacji widoku Logowania

## 1. Przegląd

Widok logowania umożliwia pracownikom schronisk oraz administratorom uwierzytelnienie się w aplikacji Shelterly. Strona prezentuje centralnie wyśrodkowany formularz z polami email i hasło, walidacją inline, obsługą błędów API (nieprawidłowe dane, konto oczekujące na weryfikację, konto zawieszone) oraz przekierowaniem po pomyślnym zalogowaniu. Widok zapewnia pełną dostępność (ARIA, focus trap, komunikaty live) i bezpieczeństwo (rate limiting, pole hasła z opcją pokaż/ukryj).

## 2. Routing widoku

- **Ścieżka:** `/auth/login`
- **Plik strony Astro:** `src/pages/auth/login.astro`
- **Prerender:** `false` (strona dynamiczna SSR)
- **Parametr query:** opcjonalny `?return=<URL>` — URL, na który użytkownik zostanie przekierowany po zalogowaniu (domyślnie `/dashboard`)

## 3. Struktura komponentów

```
login.astro (strona Astro)
└── Layout (layout bazowy)
    └── LoginForm (React, client:load)
        ├── Card (shadcn/ui)
        │   ├── CardHeader
        │   │   ├── CardTitle
        │   │   └── CardDescription
        │   ├── CardContent
        │   │   ├── FormErrorAlert (komunikat błędu ogólnego)
        │   │   ├── EmailField (label + Input + komunikat walidacji)
        │   │   └── PasswordField (label + Input + przycisk pokaż/ukryj + komunikat walidacji)
        │   └── CardFooter
        │       ├── Button (submit)
        │       └── Link do rejestracji
```

## 4. Szczegóły komponentów

### `login.astro`

- **Opis:** Strona Astro stanowiąca punkt wejścia dla ścieżki `/auth/login`. Renderuje layout aplikacji z osadzonym komponentem React `LoginForm` jako wyspą interaktywną (`client:load`). Odczytuje opcjonalny parametr `return` z query string i przekazuje go do `LoginForm`. Implementuje server-side guard, który sprawdza ważność sesji Supabase i przekierowuje zalogowanych użytkowników.
- **Główne elementy:** `<Layout>` z tytułem strony „Zaloguj się — Shelterly", `<main>` z klasami Tailwind centrującymi zawartość (flex, items-center, justify-center, min-h-screen), `<LoginForm>` z dyrektywą `client:load`.
- **Obsługiwane interakcje:** Brak — logika delegowana do `LoginForm`.
- **Obsługiwana walidacja:** Server-side sprawdzenie sesji przez `supabase.auth.getUser()`.
- **Typy:** Brak.
- **Propsy:** Brak (strona Astro).

### `LoginForm`

- **Opis:** Główny komponent React (wyspa) zawierający cały formularz logowania wraz z walidacją, obsługą stanu, wywołaniem API i przekierowaniem. Opakowuje formularz w komponent `Card` z shadcn/ui.
- **Główne elementy:**
  - `<Card>` z `<CardHeader>` (tytuł „Zaloguj się", opis „Wpisz dane logowania, aby zarządzać schroniskiem")
  - `<form>` z atrybutem `noValidate` (walidacja obsługiwana po stronie JS)
  - `FormErrorAlert` — wyświetlany warunkowo w `<CardContent>` ponad polami, gdy wystąpi błąd API
  - Pole email: `<label>` + `<Input>` (shadcn/ui) + `<span>` z komunikatem błędu
  - Pole hasło: `<label>` + kontener z `<Input>` i przyciskiem toggle widoczności + `<span>` z komunikatem błędu
  - `<CardFooter>`: `<Button>` submit (shadcn/ui) z tekstem „Zaloguj się" / spinner podczas ładowania, link do `/auth/register`
- **Obsługiwane interakcje:**
  - `onSubmit` formularza — walidacja pól, wywołanie API `POST /api/auth/login`, obsługa odpowiedzi
  - `onChange` / `onBlur` pól — walidacja inline (przy utracie focusu i podczas wpisywania po pierwszej próbie)
  - Kliknięcie przycisku pokaż/ukryj hasło — toggle `type` pola hasło między `password` a `text`
- **Obsługiwana walidacja:**
  - Email: wymagany, poprawny format email (`regex`), max 255 znaków
  - Hasło: wymagane, min 1 znak, max 128 znaków
- **Typy:** `LoginFormState`, `LoginFieldErrors`, `LoginCommand`, `ErrorResponse`
- **Propsy:**
  - `returnUrl?: string` — URL do przekierowania po zalogowaniu (domyślnie `"/dashboard"`)

### `FormErrorAlert`

- **Opis:** Komponent prezentujący komunikat błędu ogólnego (z API) nad polami formularza. Wykorzystuje atrybut `role="alert"` dla dostępności, który zgodnie ze specyfikacją WAI-ARIA implikuje `aria-live="assertive"` i `aria-atomic="true"`.
- **Główne elementy:** `<div>` z klasami Tailwind (bg-destructive/10, border-destructive, text-destructive, rounded, padding), ikona ostrzeżenia, tekst komunikatu.
- **Obsługiwane interakcje:** Brak — komponent czysto prezentacyjny.
- **Obsługiwana walidacja:** Brak.
- **Typy:** Brak dedykowanych.
- **Propsy:**
  - `message: string` — treść komunikatu błędu do wyświetlenia

## 5. Typy

### Istniejące typy (z `src/types.ts`)

```typescript
// Request body
interface LoginCommand {
  email: string;
  password: string;
}

// Odpowiedź sukcesu - tylko dane użytkownika i profilu
// Tokeny są zarządzane automatycznie przez @supabase/ssr jako HttpOnly cookies
interface LoginResponse {
  user: {
    id: string;
    email: string;
  };
  profile: {
    id: string;
    status: ShelterStatus;
    role: UserRole;
  };
}

// Odpowiedź błędu
interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
  };
}

interface ErrorDetail {
  field: string;
  message: string;
}

type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "ACCOUNT_PENDING"
  | "ACCOUNT_SUSPENDED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMIT_EXCEEDED"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE";
```

### Nowe typy (ViewModel, definiowane w pliku komponentu `LoginForm.tsx`)

```typescript
/**
 * Błędy walidacji poszczególnych pól formularza.
 * Klucze odpowiadają polom formularza.
 * Wartość `undefined` oznacza brak błędu.
 */
interface LoginFieldErrors {
  email?: string;
  password?: string;
}

/**
 * Pełny stan formularza logowania.
 */
interface LoginFormState {
  /** Wartości pól formularza */
  email: string;
  password: string;
  /** Błędy walidacji poszczególnych pól (inline) */
  fieldErrors: LoginFieldErrors;
  /** Komunikat błędu ogólnego (z API) wyświetlany nad formularzem */
  apiError: string | null;
  /** Czy formularz jest w trakcie wysyłania */
  isSubmitting: boolean;
  /** Czy hasło jest widoczne (toggle pokaż/ukryj) */
  showPassword: boolean;
}
```

## 6. Zarządzanie stanem

Stan formularza zarządzany jest wewnątrz komponentu `LoginForm` za pomocą hooka `useState` (lub kilku `useState`). Nie jest wymagany customowy hook — logika jest wystarczająco prosta, aby utrzymać ją w jednym komponencie.

### Zmienne stanu

| Zmienna        | Typ                | Wartość początkowa | Opis                                                               |
| -------------- | ------------------ | ------------------ | ------------------------------------------------------------------ |
| `email`        | `string`           | `""`               | Wartość pola email                                                 |
| `password`     | `string`           | `""`               | Wartość pola hasło                                                 |
| `fieldErrors`  | `LoginFieldErrors` | `{}`               | Błędy walidacji pól (inline)                                       |
| `apiError`     | `string \| null`   | `null`             | Komunikat błędu z API                                              |
| `isSubmitting` | `boolean`          | `false`            | Flaga stanu ładowania (blokada przycisku)                          |
| `showPassword` | `boolean`          | `false`            | Czy hasło jest widoczne                                            |
| `hasSubmitted` | `boolean`          | `false`            | Czy formularz był już raz wysłany (do walidacji w trybie realtime) |

### Przepływ stanu

1. Użytkownik wpisuje dane → aktualizacja `email`/`password`. Jeśli `hasSubmitted === true`, walidacja uruchamiana jest na bieżąco (onChange).
2. Utrata focusu pola (onBlur) → walidacja danego pola, aktualizacja `fieldErrors`.
3. Submit formularza → ustawienie `hasSubmitted = true`, walidacja wszystkich pól, jeśli błędy → aktualizacja `fieldErrors` i brak wywołania API. Jeśli brak błędów → `isSubmitting = true`, `apiError = null`, wywołanie API.
4. Odpowiedź API sukces → `isSubmitting = false`, przekierowanie (`window.location.href`).
5. Odpowiedź API błąd → `isSubmitting = false`, mapowanie kodu błędu na komunikat i ustawienie `apiError`.

## 7. Integracja API

### Endpoint

- **Metoda:** `POST`
- **URL:** `/api/auth/login`
- **Content-Type:** `application/json`

### Żądanie

Typ: `LoginCommand`

```json
{
  "email": "shelter@example.com",
  "password": "SecureP@ssw0rd"
}
```

### Odpowiedź sukces (200 OK)

Typ: Dane użytkownika i profilu (bez tokenów)

```json
{
  "user": {
    "id": "uuid",
    "email": "shelter@example.com"
  },
  "profile": {
    "id": "uuid",
    "status": "verified",
    "role": "shelter"
  }
}
```

**Uwaga:** Tokeny sesji (`access_token`, `refresh_token`) są automatycznie ustawiane jako HttpOnly cookies przez `@supabase/ssr` i **nie pojawiają się w body odpowiedzi**.

### Odpowiedzi błędów

| Status | Kod błędu                              | Znaczenie                                  |
| ------ | -------------------------------------- | ------------------------------------------ |
| 400    | `VALIDATION_ERROR` / `INVALID_REQUEST` | Brakujące lub nieprawidłowe dane wejściowe |
| 401    | `UNAUTHORIZED`                         | Nieprawidłowy email lub hasło              |
| 403    | `ACCOUNT_PENDING`                      | Konto oczekuje na weryfikację              |
| 403    | `ACCOUNT_SUSPENDED`                    | Konto zostało zawieszone                   |
| 429    | `RATE_LIMIT_EXCEEDED`                  | Przekroczono limit prób logowania          |
| 500    | `INTERNAL_ERROR`                       | Błąd wewnętrzny serwera                    |

### Implementacja wywołania

```typescript
const response = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});

if (response.ok) {
  // @supabase/ssr automatycznie zarządza HttpOnly cookies (sb-access-token, sb-refresh-token)
  // poprzez cookie adapter w middleware. Odpowiedź zawiera TYLKO dane użytkownika i profilu.
  const data: { user: { id: string; email: string }; profile: { id: string; status: string; role: string } } =
    await response.json();
  // Przekierowanie na returnUrl lub /dashboard
  window.location.href = returnUrl || "/dashboard";
} else {
  const errorData: ErrorResponse = await response.json();
  // Mapowanie błędu na komunikat
}
```

### Obsługa tokenu po zalogowaniu

Po otrzymaniu odpowiedzi z statusem 200, `@supabase/ssr` automatycznie zarządza ciasteczkami sesji poprzez cookie adapter skonfigurowany w middleware. Biblioteka:

1. **Automatycznie ustawia** HttpOnly cookies (`sb-access-token`, `sb-refresh-token`) gdy storage się zmieni
2. **Automatycznie odświeża** tokeny gdy są bliskie wygaśnięcia
3. **Zarządza chunkowaniem** cookies dla dużych sesji
4. **Używa Base64-URL** encoding dla bezpiecznych wartości

Tokeny **nie są** dostępne dla JavaScript (ochrona przed XSS). Klient otrzymuje **tylko dane użytkownika i profilu** w body odpowiedzi. Po otrzymaniu odpowiedzi sukcesu następuje przekierowanie na `returnUrl` lub `/dashboard` za pomocą `window.location.href`.

## 8. Interakcje użytkownika

| Interakcja                                                | Oczekiwany rezultat                                                                                                                                                   |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wpisywanie tekstu w pole email                            | Aktualizacja stanu `email`. Jeśli formularz był już raz wysłany (`hasSubmitted`), uruchomienie walidacji inline.                                                      |
| Wpisywanie tekstu w pole hasło                            | Aktualizacja stanu `password`. Jeśli formularz był już raz wysłany, walidacja inline.                                                                                 |
| Utrata focusu pola (onBlur)                               | Walidacja danego pola, wyświetlenie komunikatu błędu pod polem jeśli niepoprawne.                                                                                     |
| Kliknięcie przycisku pokaż/ukryj hasło                    | Toggle widoczności hasła (`type="password"` ↔ `type="text"`). Przycisk toggle posiada `aria-label` opisujący akcję.                                                  |
| Kliknięcie przycisku „Zaloguj się" / Enter                | Walidacja wszystkich pól. Jeśli poprawne — wyświetlenie stanu ładowania (spinner/disabled button), wywołanie API. Po odpowiedzi — przekierowanie lub komunikat błędu. |
| Kliknięcie linku „Nie masz konta? Zarejestruj schronisko" | Nawigacja do `/auth/register`.                                                                                                                                        |

## 9. Warunki i walidacja

### Walidacja po stronie klienta (inline)

| Pole  | Warunek                       | Komunikat błędu                         | Kiedy sprawdzane                                   |
| ----- | ----------------------------- | --------------------------------------- | -------------------------------------------------- |
| Email | Pole niepuste                 | „Email jest wymagany"                   | onBlur, onSubmit, onChange (po pierwszym submicie) |
| Email | Poprawny format email (regex) | „Nieprawidłowy format adresu email"     | onBlur, onSubmit, onChange (po pierwszym submicie) |
| Email | Max 255 znaków                | „Email nie może przekraczać 255 znaków" | onBlur, onSubmit, onChange (po pierwszym submicie) |
| Hasło | Pole niepuste                 | „Hasło jest wymagane"                   | onBlur, onSubmit, onChange (po pierwszym submicie) |
| Hasło | Max 128 znaków                | „Hasło nie może przekraczać 128 znaków" | onBlur, onSubmit, onChange (po pierwszym submicie) |

### Walidacja po stronie serwera (z API)

Walidacja po stronie serwera korzysta ze schematu Zod `LoginCommandSchema` (w `src/lib/validation/auth.schemas.ts`), który weryfikuje te same warunki. Odpowiedzi błędów walidacji (400) zawierają szczegóły w polu `details` (`ErrorDetail[]`), które mogą być opcjonalnie zmapowane na błędy pól.

### Wpływ walidacji na stan UI

- Błędy inline pojawiają się pod odpowiednimi polami, pola otrzymują wizualny sygnał błędu (czerwona ramka via `aria-invalid`).
- Błędy walidacji blokują wysłanie formularza (przycisk submit nie wywołuje API).
- Przycisk submit jest wyłączony (`disabled`) podczas `isSubmitting`.

## 10. Obsługa błędów

| Scenariusz                               | Kod API                   | Komunikat dla użytkownika                                                                                       |
| ---------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Nieprawidłowy email lub hasło            | 401 `UNAUTHORIZED`        | „Nieprawidłowy adres email lub hasło. Sprawdź dane i spróbuj ponownie."                                         |
| Konto oczekuje na weryfikację            | 403 `ACCOUNT_PENDING`     | „Twoje konto oczekuje na weryfikację. Skontaktuj się z administracją, jeśli proces trwa dłużej niż oczekiwano." |
| Konto zawieszone                         | 403 `ACCOUNT_SUSPENDED`   | „Twoje konto zostało zawieszone. Skontaktuj się z administracją w celu uzyskania szczegółów."                   |
| Przekroczony limit prób                  | 429 `RATE_LIMIT_EXCEEDED` | „Zbyt wiele prób logowania. Spróbuj ponownie za kilka minut."                                                   |
| Błędy walidacji z API                    | 400 `VALIDATION_ERROR`    | „Sprawdź poprawność wprowadzonych danych." (+ opcjonalnie mapowanie `details` na pola)                          |
| Błąd serwera                             | 500 `INTERNAL_ERROR`      | „Wystąpił błąd serwera. Spróbuj ponownie później."                                                              |
| Błąd sieci / brak połączenia             | N/A (fetch reject)        | „Nie udało się połączyć z serwerem. Sprawdź połączenie internetowe."                                            |
| Nieoczekiwany błąd parsowania odpowiedzi | N/A                       | „Wystąpił nieoczekiwany błąd. Spróbuj ponownie."                                                                |

Wszystkie komunikaty wyświetlane są w komponencie `FormErrorAlert` nad polami formularza z atrybutem `role="alert"`, aby czytniki ekranu automatycznie ogłosiły zmianę (role="alert" implikuje aria-live="assertive").

## 11. Kroki implementacji

1. **Utworzenie pliku strony Astro** — `src/pages/auth/login.astro` z importem `Layout`, komponentem `<main>` centrującym zawartość, i osadzeniem `<LoginForm client:load />`. Odczytanie parametru `return` z `Astro.url.searchParams` i przekazanie do `LoginForm` jako prop `returnUrl`.

2. **Instalacja komponentu Label z shadcn/ui** — Uruchomienie `npx shadcn@latest add label` w celu dodania komponentu `Label` do `src/components/ui/label.tsx`, potrzebnego dla pól formularza.

3. **Utworzenie komponentu `FormErrorAlert`** — `src/components/auth/FormErrorAlert.tsx` — prosty komponent prezentacyjny z propsem `message: string`, renderujący komunikat błędu z atrybutem `role="alert"` (co automatycznie zapewnia odpowiednią dostępność dla czytników ekranu).

4. **Utworzenie komponentu `LoginForm`** — `src/components/auth/LoginForm.tsx`:
   - Zdefiniowanie typów `LoginFieldErrors` i `LoginFormState`.
   - Implementacja stanu formularza (`useState` dla poszczególnych pól i flag).
   - Implementacja funkcji walidacji pól (`validateEmail`, `validatePassword`) odzwierciedlających reguły ze schematu `LoginCommandSchema`.
   - Implementacja handlera `onSubmit` — walidacja, wywołanie `fetch` do `/api/auth/login`, obsługa odpowiedzi (sukces → redirect, błąd → mapowanie kodu na komunikat). Tokeny są automatycznie zapisywane jako HttpOnly cookies przez serwer.
   - Implementacja handlerów `onChange` i `onBlur` dla pól.
   - Toggle widoczności hasła (przycisk z ikoną oka).
   - Renderowanie: `Card` > `CardHeader` > formularz z polami > `CardFooter` z przyciskiem submit i linkiem do rejestracji.
   - Zapewnienie dostępności: `htmlFor`/`id` na etykietach, `aria-describedby` łączący pola z komunikatami błędów, `aria-invalid` na polach z błędami, `role="alert"` na komunikatach.

5. **Dodanie rate limitera do endpointu login** — W pliku `src/pages/api/auth/login.ts` dodać konfigurację rate limitera (5 prób / 15 min / IP) z wykorzystaniem istniejącej klasy `RateLimiter`. Dodać odpowiednią konfigurację do `src/lib/config.ts` w sekcji `RATE_LIMITING`:

   ```typescript
   LOGIN: {
     windowMs: 15 * 60 * 1000, // 15 minutes
     maxRequests: 5,
   }
   ```

6. **~~Wspólny helper dla ciasteczek~~** — ❌ **NIE JEST POTRZEBNY**: `@supabase/ssr` automatycznie zarządza ciasteczkami przez cookie adapter skonfigurowany w middleware. Biblioteka sama ustawia i odświeża `sb-access-token` i `sb-refresh-token` bez potrzeby ręcznej logiki.

7. **Styling i responsywność** — Zastosowanie klas Tailwind do centrowania formularza, odpowiedniej szerokości karty (`max-w-md`, `w-full`), spacingu i responsywnego layoutu. Zapewnienie poprawnego wyświetlania na urządzeniach mobilnych.

8. **Testy ręczne** — Weryfikacja scenariuszy:
   - Poprawne logowanie → redirect.
   - Nieprawidłowe dane → komunikat błędu 401.
   - Konto `pending` → komunikat 403.
   - Konto `suspended` → komunikat 403.
   - Walidacja inline pól (puste pola, zły format email).
   - Toggle widoczności hasła.
   - Nawigacja klawiaturą (Tab, Enter).
   - Dostępność czytnikiem ekranu (komunikaty ARIA).
