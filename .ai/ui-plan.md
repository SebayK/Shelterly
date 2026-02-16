# Architektura UI – Shelterly MVP

## Decisions

1. **Mapa jako centralne element strony głównej** — Mapa Leaflet z klastrowaniem markerów jest hero section na `/`, ładowana jako Astro Island (`client:only="react"`). Nawigacja i stopka to statyczny HTML Astro.

2. **Struktura stron** — Ustalono 9 stron: `/` (mapa + lista), `/shelter/[id]` (szczegóły), `/auth/login`, `/auth/register`, `/auth/pending`, `/dashboard` (lista potrzeb), `/dashboard/profile` (edycja profilu), `/admin` (weryfikacja schronisk).

3. **Interakcja z markerami** — Kliknięcie markera otwiera popup z `ProfileListItemDTO` (nazwa, miasto, odległość, liczba potrzeb, flaga pilności). Przycisk „Zobacz szczegóły" nawiguje do `/shelter/[id]` (dedykowana strona, nie panel boczny — prostsze dla MVP, lepsze SEO).

4. **Split-view na desktopie, toggle na mobile** — Desktop: mapa 60% + lista 40%. Mobile: przełączanie mapa/lista via FAB button. Kliknięcie markera na mobile wysuwa bottom sheet (Shadcn/ui `Sheet`).

5. **Obsługa geolokalizacji** — Custom hook `useGeolocation()` z timeout 5s. Granted → `GET /api/profiles?lat=X&lon=Y`, mapa centruje na użytkowniku. Denied → `GET /api/profiles` bez coords (sortowanie wg pilności), mapa centruje na `DEFAULT_LOCATION` (Warszawa), wyświetla baner informacyjny. Opcjonalnie pole wyszukiwania po mieście.

6. **Filtry na stronie głównej** — Dwa filtry: (a) toggle „Tylko pilne potrzeby" (`urgent_only=true`), (b) opcjonalne wyszukiwanie miasta. Brak filtra kategorii na mapie (nieobsługiwany przez API profili). Na mobile filtry w bottom sheet.

7. **Strona `/shelter/[id]` — SSR z React island** — Astro frontmatter pobiera dane równolegle przez serwisy (`ProfileService.getProfileById()` + `NeedsService.getNeeds()`). Statyczna treść (nazwa, adres, kontakt) renderowana Astro. Interaktywne elementy w `<ShelterDetailView client:load />`.

8. **Dedykowane strony auth** — `login.astro` i `register.astro` jako osobne strony z React islands (`LoginForm`, `RegisterForm`). Rejestracja zawiera: email, hasło, nazwa, adres, miasto, NIP, upload dokumentu. Po rejestracji → redirect na `/auth/pending`.

9. **Navbar** — Komponent statyczny Astro (`Navbar.astro`), sticky, 56px. Logo + auth links (anonimowy) lub avatar z dropdown (zalogowany). Mobile: hamburger menu. Zero JavaScript.

10. **DashboardLayout** — Dedykowany layout z sidebar na desktopie (220px, pozycje: Potrzeby, Profil) i bottom navigation na mobile. Header z nazwą schroniska, badge statusu, licznik AI.

11. **Statusy konta w UI** — Warunkowy `StatusBanner` w dashboardzie: `pending` → żółty baner z linkiem do uploadu dokumentu, `suspended` → czerwony baner, `rejected` → czerwony baner z powodem, `verified` → brak banera. Przyciski CRUD `disabled` dla statusów ≠ verified.

12. **Middleware — auth guard** — Rozbudowa middleware o parsowanie sesji JWT, wstrzykiwanie `locals.session/user/profile`. Guard: `/dashboard/*` wymaga sesji, `/admin/*` wymaga `super_admin`. Publiczne strony bez ochrony.

13. **Reużywalny NeedCard** — Przyjmuje `NeedListItemDTO` + opcjonalny `actions?: ReactNode`. Wyświetla: kategorię (ikona Lucide), tytuł, opis, `ProgressBar` (ARIA), `UrgencyBadge` (kolorowy), przycisk „Kup online". W dashboardzie — dodatkowe akcje (Edytuj, Zrealizowane, Usuń).

14. **Mapowanie kategorii na ikony Lucide** — food→`Utensils`, textiles→`Shirt`, cleaning→`SprayCan`, medical→`Stethoscope`, toys→`ToyBrick`, other→`Package`.

15. **Kolory badge'ów urgency** — `low`=szary, `normal`=niebieski, `high`=pomarańczowy, `urgent`=czerwony, `critical`=czerwony pulsujący.

16. **Dashboard — zarządzanie potrzebami** — `NeedsManager` jako root island z tabelą, sortowaniem, paginacją. CRUD przez modale (Dialog). AI helpery inline obok pól `description`/`shopping_url`. Licznik zużycia AI widoczny w headerze.

17. **Zarządzanie stanem** — TanStack Query jako jedyne narzędzie stanu serwera. `ShelterExplorerContext` (React Context) dla stanu UI mapy. Brak Redux/Zustand. Lokalne stany (`useState`) dla formularzy.

18. **Cache TanStack Query** — `staleTime` 5 min dla profili, 1 min dla potrzeb, 30s dla admin pending. Invalidacja cache po mutacjach. Strategia `stale-while-revalidate`.

19. **Centralna obsługa błędów API** — Wrapper `apiClient` w `src/lib/api.ts`. Mapowanie: 401 → redirect login, 403 `ACCOUNT_PENDING` → baner, 400 `VALIDATION_ERROR` → inline errors, 429 → toast z retry, 500/503 → toast + retry. Sonner (Shadcn/ui Toast).

20. **Leaflet — zależności i konfiguracja** — `leaflet`, `react-leaflet`, `@types/leaflet`, `leaflet.markercluster`, `react-leaflet-cluster`. `client:only="react"`. OpenStreetMap tiles. Customowe ikony markerów z oznaczeniem pilności.

21. **Panel admina** — Prosta tabela `PendingSheltersTable` z danymi z `PendingShelterListItemDTO`. Panel boczny/modal z podglądem dokumentu. Przyciski: „Zweryfikuj" → `verified`, „Odrzuć" → `rejected` + `rejection_reason`. Shadcn/ui `Table`, `AlertDialog`.

22. **Pojedyncza wyspa React na stronie głównej** — `ShelterExplorer` jako jeden komponent `client:only="react"` zarządzający mapą i listą. Nie dzielić na osobne islands (współdzielony stan).

---

## Matched Recommendations

1. **Architektura Astro Islands** — Potwierdzono podejście z komponentami statycznymi Astro dla layoutów/nawigacji i React islands wyłącznie dla interaktywnych elementów. Leaflet wymusza `client:only="react"`.

2. **Jedna wyspa React dla split-view** — `ShelterExplorer` jako root island zarządzający mapą i listą ze współdzielonym stanem przez `ShelterExplorerContext`. Podział na osobne islands odrzucony ze względu na niemożność współdzielenia stanu React.

3. **Responsywny split-view** — Desktop 60/40, mobile toggle z FAB. Bottom sheet dla popupów na mobile. Breakpointy Tailwind (`md:`, `lg:`).

4. **SSR dla strony szczegółów schroniska** — Dane pobierane w Astro frontmatter bezpośrednio przez serwisy (nie przez API HTTP). Hydratacja interaktywnych elementów przez `client:load`. SEO-friendly.

5. **TanStack Query zamiast ciężkich state managers** — Wbudowane cachowanie, revalidacja, retry, deduplication. Konfiguracja `staleTime` zgodna z zaleceniami API (`Cache-Control`). Invalidacja po mutacjach via klucze query.

6. **Custom hook `useGeolocation`** — Timeout 5s, jednokrotne wywołanie, API: `{ coords, status, error }`. Flow: loading → granted/denied → fetch z/bez coords.

7. **Warstwy obsługi błędów** — Centralny `apiClient` mapujący kody błędów API na akcje UI. Reużycie typów `ErrorResponse`/`ErrorCode` z `src/types.ts`. Sonner toasts + inline form errors.

8. **Middleware auth z wstrzykiwaniem profilu** — Rozszerzenie `Locals` o `session`, `user`, `profile`. Guard ścieżek z redirect. Warunkowe renderowanie w Astro na podstawie `locals`.

9. **Reużywalny system komponentów potrzeb** — `NeedCard` z wzorcem composition (slot `actions`). Subkomponenty `ProgressBar` (ARIA progressbar), `UrgencyBadge`, `CategoryIcon` — reużywalne na stronie publicznej i w dashboardzie.

10. **Shadcn/ui jako fundament UI** — Styl `new-york`, komponenty: Dialog, Sheet, Table, Badge, Form, AlertDialog, Tooltip, Skeleton, Switch, DropdownMenu, Separator, Sonner. Spójność z istniejącymi `button.tsx`, `card.tsx`, `avatar.tsx`.

---

## UI Architecture Planning Summary

### Główne wymagania architektoniczne

Aplikacja Shelterly MVP opiera się na architekturze **Astro 5 z React 19 Islands**. Strony i layouty renderowane są po stronie serwera (SSR) przez Astro, z interaktywnymi komponentami React ładowanymi selektywnie (`client:load` lub `client:only="react"`). Stack UI obejmuje Tailwind 4, Shadcn/ui (styl `new-york`) i Lucide React dla ikon. Projekt unika ciężkich bibliotek stanu na rzecz TanStack Query i lokalnych hooków React.

### Kluczowe widoki i przepływy

Aplikacja dzieli się na **3 ścieżki użytkownika**:

**Darczyńca (anonimowy):** Strona główna z mapą Leaflet w split-view (mapa 60% + lista 40% na desktopie, toggle na mobile). Geolokalizacja przeglądarki centruje mapę i sortuje wyniki po odległości. Filtry: toggle pilności. Kliknięcie markera/karty → strona szczegółów schroniska (SSR) z listą potrzeb, paskami postępu, filtrami kategorii i linkami zakupowymi.

**Schronisko (autoryzowane):** Rejestracja z uploadem dokumentu → status `pending` → weryfikacja admina → `verified`. Dashboard z DashboardLayout (sidebar desktop / bottom nav mobile), CRUD potrzeb przez modale (Dialog), AI helpery do generowania opisów i linków. StatusBanner warunkowy wg statusu konta.

**Admin (super_admin):** Tabela oczekujących schronisk z panelem review, podglądem dokumentów weryfikacyjnych, przyciskami weryfikuj/odrzuć (AlertDialog).

### Integracja z API i zarządzanie stanem

- **TanStack Query** — jedyne narzędzie stanu serwera. Cache: `staleTime` 5 min (profile), 1 min (potrzeby), 30s (admin). Invalidacja po mutacjach.
- **React Context** (`ShelterExplorerContext`) — wyłącznie dla współdzielonego stanu UI mapy (filtry, geolokalizacja, selected marker, mobile view toggle).
- **Centralny `apiClient`** (`src/lib/api.ts`) — wrapper fetch z mapowaniem kodów błędów na akcje UI.
- **SSR data fetching** — strona `/shelter/[id]` pobiera dane bezpośrednio przez serwisy w Astro frontmatter (bez pośrednictwa API HTTP).
- **Custom hooks** — `useGeolocation`, `useProfiles`, `useNeeds`, `useCreateNeed`, `useUpdateNeed`, `useDeleteNeed`, `useAIGenerate`.

### Responsywność

- **Breakpointy Tailwind:** default (<768px mobile), `md:` (≥768px tablet), `lg:` (≥1024px desktop).
- **Strona główna:** split-view 60/40 na desktop, FAB toggle mapa↔lista na mobile, bottom sheet dla popupów markerów.
- **Dashboard:** sidebar 220px na desktop, bottom navigation bar na mobile.
- **Navbar:** sticky 56px, hamburger menu na mobile.

### Dostępność (WCAG 2.1 AA)

- `<html lang="pl">`, skip-to-content link, focus visible na interaktywnych elementach.
- Mapa: `role="application"`, `aria-label`, lista jako alternatywa dla screen readerów.
- ProgressBar: `role="progressbar"` z pełnymi atrybutami ARIA.
- Formularze: Shadcn/ui Form z `aria-describedby`, inline errors.
- Powiadomienia: `aria-live="polite"`, nawigacja z `aria-current="page"`.

### Bezpieczeństwo

- Middleware parsuje sesję JWT, wstrzykuje `locals.session/user/profile`.
- Guard: `/dashboard/*` wymaga sesji (redirect → `/auth/login?return=`), `/admin/*` wymaga `role=super_admin`.
- Strony publiczne bez wymagania sesji; strony chronione SSR z weryfikacją, brak flashów nieautoryzowanego contentu.
- StatusBanner blokuje UI CRUD dla statusów ≠ `verified` (disabled buttons + tooltip).

### Nowe zależności do dodania

`@tanstack/react-query`, `leaflet`, `react-leaflet`, `@types/leaflet`, `leaflet.markercluster`, `react-leaflet-cluster`, `react-hook-form`, `@hookform/resolvers`, `sonner` + 15 komponentów Shadcn/ui.

### Struktura plików

```
src/
├── components/
│   ├── Navbar.astro
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── RegisterForm.tsx
│   ├── shelter-explorer/
│   │   ├── ShelterExplorer.tsx
│   │   ├── ShelterExplorerContext.tsx
│   │   ├── MapView.tsx
│   │   ├── ShelterMarker.tsx
│   │   ├── ShelterList.tsx
│   │   ├── ShelterCard.tsx
│   │   ├── ShelterFilters.tsx
│   │   ├── LocationBanner.tsx
│   │   └── MobileViewToggle.tsx
│   ├── shelter-detail/
│   │   ├── ShelterDetailView.tsx
│   │   └── NeedsFilter.tsx
│   ├── needs/
│   │   ├── NeedCard.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── UrgencyBadge.tsx
│   │   └── CategoryIcon.tsx
│   ├── dashboard/
│   │   ├── StatusBanner.astro
│   │   ├── NeedsManager.tsx
│   │   ├── NeedFormDialog.tsx
│   │   ├── AIGenerateButton.tsx
│   │   ├── ProfileForm.tsx
│   │   └── VerificationUpload.tsx
│   ├── admin/
│   │   ├── PendingSheltersTable.tsx
│   │   └── ShelterReviewPanel.tsx
│   ├── hooks/
│   │   ├── useGeolocation.ts
│   │   ├── useProfiles.ts
│   │   ├── useNeeds.ts
│   │   ├── useCreateNeed.ts
│   │   ├── useUpdateNeed.ts
│   │   ├── useDeleteNeed.ts
│   │   └── useAIGenerate.ts
│   └── ui/ (Shadcn/ui — istniejące + nowe)
├── layouts/
│   ├── Layout.astro
│   └── DashboardLayout.astro
├── lib/
│   ├── api.ts
│   ├── config.ts
│   ├── errors.ts
│   ├── utils.ts
│   ├── services/
│   └── validation/
├── middleware/
│   └── index.ts
├── pages/
│   ├── index.astro
│   ├── shelter/
│   │   └── [id].astro
│   ├── auth/
│   │   ├── login.astro
│   │   ├── register.astro
│   │   └── pending.astro
│   ├── dashboard/
│   │   ├── index.astro
│   │   └── profile.astro
│   ├── admin/
│   │   └── index.astro
│   └── api/
└── styles/
    └── global.css
```

---

## Unresolved Issues

1. **Strona 404 / error page** — Nie ustalono wyglądu ani zachowania customowej strony błędu Astro (`src/pages/404.astro`). Zalecenie: stworzyć prostą stronę z linkiem powrotnym na mapę.

2. **Dark mode** — CSS variables dla dark mode są zdefiniowane w `global.css`, ale nie ustalono, czy MVP powinno wspierać przełącznik dark/light mode, czy pozostawić system preference. Infrastruktura jest gotowa (`@custom-variant dark`).

3. **Internacjonalizacja** — Aplikacja jest skierowana na rynek polski, ale obecny layout ma `lang="en"` i część treści jest po angielsku. Należy ustalić strategię i18n (czy MVP jest wyłącznie po polsku, czy przygotować pod wielojęzyczność).

4. **Walidacja NIP po stronie klienta** — Schemat Zod dla rejestracji z walidacją NIP (10 cyfr + opcjonalnie suma kontrolna) nie jest jeszcze zdefiniowany w `src/lib/validation/`. Istniejące schematy pokrywają profile update i needs, ale brak schematu rejestracji.

5. **Logika rejestracji z triggerem bazy danych** — Trigger `handle_new_user()` tworzy profil z `role='shelter'`, `status='pending'` bez `name`/`city`/`address` (które są `NOT NULL` w schemacie). Należy wyjaśnić, czy rejestracja będzie dwuetapowa (auth signup → profile update) czy pola zostaną przekazane przez metadatę Supabase Auth. Aktualna migracja `20260124000000_update_handle_new_user.sql` może zawierać rozwiązanie — wymaga weryfikacji.

6. **Limity AI i UX** — Nie ustalono dokładnego limitu AI (`ai_usage_count` max) ani jak komunikować zbliżanie się do limitu w UI (czy wyświetlać ostrzeżenie przy np. 90% zużycia).

7. **Paginacja — strategia UX** — Nie ustalono, czy listy (potrzeby, schroniska, admin) używają infinite scroll, klasycznej paginacji (przyciski „Poprzednia/Następna") czy „Load more" button. Zalecenie: klasyczna paginacja dla tabel (dashboard, admin), infinite scroll lub load more dla list kart (strona główna, shelter detail).

8. **SEO i meta tagi** — Poza `lang="pl"` i ogólnym title, nie ustalono strategii meta tagów (OG image, description) dla stron dynamicznych (`/shelter/[id]`). Astro SSR umożliwia dynamiczne meta tagi — wymaga implementacji.
