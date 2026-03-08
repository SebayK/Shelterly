# Plan implementacji widoku Oczekiwanie na weryfikację

## 1. Przegląd

Widok „Oczekiwanie na weryfikację" (`/auth/pending`) to statyczna strona informacyjna wyświetlana schroniskom, których konto ma status `pending`. Jej celem jest potwierdzenie pomyślnej rejestracji oraz poinformowanie użytkownika o trwającym procesie weryfikacji przez administratora. Strona nie zawiera elementów interaktywnych wymagających Reacta — jest w pełni renderowana po stronie serwera jako komponent Astro. Widok jest dostępny publicznie, ale nie ujawnia żadnych szczegółów konta użytkownika.

## 2. Routing widoku

- **Ścieżka:** `/auth/pending`
- **Plik:** `src/pages/auth/pending.astro`
- **Prerender:** `false` (strona dynamiczna SSR — wymaga dostępu do `Astro.locals.supabase` w celu opcjonalnego server-side redirect zalogowanych użytkowników ze statusem `verified`)
- **Dostępność:** Strona publiczna, brak wymogu autentykacji
- **Guardy nawigacyjne:**
  - Jeśli zalogowany użytkownik ma status `verified` → redirect do `/dashboard`
  - Jeśli zalogowany użytkownik ma rolę `super_admin` → redirect do `/admin`
  - W pozostałych przypadkach (anonimowy, pending, suspended, rejected) → renderowanie strony

## 3. Struktura komponentów

```
Layout.astro
└── pending.astro (strona)
    ├── Ikona statusu (Clock SVG, inline)
    ├── Nagłówek h1
    ├── Tekst informacyjny (paragrafy)
    └── Link/przycisk „Wróć na stronę główną"
```

Widok składa się wyłącznie z jednego pliku strony Astro (`pending.astro`), który korzysta z istniejącego layoutu `Layout.astro`. Nie wymaga tworzenia nowych komponentów React ani dodatkowych komponentów Astro.

## 4. Szczegóły komponentów

### `pending.astro`

- **Opis:** Strona Astro renderowana po stronie serwera. Wyświetla centrowany komunikat o oczekiwaniu na weryfikację konta schroniska. Używa layoutu `Layout.astro`, który zapewnia nawigację (`Navbar`), skip-to-content link oraz meta tagi.
- **Główne elementy HTML:**
  - `<section>` jako kontener centrujący treść (flexbox, `min-h-[calc(100vh-3.5rem)]` aby uwzględnić navbar h-14)
  - `<div>` wewnętrzny kontener z ograniczoną szerokością (`max-w-md`) i paddingiem
  - Inline SVG ikony zegara (Clock z Lucide Icons, `aria-hidden="true"`) — wzorowany na implementacji w `StatusBanner.astro`
  - `<h1>` — nagłówek „Konto oczekuje na weryfikację"
  - `<p>` — akapit z informacją o procesie weryfikacji i oczekiwanym czasie
  - `<a>` — link stylizowany jako przycisk „Wróć na stronę główną" (href="/")
- **Obsługiwane interakcje:**
  - Kliknięcie linku „Wróć na stronę główną" → nawigacja do strony głównej (`/`)
  - Brak innych interakcji — strona jest w pełni statyczna po renderowaniu
- **Obsługiwana walidacja:**
  - Server-side: sprawdzenie sesji użytkownika i statusu profilu w celu warunkowego redirectu (verified → `/dashboard`, super_admin → `/admin`)
  - Brak walidacji formularzy — strona nie zawiera formularzy
- **Typy:**
  - Brak nowych typów — korzysta wyłącznie z istniejących typów z `Layout.astro` (interfejs `Props` z `title`)
- **Propsy:**
  - Nie dotyczy — jest to strona, nie komponent wielokrotnego użytku. Przekazuje `title` do `Layout.astro`.

## 5. Typy

Widok nie wymaga definiowania nowych typów ani modeli ViewModel. Wykorzystuje wyłącznie istniejące typy:

- **`NavbarUser`** (z `src/types.ts`) — używany wewnętrznie przez `Layout.astro` do renderowania nawigacji
- **`ShelterStatus`** (z `src/types.ts`) — typ enum `"pending" | "verified" | "suspended" | "rejected"`, wykorzystywany do logiki server-side redirect w frontmatterze strony
- **`UserRole`** (z `src/types.ts`) — typ enum `"shelter" | "super_admin"`, wykorzystywany w logice redirect

Nie ma potrzeby tworzenia dedykowanych DTO ani ViewModel, ponieważ strona nie pobiera ani nie wyświetla dynamicznych danych — jedynie statyczny komunikat informacyjny.

## 6. Zarządzanie stanem

Widok nie wymaga zarządzania stanem po stronie klienta. Cała logika warunkowa (redirect na podstawie statusu) jest realizowana w frontmatterze Astro po stronie serwera, przed renderowaniem HTML. Strona nie używa React islands, hooków ani kontekstu.

## 7. Integracja API

Widok nie komunikuje się z żadnym dedykowanym endpointem API. Jedyna interakcja z backendem odbywa się w frontmatterze strony za pomocą Supabase SDK:

1. **`supabase.auth.getUser()`** — pobranie aktualnie zalogowanego użytkownika z kontekstu sesji (cookies)
   - Typ odpowiedzi: `{ data: { user: User | null }, error: AuthError | null }`
2. **`supabase.from("profiles").select("status, role").eq("id", user.id).single()`** — pobranie statusu i roli profilu zalogowanego użytkownika
   - Typ odpowiedzi: `{ data: { status: ShelterStatus, role: UserRole } | null, error: PostgrestError | null }`

Te wywołania służą wyłącznie do logiki redirect i nie wpływają na treść renderowanej strony.

## 8. Interakcje użytkownika

| Interakcja                           | Element                             | Rezultat                                     |
| ------------------------------------ | ----------------------------------- | -------------------------------------------- |
| Kliknięcie „Wróć na stronę główną"   | Link `<a href="/">`                 | Nawigacja do strony głównej (mapa schronisk) |
| Kliknięcie logo „Shelterly" w Navbar | Link w `Navbar.astro`               | Nawigacja do strony głównej                  |
| Kliknięcie linków auth w Navbar      | Linki „Zaloguj się" / „Zarejestruj" | Nawigacja do odpowiednich stron auth         |

Strona nie zawiera formularzy, przycisków akcji ani elementów wymagających JavaScript.

## 9. Warunki i walidacja

### Warunki server-side (frontmatter)

| Warunek                                                                | Weryfikacja                      | Wpływ na UI                                                 |
| ---------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------- |
| Użytkownik zalogowany ze statusem `verified`                           | `profile.status === "verified"`  | Redirect 302 do `/dashboard` — strona nie jest renderowana  |
| Użytkownik zalogowany z rolą `super_admin`                             | `profile.role === "super_admin"` | Redirect 302 do `/admin` — strona nie jest renderowana      |
| Użytkownik zalogowany ze statusem `pending` / `suspended` / `rejected` | Sprawdzenie statusu profilu      | Strona jest renderowana normalnie                           |
| Użytkownik anonimowy (brak sesji)                                      | `!user` po `getUser()`           | Strona jest renderowana normalnie                           |
| Błąd autentykacji                                                      | `error` w odpowiedzi `getUser()` | Logowanie błędu do konsoli, renderowanie strony (fail-open) |
| Błąd pobrania profilu                                                  | `profileError`                   | Logowanie błędu, renderowanie strony (fail-open)            |

### Warunki client-side

Brak — strona jest w pełni statyczna po renderowaniu SSR.

## 10. Obsługa błędów

| Scenariusz                                                             | Obsługa                                                                                                                   |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Błąd `supabase.auth.getUser()`                                         | Logowanie błędu na serwerze (`console.error`), kontynuacja renderowania strony (użytkownik widzi komunikat o weryfikacji) |
| Błąd pobrania profilu z bazy                                           | Logowanie błędu, kontynuacja renderowania (bezpieczne zachowanie — wyświetlenie strony pending jest lepsze niż błąd)      |
| Brak klienta Supabase w `locals`                                       | Logowanie błędu, kontynuacja renderowania strony                                                                          |
| Użytkownik wchodzi bezpośrednio na URL `/auth/pending` bez rejestracji | Strona renderowana normalnie — ogólny komunikat nie ujawnia informacji o koncie                                           |

Strategia obsługi błędów to **fail-open**: w przypadku problemów z Supabase strona jest renderowana ze statyczną treścią. Jest to bezpieczne, ponieważ strona nie ujawnia żadnych wrażliwych danych.

## 11. Kroki implementacji

1. **Utworzenie pliku strony** `src/pages/auth/pending.astro` z dyrektywą `export const prerender = false`.

2. **Implementacja logiki frontmatter:**
   - Import layoutu `Layout.astro`
   - Pobranie sesji użytkownika przez `Astro.locals.supabase.auth.getUser()`
   - Jeśli użytkownik jest zalogowany — pobranie profilu (`status`, `role`) z tabeli `profiles`
   - Implementacja logiki redirect:
     - `role === "super_admin"` → `Astro.redirect("/admin")`
     - `status === "verified"` → `Astro.redirect("/dashboard")`
   - Obsługa błędów z logowaniem do konsoli

3. **Implementacja szablonu HTML:**
   - Opakowanie w `<Layout title="Oczekiwanie na weryfikację — Shelterly">`
   - Sekcja centrująca (`flex`, `items-center`, `justify-center`, `min-h-[calc(100vh-3.5rem)]`)
   - Kontener treści z `max-w-md`, `text-center`, padding
   - Inline SVG ikony zegara (Lucide Clock, rozmiar 48x48, kolor `text-muted-foreground`, `aria-hidden="true"`)
   - `<h1>` z tekstem „Konto oczekuje na weryfikację" (klasy: `text-2xl font-bold tracking-tight text-foreground`)
   - `<p>` z informacją: „Dziękujemy za rejestrację w Shelterly. Twoje konto jest obecnie weryfikowane przez nasz zespół. Proces weryfikacji trwa zwykle do 24 godzin roboczych. Po zweryfikowaniu konta uzyskasz pełny dostęp do zarządzania potrzebami schroniska." (klasy: `text-muted-foreground text-sm`)
   - Link `<a href="/">` stylizowany jako przycisk (klasy spójne z design system — `inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors`) z tekstem „Wróć na stronę główną"

4. **Weryfikacja dostępności:**
   - Upewnienie się, że `<h1>` jest jedynym nagłówkiem na stronie
   - Ikona SVG ma `aria-hidden="true"`
   - Link „Wróć na stronę główną" jest czytelny dla czytników ekranu
   - Kontrast kolorów spełnia WCAG AA

5. **Testy manualne:**
   - Weryfikacja redirectu dla zalogowanego użytkownika ze statusem `verified`
   - Weryfikacja redirectu dla użytkownika `super_admin`
   - Weryfikacja renderowania dla użytkownika anonimowego
   - Weryfikacja renderowania dla użytkownika ze statusem `pending`
   - Weryfikacja responsywności na urządzeniach mobilnych
   - Weryfikacja poprawnego wyświetlania Navbar (anonimowy vs zalogowany)
