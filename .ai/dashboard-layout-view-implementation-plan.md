# Plan implementacji widoku Dashboard Layout i Nawigacji

## 1. Przegląd

Widok obejmuje stworzenie systemu layoutów i nawigacji aplikacji Shelterly. Główne elementy to:

- **`Navbar.astro`** — sticky nawigacja wyświetlana na wszystkich stronach, renderowana warunkowo SSR na podstawie stanu sesji i roli użytkownika. Dla anonimowych: linki auth. Dla zalogowanych: avatar z interaktywnym dropdown menu (React island). Na mobile: hamburger menu.
- **`Layout.astro`** (aktualizacja) — layout główny wzbogacony o Navbar, skip-to-content link i `lang="pl"`.
- **`DashboardLayout.astro`** — layout dashboardu z Navbar, warunkowym StatusBanner, desktop sidebar (220px), mobile bottom navigation bar i headerem dashboardu (nazwa schroniska, badge statusu, licznik AI).
- **`StatusBanner.astro`** — warunkowy baner informujący o statusie konta (pending/suspended/rejected). Renderowany SSR — brak flashu.

Wszystkie layouty i komponenty nawigacyjne są komponentami Astro (SSR, zero JS), z wyjątkiem elementów wymagających interaktywności (dropdown menu, hamburger menu), które są wyspami React.

## 2. Routing widoku

Komponenty layoutu i nawigacji nie definiują własnych tras — są wykorzystywane przez strony:

| Ścieżka | Layout | Wymaganie auth |
|---|---|---|
| `/` | `Layout.astro` | Brak |
| `/shelter/[id]` | `Layout.astro` | Brak |
| `/auth/login` | `Layout.astro` | Brak (redirect zalogowanego → `/dashboard`) |
| `/auth/register` | `Layout.astro` | Brak (redirect zalogowanego → `/dashboard`) |
| `/auth/pending` | `Layout.astro` | Brak |
| `/dashboard` | `DashboardLayout.astro` | Sesja wymagana → `/auth/login?return=/dashboard` |
| `/dashboard/profile` | `DashboardLayout.astro` | Sesja wymagana → `/auth/login?return=/dashboard/profile` |
| `/admin` | `Layout.astro` | Sesja + `super_admin` |

Aplikacja działa w trybie `output: "server"` (SSR), więc `Astro.locals.supabase` jest dostępny na każdej stronie. Strony mogą opcjonalnie ustawić `prerender = true` (np. strona 404).

## 3. Struktura komponentów

```
Layout.astro (layout główny)
├── <a> skip-to-content
├── Navbar.astro
│   ├── Logo (link do /)
│   ├── [Desktop] Linki auth (anonimowy) LUB UserAvatarMenu.tsx (zalogowany)
│   └── [Mobile] MobileNavMenu.tsx
├── <main id="main-content">
│   └── <slot /> (treść strony)
└── opcjonalna stopka

DashboardLayout.astro (layout dashboardu)
├── <a> skip-to-content
├── Navbar.astro (z danymi użytkownika)
├── StatusBanner.astro (warunkowy, jeśli status ≠ verified)
├── DashboardHeader.astro (nazwa, badge statusu, licznik AI)
├── <div> flex container
│   ├── DashboardSidebar.astro [Desktop, hidden na mobile]
│   │   └── <nav> z linkami (Potrzeby, Profil)
│   └── <main id="main-content">
│       └── <slot /> (treść strony)
└── DashboardBottomNav.astro [Mobile, hidden na desktop]
    └── <nav> z ikonami i etykietami (Potrzeby, Profil)
```

## 4. Szczegóły komponentów

### 4.1. `Navbar.astro`

- **Opis:** Sticky nawigacja górna (h-14, 56px) renderowana SSR. Warunkowo wyświetla linki auth dla użytkowników anonimowych lub avatar z dropdown menu dla zalogowanych. Na mobile wyświetla hamburger menu zamiast linków desktopowych.
- **Główne elementy:**
  - `<header>` z klasami `sticky top-0 z-50 h-14 border-b bg-background`
  - Wewnątrz `<nav>` z `aria-label="Nawigacja główna"` i kontenerem flex
  - Logo „Shelterly" jako `<a href="/">` po lewej
  - Sekcja desktopowa (`hidden md:flex`):
    - Anonimowy: dwa `<a>` — „Zaloguj się" i „Zarejestruj schronisko"
    - Zalogowany shelter: `<UserAvatarMenu>` (React island `client:load`)
    - Zalogowany super_admin: `<UserAvatarMenu>` z odpowiednimi opcjami
  - Sekcja mobilna (`md:hidden`):
    - `<MobileNavMenu>` (React island `client:load`)
- **Obsługiwane interakcje:** Kliknięcie logo → nawigacja do `/`. Kliknięcie linków auth → nawigacja do odpowiednich stron. Interakcje dropdown i hamburger delegowane do React islands.
- **Obsługiwana walidacja:** Brak — komponent prezentacyjny.
- **Typy:**
  - `NavbarUser` (nowy typ ViewModel)
- **Propsy:**
  ```typescript
  interface NavbarProps {
    user: NavbarUser | null;
  }
  ```

### 4.2. `UserAvatarMenu.tsx`

- **Opis:** Interaktywna wyspa React renderująca avatar użytkownika z rozwijanym menu (Shadcn/ui `DropdownMenu`). Zawiera inicjały użytkownika w awatarze i odpowiednie pozycje menu zależne od roli.
- **Główne elementy:**
  - `Avatar` + `AvatarFallback` z inicjałami (2 pierwsze litery nazwy schroniska)
  - `DropdownMenu` z `DropdownMenuTrigger` (avatar), `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`
  - Pozycje dla roli `shelter`: „Dashboard" (`/dashboard`), „Profil" (`/dashboard/profile`), separator, „Wyloguj się"
  - Pozycje dla roli `super_admin`: „Panel admina" (`/admin`), separator, „Wyloguj się"
- **Obsługiwane interakcje:**
  - Kliknięcie avatara → otwarcie dropdown menu
  - Kliknięcie pozycji nawigacyjnych → nawigacja (`window.location.href`)
  - Kliknięcie „Wyloguj się" → `fetch('/api/auth/logout', { method: 'POST' })` → redirect na `/auth/login`
- **Obsługiwana walidacja:** Brak.
- **Typy:**
  - `UserAvatarMenuProps`
  - `UserRole` (z `src/types.ts`)
- **Propsy:**
  ```typescript
  interface UserAvatarMenuProps {
    name: string | null;
    role: UserRole;
  }
  ```

### 4.3. `MobileNavMenu.tsx`

- **Opis:** Interaktywna wyspa React dla nawigacji mobilnej. Renderuje przycisk hamburger, który otwiera boczny panel (Shadcn/ui `Sheet`) z linkami nawigacyjnymi odpowiednimi dla roli użytkownika.
- **Główne elementy:**
  - `Button` (wariant `ghost`, rozmiar `icon`) z ikoną `Menu` (Lucide)
  - `Sheet` z `SheetTrigger`, `SheetContent` (side `right`), `SheetHeader`, `SheetTitle`
  - Lista linków nawigacyjnych w `<nav>`:
    - Anonimowy: „Zaloguj się", „Zarejestruj schronisko"
    - Shelter: „Dashboard", „Profil", „Wyloguj się"
    - Super admin: „Panel admina", „Wyloguj się"
- **Obsługiwane interakcje:**
  - Kliknięcie hamburger → otwarcie Sheet
  - Kliknięcie linku nawigacyjnego → nawigacja + zamknięcie Sheet
  - Kliknięcie „Wyloguj się" → POST `/api/auth/logout` → redirect
  - Zamknięcie Sheet: klik poza, Escape, przycisk zamknięcia
- **Obsługiwana walidacja:** Brak.
- **Typy:**
  - `MobileNavMenuProps`
  - `NavbarUser` (z nowych typów)
- **Propsy:**
  ```typescript
  interface MobileNavMenuProps {
    user: NavbarUser | null;
  }
  ```

### 4.4. `Layout.astro` (aktualizacja)

- **Opis:** Layout główny aplikacji. Aktualizacja obejmuje: dodanie `Navbar.astro`, zmianę `lang="en"` na `lang="pl"`, dodanie skip-to-content link i slotu na treść z odpowiednim `id`.
- **Główne elementy:**
  - `<html lang="pl">`
  - `<a href="#main-content">` — skip-to-content link (wizualnie ukryty, widoczny na focus)
  - `<Navbar user={user} />` — komponent nawigacji
  - `<main id="main-content">` z `<slot />`
- **Obsługiwane interakcje:** Brak bezpośrednich — nawigacja delegowana do Navbar.
- **Obsługiwana walidacja:** Brak.
- **Typy:** `NavbarUser`
- **Propsy:**
  ```typescript
  interface LayoutProps {
    title?: string;
    withLeaflet?: boolean;
  }
  ```
  Dane użytkownika pobierane wewnętrznie w frontmatter przez `supabase.auth.getUser()`.

### 4.5. `DashboardLayout.astro`

- **Opis:** Layout dashboardu z pełną strukturą nawigacji bocznej (desktop) i dolnej (mobile). Zawiera Navbar, warunkowy StatusBanner, header dashboardu z informacjami o koncie i slot na treść strony. Wymaga uwierzytelnionego użytkownika — w przypadku braku sesji przekierowuje na `/auth/login`.
- **Główne elementy:**
  - `<html lang="pl">` z meta tagami i global CSS
  - Skip-to-content link `<a href="#main-content">`
  - `<Navbar user={navbarUser} />`
  - `<StatusBanner status={profile.status} />` (warunkowo, jeśli status ≠ `verified`)
  - `<DashboardHeader>` z nazwą schroniska, badge statusu konta, licznikiem AI
  - `<div class="flex min-h-[calc(100vh-56px)]">` — kontener flex
    - `<DashboardSidebar currentPath={currentPath} />` (desktop, `hidden md:block`)
    - `<main id="main-content" class="flex-1">` z `<slot />`
  - `<DashboardBottomNav currentPath={currentPath} />` (mobile, `md:hidden`)
- **Obsługiwane interakcje:** Nawigacja przez sidebar/bottom nav — kliknięcie linków.
- **Obsługiwana walidacja:** Guard auth — brak sesji → redirect. Dane profilu pobierane z Supabase.
- **Typy:** `ProfileMeDTO`, `NavbarUser`
- **Propsy:**
  ```typescript
  interface DashboardLayoutProps {
    title?: string;
  }
  ```
  Dane użytkownika i profilu pobierane wewnętrznie w frontmatter.

### 4.6. `StatusBanner.astro`

- **Opis:** Warunkowy baner informujący o statusie konta schroniska. Renderowany SSR — brak flashu niechcianego contentu. Wyświetlany tylko dla statusów `pending`, `suspended` i `rejected`. Przy statusie `verified` nie renderuje żadnego HTML.
- **Główne elementy:**
  - `<div role="alert">` z odpowiednimi klasami kolorystycznymi Tailwind:
    - `pending` → żółte tło (`bg-yellow-50 border-yellow-200 text-yellow-800`), ikona `Clock`, komunikat o oczekiwaniu na weryfikację
    - `suspended` → czerwone tło (`bg-red-50 border-red-200 text-red-800`), ikona `Ban`, komunikat o zawieszeniu konta
    - `rejected` → czerwone tło (`bg-red-50 border-red-200 text-red-800`), ikona `XCircle`, komunikat o odrzuceniu
  - Ikona Lucide (inline SVG, bez JavaScript) po lewej
  - Tekst komunikatu po prawej
- **Obsługiwane interakcje:** Brak — komponent czysto informacyjny.
- **Obsługiwana walidacja:** Brak.
- **Typy:** `ShelterStatus` (z `src/types.ts`)
- **Propsy:**
  ```typescript
  interface StatusBannerProps {
    status: ShelterStatus;
  }
  ```

### 4.7. `DashboardSidebar.astro`

- **Opis:** Sidebar nawigacyjny dla desktopowej wersji dashboardu. Stała szerokość 220px po lewej stronie. Zawiera linki nawigacyjne z wizualnym wyróżnieniem aktywnej pozycji.
- **Główne elementy:**
  - `<aside class="hidden md:block w-[220px] border-r bg-background">` — ukryty na mobile
  - `<nav aria-label="Nawigacja dashboardu">` z listą linków
  - Link „Potrzeby" (`/dashboard`) z ikoną `ClipboardList`
  - Link „Profil" (`/dashboard/profile`) z ikoną `User`
  - Aktywna pozycja: `aria-current="page"` + wyróżnienie wizualne (tło `bg-accent`, font bold)
- **Obsługiwane interakcje:** Kliknięcie linku → nawigacja do odpowiedniej strony.
- **Obsługiwana walidacja:** Brak.
- **Typy:** Brak.
- **Propsy:**
  ```typescript
  interface DashboardSidebarProps {
    currentPath: string;
  }
  ```

### 4.8. `DashboardBottomNav.astro`

- **Opis:** Dolny pasek nawigacyjny dla mobilnej wersji dashboardu. Stały na dole ekranu (h-16, 64px) z ikonami i etykietami tekstowymi.
- **Główne elementy:**
  - `<nav class="md:hidden fixed bottom-0 inset-x-0 h-16 border-t bg-background z-50" aria-label="Nawigacja dashboardu">`
  - Dwa linki w kontenerze flex:
    - „Potrzeby" (`/dashboard`) z ikoną `ClipboardList` i etykietą
    - „Profil" (`/dashboard/profile`) z ikoną `User` i etykietą
  - Aktywna pozycja: `aria-current="page"` + kolor `text-primary` (vs `text-muted-foreground`)
- **Obsługiwane interakcje:** Kliknięcie ikony/etykiety → nawigacja.
- **Obsługiwana walidacja:** Brak.
- **Typy:** Brak.
- **Propsy:**
  ```typescript
  interface DashboardBottomNavProps {
    currentPath: string;
  }
  ```

### 4.9. `DashboardHeader.astro`

- **Opis:** Nagłówek dashboardu wyświetlający nazwę schroniska, badge statusu konta i licznik wykorzystania AI. Renderowany SSR na podstawie danych profilu.
- **Główne elementy:**
  - `<header class="border-b px-6 py-4">` jako kontener
  - `<h1>` z nazwą schroniska (lub „Dashboard" jako fallback)
  - `Badge` (Shadcn/ui, statyczny import — renderowany jako HTML) z odpowiednim wariantem:
    - `verified` → zielony badge „Zweryfikowane"
    - `pending` → żółty badge „Oczekuje"
    - `suspended` → czerwony badge „Zawieszone"
    - `rejected` → czerwony badge „Odrzucone"
  - Licznik AI: „Użycia AI: {ai_usage_count}/{AI_USAGE_LIMIT}" jako `<span>` z ikoną `Sparkles`
- **Obsługiwane interakcje:** Brak — komponent prezentacyjny.
- **Obsługiwana walidacja:** Brak.
- **Typy:** `ShelterStatus`, `ProfileMeDTO`
- **Propsy:**
  ```typescript
  interface DashboardHeaderProps {
    name: string | null;
    status: ShelterStatus;
    aiUsageCount: number;
  }
  ```

## 5. Typy

### 5.1. Nowe typy ViewModel (do dodania w `src/types.ts`)

```typescript
/**
 * ViewModel dla komponentu Navbar — dane użytkownika potrzebne do nawigacji.
 * Przekazywany z layoutów Astro do Navbar i dalej do React islands.
 */
export interface NavbarUser {
  /** Nazwa schroniska (lub null dla super_admin bez nazwy) */
  name: string | null;
  /** Rola użytkownika: 'shelter' | 'super_admin' */
  role: UserRole;
}
```

### 5.2. Interfejsy propsów komponentów React

```typescript
/**
 * Propsy dla UserAvatarMenu — React island dropdown menu avatara
 */
export interface UserAvatarMenuProps {
  /** Nazwa schroniska do wyświetlenia inicjałów w awatarze */
  name: string | null;
  /** Rola użytkownika determinująca pozycje menu */
  role: UserRole;
}

/**
 * Propsy dla MobileNavMenu — React island menu hamburger
 */
export interface MobileNavMenuProps {
  /** Dane użytkownika lub null dla anonimowego */
  user: NavbarUser | null;
}
```

### 5.3. Istniejące typy wykorzystywane

- **`ProfileMeDTO`** — pełny profil zalogowanego użytkownika (z `src/types.ts`). Używany w `DashboardLayout.astro` do pobrania danych nagłówka i statusu.
- **`ShelterStatus`** — enum statusu konta (`"pending" | "verified" | "suspended" | "rejected"`). Używany w `StatusBanner.astro` i `DashboardHeader.astro`.
- **`UserRole`** — enum roli (`"shelter" | "super_admin"`). Używany w `Navbar.astro` i `UserAvatarMenu.tsx`.
- **`LogoutResponseDTO`** — odpowiedź endpointu logout (`{ message: string }`). Używany w `UserAvatarMenu.tsx` i `MobileNavMenu.tsx`.

## 6. Zarządzanie stanem

Nawigacja i layouty w przeważającej części opierają się na **renderowaniu SSR** — dane użytkownika i profilu pobierane są po stronie serwera w frontmatter Astro i przekazywane jako propsy do komponentów. Dzięki temu nie ma flashów nieautoryzowanego contentu ani potrzeby zarządzania stanem sesji po stronie klienta.

### 6.1. Stan serwerowy (Astro frontmatter)

W `Layout.astro` i `DashboardLayout.astro`, frontmatter pobiera dane:
1. `supabase.auth.getUser()` — sprawdzenie sesji
2. Jeśli sesja istnieje: zapytanie `profiles` o `role` i `name` (dla Navbar)
3. W `DashboardLayout.astro`: pełne dane profilu przez `ProfileService.getAuthenticatedProfile(userId)` (dla nagłówka, banera)

### 6.2. Stan kliencki (React islands)

- **`UserAvatarMenu`**: jedyny stan to `open` (otwarty/zamknięty dropdown) — zarządzany wewnętrznie przez Radix UI `DropdownMenu`. Brak customowego hooka.
- **`MobileNavMenu`**: stan `open` (otwarty/zamknięty Sheet) — zarządzany przez Radix UI `Sheet`. Brak customowego hooka.
- **Akcja wylogowania**: stan `isLoggingOut` (boolean) w obu komponentach — `useState` do wyświetlenia loading state podczas żądania `POST /api/auth/logout`.

### 6.3. Custom hooki

Nie jest wymagany żaden nowy custom hook dla tego widoku. Obie wyspy React mają minimalny stan zarządzany lokalnie (`useState`).

## 7. Integracja API

### 7.1. Pobieranie danych użytkownika (SSR — Astro frontmatter)

**W `Layout.astro`:**
```typescript
const { data: { user } } = await Astro.locals.supabase.auth.getUser();
let navbarUser: NavbarUser | null = null;

if (user) {
  const { data: profile } = await Astro.locals.supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .single();

  if (profile) {
    navbarUser = { name: profile.name, role: profile.role };
  }
}
```

**W `DashboardLayout.astro`:**
```typescript
const { data: { user }, error } = await Astro.locals.supabase.auth.getUser();

if (error || !user) {
  return Astro.redirect(`/auth/login?return=${Astro.url.pathname}`);
}

const profileService = new ProfileService(Astro.locals.supabase);
const profile: ProfileMeDTO = await profileService.getAuthenticatedProfile(user.id);
```

### 7.2. Wylogowanie (klient — React island)

**Endpoint:** `POST /api/auth/logout`

**Typ żądania:** Brak body
**Typ odpowiedzi:** `LogoutResponseDTO` (`{ message: string }`)
**Kody błędów:** `401 UNAUTHORIZED`, `500 INTERNAL_ERROR`

**Implementacja w React:**
```typescript
const handleLogout = async () => {
  setIsLoggingOut(true);
  try {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (response.ok) {
      window.location.href = "/auth/login";
    }
  } catch {
    // Redirect mimo błędu — sesja po stronie serwera mogła zostać usunięta
    window.location.href = "/auth/login";
  }
};
```

## 8. Interakcje użytkownika

| Interakcja | Komponent | Oczekiwany wynik |
|---|---|---|
| Kliknięcie logo „Shelterly" | `Navbar.astro` | Nawigacja do `/` (strona główna) |
| Kliknięcie „Zaloguj się" | `Navbar.astro` | Nawigacja do `/auth/login` |
| Kliknięcie „Zarejestruj schronisko" | `Navbar.astro` | Nawigacja do `/auth/register` |
| Kliknięcie avatara (desktop) | `UserAvatarMenu.tsx` | Otwarcie dropdown menu z opcjami |
| Kliknięcie „Dashboard" w dropdown | `UserAvatarMenu.tsx` | Nawigacja do `/dashboard` |
| Kliknięcie „Profil" w dropdown | `UserAvatarMenu.tsx` | Nawigacja do `/dashboard/profile` |
| Kliknięcie „Panel admina" w dropdown | `UserAvatarMenu.tsx` | Nawigacja do `/admin` (tylko super_admin) |
| Kliknięcie „Wyloguj się" w dropdown | `UserAvatarMenu.tsx` | POST `/api/auth/logout`, loading state, redirect do `/auth/login` |
| Kliknięcie hamburger (mobile) | `MobileNavMenu.tsx` | Otwarcie bocznego panelu Sheet |
| Kliknięcie linku w Sheet | `MobileNavMenu.tsx` | Nawigacja + zamknięcie Sheet |
| Kliknięcie „Wyloguj się" w Sheet | `MobileNavMenu.tsx` | POST `/api/auth/logout`, loading state, redirect |
| Kliknięcie poza Sheet / Escape | `MobileNavMenu.tsx` | Zamknięcie panelu |
| Kliknięcie „Potrzeby" w sidebar | `DashboardSidebar.astro` | Nawigacja do `/dashboard` |
| Kliknięcie „Profil" w sidebar | `DashboardSidebar.astro` | Nawigacja do `/dashboard/profile` |
| Kliknięcie ikony „Potrzeby" (bottom nav) | `DashboardBottomNav.astro` | Nawigacja do `/dashboard` |
| Kliknięcie ikony „Profil" (bottom nav) | `DashboardBottomNav.astro` | Nawigacja do `/dashboard/profile` |
| Tab na skip-to-content link | `Layout.astro` / `DashboardLayout.astro` | Focus przeniesiony na `#main-content` |

## 9. Warunki i walidacja

### 9.1. Guard autentykacji (DashboardLayout)

- **Warunek:** Użytkownik musi mieć aktywną sesję (cookie Supabase Auth)
- **Komponent:** `DashboardLayout.astro` (frontmatter)
- **Weryfikacja:** `supabase.auth.getUser()` — jeśli błąd lub brak użytkownika → `Astro.redirect('/auth/login?return={currentPath}')`
- **Wpływ na UI:** Strona nie jest renderowana; użytkownik natychmiast przekierowany

### 9.2. Warunkowe renderowanie Navbar

- **Warunek:** Obecność/brak `navbarUser` (null vs objekt)
- **Komponent:** `Navbar.astro`
- **Weryfikacja:** Sprawdzenie `user !== null` w template Astro
- **Wpływ na UI:**
  - `null` → linki „Zaloguj się" / „Zarejestruj schronisko"
  - Obiekt z `role: "shelter"` → avatar z menu Dashboard/Profil/Wyloguj
  - Obiekt z `role: "super_admin"` → avatar z menu Panel admina/Wyloguj

### 9.3. Warunkowe renderowanie StatusBanner

- **Warunek:** Status konta ≠ `verified`
- **Komponent:** `DashboardLayout.astro` → `StatusBanner.astro`
- **Weryfikacja:** `profile.status !== "verified"` w template Astro
- **Wpływ na UI:**
  - `pending` → żółty baner z komunikatem o oczekiwaniu
  - `suspended` → czerwony baner z komunikatem o zawieszeniu
  - `rejected` → czerwony baner z komunikatem o odrzuceniu
  - `verified` → brak banera (komponent nie renderuje HTML)

### 9.4. Aktywna pozycja nawigacji

- **Warunek:** Bieżąca ścieżka URL pasuje do linku
- **Komponenty:** `DashboardSidebar.astro`, `DashboardBottomNav.astro`
- **Weryfikacja:** `Astro.url.pathname === '/dashboard'` (lub `.startsWith()` dla podścieżek)
- **Wpływ na UI:** Aktywny link otrzymuje `aria-current="page"`, wyróżnione tło i bold font

### 9.5. Pozycje menu dropdown zależne od roli

- **Warunek:** `role === "shelter"` vs `role === "super_admin"`
- **Komponent:** `UserAvatarMenu.tsx`
- **Weryfikacja:** Warunkowe renderowanie w JSX na podstawie propsa `role`
- **Wpływ na UI:** Różne pozycje menu dla każdej roli

## 10. Obsługa błędów

### 10.1. Błąd pobierania sesji w Layout.astro

- **Scenariusz:** `supabase.auth.getUser()` zwraca błąd
- **Obsługa:** Traktowane jako brak sesji — Navbar renderuje widok anonimowy. Błąd logowany do konsoli serwera (`console.error`). Nie blokuje renderowania strony.

### 10.2. Błąd pobierania sesji w DashboardLayout.astro

- **Scenariusz:** `supabase.auth.getUser()` zwraca błąd lub brak użytkownika
- **Obsługa:** Redirect do `/auth/login?return={currentPath}`. Użytkownik nigdy nie widzi pustego dashboardu.

### 10.3. Błąd pobierania profilu w DashboardLayout.astro

- **Scenariusz:** `ProfileService.getAuthenticatedProfile()` rzuca `NotFoundError` (profil nie istnieje w tabeli `profiles`)
- **Obsługa:** Przechwycenie wyjątku, zalogowanie błędu, redirect do `/auth/login`. Możliwa rasa: użytkownik w `auth.users` ale bez odpowiedniego rekordu w `profiles`.

### 10.4. Błąd wylogowania (React islands)

- **Scenariusz:** `POST /api/auth/logout` zwraca 401 lub 500
- **Obsługa:** Niezależnie od kodu odpowiedzi, użytkownik jest przekierowywany na `/auth/login`. Sesja po stronie serwera mogła być już usunięta. Wyświetlenie krótkotrwałego loading state na przycisku (spinner/disabled).

### 10.5. Brak klienta Supabase w locals

- **Scenariusz:** Middleware nie ustawił `locals.supabase` (błąd konfiguracji)
- **Obsługa:** W DashboardLayout — redirect do `/auth/login`. W Layout — Navbar renderuje widok anonimowy.

### 10.6. Profil z polami null (super_admin)

- **Scenariusz:** Super admin ma `name: null`, `city: null` itp.
- **Obsługa:** Fallbacki w template: nazwa → „Dashboard", inicjały w awatarze → „SA" (Super Admin) lub pierwsza litera emaila.

## 11. Kroki implementacji

1. **Dodanie komponentów Shadcn/ui**
   - Zainstalować `DropdownMenu` (`npx shadcn@latest add dropdown-menu`)
   - Zainstalować `Sheet` (`npx shadcn@latest add sheet`)
   - Zainstalować `Separator` (`npx shadcn@latest add separator`)
   - Sprawdzić czy `lucide-react` jest w zależnościach (`npm ls lucide-react`)

2. **Dodanie typu `NavbarUser` do `src/types.ts`**
   - Dodać interfejs `NavbarUser` z polami `name: string | null` i `role: UserRole`

3. **Utworzenie `StatusBanner.astro`**
   - Ścieżka: `src/components/StatusBanner.astro`
   - Implementacja warunkowego renderowania na podstawie propsa `status`
   - Użycie inline SVG ikon Lucide (Clock, Ban, XCircle) — bez JavaScript
   - Dodanie `role="alert"` dla dostępności
   - Stylizacja Tailwind: żółte/czerwone tła z border i ikoną

4. **Utworzenie `DashboardHeader.astro`**
   - Ścieżka: `src/components/DashboardHeader.astro`
   - Renderowanie nazwy schroniska, badge statusu, licznika AI
   - Import stałej `APP_CONFIG.AI.USAGE_LIMIT` z `src/lib/config.ts`
   - Użycie komponentu `Badge` z odpowiednim wariantem kolorystycznym

5. **Utworzenie `DashboardSidebar.astro`**
   - Ścieżka: `src/components/DashboardSidebar.astro`
   - Sidebar nawigacyjny 220px z linkami Potrzeby i Profil
   - Logika aktywnej pozycji na podstawie `currentPath`
   - Atrybuty `aria-current="page"` i `aria-label`
   - Inline SVG ikony Lucide (ClipboardList, User)

6. **Utworzenie `DashboardBottomNav.astro`**
   - Ścieżka: `src/components/DashboardBottomNav.astro`
   - Stały dolny pasek `fixed bottom-0` z flexem
   - Dwie ikony z etykietami, aktywna pozycja wyróżniona kolorem
   - `aria-current="page"` i `aria-label`

7. **Utworzenie `UserAvatarMenu.tsx`**
   - Ścieżka: `src/components/UserAvatarMenu.tsx`
   - Import Shadcn DropdownMenu, Avatar, Separator
   - Logika inicjałów z nazwy (2 pierwsze litery) z fallbackiem
   - Warunkowe pozycje menu na podstawie roli
   - Obsługa wylogowania z loading state
   - Nawigacja przez `window.location.href` (nie React Router)

8. **Utworzenie `MobileNavMenu.tsx`**
   - Ścieżka: `src/components/MobileNavMenu.tsx`
   - Import Shadcn Sheet, Button
   - Ikona Menu (hamburger) jako trigger
   - Lista linków nawigacyjnych warunkowa wg roli
   - Obsługa wylogowania identyczna jak w UserAvatarMenu
   - Zamknięcie Sheet po kliknięciu linku (sterowanie stanem `open`)

9. **Utworzenie `Navbar.astro`**
   - Ścieżka: `src/components/Navbar.astro`
   - Struktura: sticky header, wewnątrz nav z logo i sekcjami desktop/mobile
   - Warunkowe renderowanie: anonimowy (linki) vs zalogowany (React islands)
   - Propsy: `user: NavbarUser | null`
   - Integracja z `UserAvatarMenu` (`client:load`) i `MobileNavMenu` (`client:load`)

10. **Aktualizacja `Layout.astro`**
    - Zmiana `lang="en"` na `lang="pl"`
    - Dodanie skip-to-content link przed Navbar
    - Dodanie pobierania danych użytkownika w frontmatter (try/catch)
    - Dodanie `<Navbar user={navbarUser} />`
    - Dodanie `id="main-content"` do `<main>` (lub bezpośrednio do slotu)
    - Zachowanie istniejącej logiki `withLeaflet`

11. **Utworzenie `DashboardLayout.astro`**
    - Ścieżka: `src/layouts/DashboardLayout.astro`
    - Import global CSS, Navbar, StatusBanner, DashboardHeader, DashboardSidebar, DashboardBottomNav
    - Frontmatter: guard auth, pobranie profilu, przygotowanie danych
    - Pełna struktura HTML z warunkowymi komponentami
    - Padding bottom na mobile dla bottom nav (`pb-16 md:pb-0`)

12. **Aktualizacja stron dashboardu**
    - Zmiana `src/pages/dashboard.astro`: import `DashboardLayout` zamiast `Layout`, usunięcie duplikowanego guardu auth (teraz w layoucie)
    - Przygotowanie pod przyszłą stronę `src/pages/dashboard/profile.astro`

13. **Testy manualne i weryfikacja**
    - Sprawdzić widok anonimowy na `/` — Navbar z linkami auth
    - Sprawdzić widok zalogowanego shelter na `/dashboard` — pełny dashboard layout
    - Sprawdzić widok super_admin — odpowiedni dropdown menu
    - Sprawdzić responsywność: desktop sidebar vs mobile bottom nav
    - Sprawdzić StatusBanner dla różnych statusów konta
    - Sprawdzić wylogowanie z dropdown i Sheet
    - Sprawdzić dostępność: skip-to-content, aria-current, aria-label, nawigacja klawiaturą
    - Sprawdzić brak flashów nieautoryzowanego contentu
