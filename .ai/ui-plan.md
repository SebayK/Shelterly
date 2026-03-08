# Architektura UI dla Shelterly

## 1. Przegląd struktury UI

Shelterly to aplikacja webowa oparta na architekturze **Astro 5 Islands** z **React 19** jako silnikiem interaktywnych komponentów. Strony i layouty renderowane są po stronie serwera (SSR), a interaktywne wyspy React ładowane selektywnie (`client:load` lub `client:only="react"`).

Interfejs dzieli się na trzy strefy odpowiadające grupom docelowym:

- **Strefa publiczna** — widoki dostępne anonimowo (strona główna z mapą, szczegóły schroniska, logowanie, rejestracja). Służą darczyńcom do odkrywania potrzeb schronisk.
- **Strefa schroniska** — widoki wymagające uwierzytelnienia i roli `shelter` (dashboard z CRUD potrzeb, edycja profilu). Chronione middleware z guardem sesji.
- **Strefa admina** — widoki wymagające roli `super_admin` (panel weryfikacji schronisk). Chronione dodatkowym guardem roli.

Stack UI: Tailwind 4, Shadcn/ui (styl `new-york`), Lucide React (ikony), własne hooki oparte o `fetch`, lokalny stan React i helpery walidacyjne formularzy.

Zarządzanie stanem opiera się na trzech filarach:

- **SSR Astro + serwisy** — dane krytyczne dla guardów i layoutów są pobierane po stronie serwera
- **Custom hooki React** — stan serwera i mutacje w wyspach admin/dashboard są obsługiwane przez dedykowane hooki oparte o `fetch`
- **React Context** (`ShelterExplorerContext`) — współdzielony stan UI mapy na stronie głównej
- **Lokalne stany** (`useState`) — formularze i przejściowe interakcje

---

## 2. Lista widoków

### 2.1. Strona główna — Eksplorator schronisk

- **Ścieżka:** `/`
- **Plik:** `src/pages/index.astro`
- **Główny cel:** Umożliwienie darczyńcom szybkiego znalezienia najbliższego schroniska i sprawdzenia jego potrzeb.
- **Kluczowe informacje:**
  - Mapa Leaflet z klastrowaniem markerów zweryfikowanych schronisk
  - Lista schronisk posortowana wg odległości (jeśli geolokalizacja) lub pilności (bez geolokalizacji)
  - Dla każdego schroniska: nazwa, miasto, odległość, liczba potrzeb, flaga pilności (`ProfileListItemDTO`)
- **Kluczowe komponenty widoku:**
  - `ShelterExplorer` — pojedyncza wyspa React (`client:only="react"`) zarządzająca całym split-view
  - `MapView` — mapa Leaflet z markerami i klastrowaniem
  - `ShelterMarker` — marker z popup zawierającym podstawowe dane schroniska
  - `ShelterList` — lista kart schronisk
  - `ShelterCard` — karta schroniska w liście
  - `ShelterFilters` — toggle „Tylko pilne potrzeby" + opcjonalne wyszukiwanie miasta
  - `LocationBanner` — baner informacyjny gdy geolokalizacja odrzucona
  - `MobileViewToggle` — FAB przełączający widok mapa/lista na mobile
- **Źródła danych API:** `GET /api/profiles` z opcjonalnymi parametrami `lat`, `lon`, `urgent_only`
- **UX:**
  - Desktop: split-view mapa 60% + lista 40%
  - Mobile: toggle mapa/lista via FAB; kliknięcie markera wysuwa bottom sheet (`Sheet`)
  - Ładowanie: skeletony (`Skeleton`) dla kart i mapy
  - Pusta lista: komunikat zachęcający do zmiany filtrów
- **Dostępność:**
  - Mapa: `role="application"`, `aria-label="Mapa schronisk dla zwierząt"`
  - Lista jako alternatywa klawiszowa/czytelnikowa dla mapy
  - Filtry z etykietami `aria-label`
  - Skip-to-content link w Navbar pomijający nawigację
- **Bezpieczeństwo:** Widok publiczny, brak wymagania sesji. Dane geolokalizacji przetwarzane wyłącznie po stronie klienta (hook `useGeolocation`), nie przechowywane.

---

### 2.2. Szczegóły schroniska

- **Ścieżka:** `/shelter/[id]`
- **Plik:** `src/pages/shelter/[id].astro`
- **Główny cel:** Prezentacja pełnych informacji o schronisku i jego aktualnych potrzebach, umożliwienie darczyńcy podjęcia konkretnej pomocy.
- **Kluczowe informacje:**
  - Profil schroniska: nazwa, adres, miasto, telefon, strona www (`ProfileDetailDTO`)
  - Lista potrzeb z paskami postępu i linkami do zakupu (`NeedListItemDTO[]`)
  - Podsumowanie potrzeb: łączna liczba, pilne, zrealizowane (`NeedsSummary`)
- **Kluczowe komponenty widoku:**
  - Statyczny nagłówek Astro z danymi kontaktowymi schroniska
  - `ShelterDetailView` — wyspa React (`client:load`) z interaktywną listą potrzeb
  - `NeedsFilter` — filtr kategorii (food, textiles, cleaning, medical, toys, other) i pilności
  - `NeedCard` — karta potrzeby z paskiem postępu i przyciskiem „Kup online"
  - `ProgressBar` — wizualny pasek postępu zbiórki (np. „5/50 kg")
  - `UrgencyBadge` — kolorowy badge poziomu pilności
  - `CategoryIcon` — ikona Lucide odpowiadająca kategorii
- **Źródła danych API:** Dane pobierane w Astro frontmatter bezpośrednio przez serwisy: `ProfileService.getProfileById(id)` + `NeedsService.getNeeds({ shelter_id: id })`
- **UX:**
  - SSR — szybkie ładowanie i SEO-friendly
  - Dynamiczne meta tagi (OG title, description) generowane na podstawie danych schroniska
  - Przycisk „Kup online" otwiera link w nowej karcie (`target="_blank"`, `rel="noopener"`)
  - Sekcja kontaktowa z clickable phone number (`tel:`) i linkiem www
  - Breadcrumb: Strona główna → Nazwa schroniska
- **Dostępność:**
  - `ProgressBar`: `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`
  - Karty potrzeb z semantycznym HTML (`article`, `heading`)
  - Linki zewnętrzne z `aria-label` informującym o otwarciu w nowej karcie
- **Bezpieczeństwo:** Widok publiczny. Zwraca 404 gdy schronisko nie istnieje lub nie jest zweryfikowane.

---

### 2.3. Logowanie

- **Ścieżka:** `/auth/login`
- **Plik:** `src/pages/auth/login.astro`
- **Główny cel:** Uwierzytelnienie pracownika schroniska lub administratora.
- **Kluczowe informacje:**
  - Formularz logowania: email, hasło
  - Link do rejestracji
- **Kluczowe komponenty widoku:**
  - `LoginForm` — wyspa React (`client:load`) z formularzem, walidacją i obsługą błędów
- **Źródła danych API:** Supabase Auth `signInWithPassword`
- **UX:**
  - Centralnie wyśrodkowany formularz na stronie
  - Walidacja inline pól (email format, wymagane hasło)
  - Komunikat błędu przy nieprawidłowych danych logowania
  - Po zalogowaniu: `super_admin` → `/admin`, `verified` → `/dashboard` lub URL z parametru `return`, `pending/rejected` → `/dashboard/profile`
  - Link „Nie masz konta? Zarejestruj schronisko" pod formularzem
- **Dostępność:**
  - Etykiety pól z `htmlFor`/`id`, `aria-describedby` dla komunikatów błędów
  - Focus trap w formularzu
  - Komunikaty błędów z `aria-live="polite"`
- **Bezpieczeństwo:**
  - Rate limiting na endpoincie auth (5 prób / 15 min / IP)
  - Pole hasła z `type="password"` i opcją pokaż/ukryj
  - Przekierowanie zalogowanego użytkownika z powrotem do dashboardu (middleware)

---

### 2.4. Rejestracja

- **Ścieżka:** `/auth/register`
- **Plik:** `src/pages/auth/register.astro`
- **Główny cel:** Rejestracja nowego schroniska z danymi i dokumentem weryfikacyjnym.
- **Kluczowe informacje:**
  - Formularz rejestracji: email, hasło, powtórzenie hasła, nazwa schroniska, adres, miasto, NIP, upload dokumentu weryfikacyjnego
- **Kluczowe komponenty widoku:**
  - `RegisterForm` — wyspa React (`client:load`) z wielopolowym formularzem i uploadem pliku
- **Źródła danych API:** Supabase Auth `signUp` z metadanymi (name, city, address, nip) → trigger bazy tworzy profil → `POST /api/profiles/me/verification-document`
- **UX:**
  - Formularz z grupowanymi sekcjami: Dane logowania, Dane schroniska, Dokument
  - Walidacja inline z Zod: NIP (10 cyfr, suma kontrolna), email, siła hasła
  - Upload: drag & drop lub klik, podgląd nazwy pliku, akceptowane formaty (PDF, JPG, PNG), max 5MB
  - Po rejestracji: redirect na `/auth/pending`
  - Wskaźnik siły hasła (min 8 znaków, wielka/mała litera, cyfra)
- **Dostępność:**
  - Grupowanie pól w `fieldset` z `legend`
  - Upload: `aria-label` i informacja o akceptowanych formatach
  - Komunikaty walidacji powiązane przez `aria-describedby`
- **Bezpieczeństwo:**
  - Walidacja NIP po stronie klienta i serwera
  - Upload pliku do prywatnego bucketa Supabase Storage (RLS: owner + admin)
  - Hasło nigdy nie jest logowane ani przesyłane poza Supabase Auth

---

### 2.5. Oczekiwanie na weryfikację

- **Ścieżka:** `/auth/pending`
- **Plik:** `src/pages/auth/pending.astro`
- **Główny cel:** Informacja o statusie oczekiwania na weryfikację konta schroniska.
- **Kluczowe informacje:**
  - Komunikat potwierdzający rejestrację dla użytkownika anonimowego
  - Dla zalogowanego `pending`: CTA do `/dashboard/profile`, aby uzupełnić dokument
  - Dla zalogowanego `rejected`: CTA do `/dashboard/profile` oraz prezentacja `rejection_reason`, jeśli jest dostępny
- **Kluczowe komponenty widoku:**
  - Statyczny komponent Astro — brak interaktywnych elementów React
  - Ikona statusu (np. Clock z Lucide)
  - CTA do profilu lub na stronę główną, zależnie od statusu sesji
- **UX:**
  - Prosty, centrowany układ z czytelnym komunikatem
  - Możliwość dotarcia tu po rejestracji lub wejścia bez sesji
  - Zalogowane konto `verified` lub `super_admin` jest przekierowywane poza ten widok
- **Dostępność:** Semantyczny HTML, nagłówek `h1` z jasnym komunikatem
- **Bezpieczeństwo:** Strona dostępna publicznie, ale szczegóły odrzucenia są pokazywane tylko właścicielowi zalogowanego konta.

---

### 2.6. Dashboard — Zarządzanie potrzebami

- **Ścieżka:** `/dashboard`
- **Plik:** `src/pages/dashboard/index.astro`
- **Główny cel:** Umożliwienie zweryfikowanemu schronisku pełnego zarządzania listą potrzeb (CRUD) z pomocą AI.
- **Kluczowe informacje:**
  - Lista potrzeb schroniska w formie tabeli z sortowaniem i paginacją
  - Status konta i licznik AI w nagłówku
  - Operacje CRUD na potrzebach
- **Kluczowe komponenty widoku:**
  - `StatusBanner` — warunkowy baner statusu konta (Astro, renderowany SSR):
    - `pending` → żółty baner z informacją o uzupełnieniu profilu i dokumentu
    - `suspended` → czerwony baner z informacją o zawieszeniu
    - `rejected` → czerwony baner z powodem odrzucenia
    - `verified` → brak banera
  - `NeedsManager` — wyspa React (`client:load`) jako root komponent zarządzania potrzebami
  - `NeedFormDialog` — modal (Shadcn/ui `Dialog`) do tworzenia i edycji potrzeby
  - `AIGenerateButton` — przycisk AI inline obok pól `description` / `shopping_url` w formularzu
  - Tabela potrzeb z kolumnami: kategoria, tytuł, pilność, postęp, akcje
  - Akcje per potrzeba: Edytuj, Oznacz jako zrealizowaną, Usuń
- **Źródła danych API:**
  - `GET /api/needs?shelter_id={my_id}` — lista potrzeb
  - `POST /api/needs` — tworzenie
  - `PATCH /api/needs/:id` — edycja
  - `DELETE /api/needs/:id` — usunięcie (soft delete)
  - `POST /api/needs/:id/fulfill` — oznaczenie jako zrealizowana
  - `POST /api/ai/generate-description` — generowanie opisu AI
  - `POST /api/ai/generate-shopping-link` — generowanie linku zakupowego AI
- **UX:**
  - Tabela z paginacją (klasyczne przyciski „Poprzednia/Następna")
  - Tworzenie i edycja w modalu — nie wymaga nawigacji
  - Przycisk AI ładuje wygenerowany tekst bezpośrednio do pola formularza
  - Licznik AI w headerze dashboardu (np. „Użycia AI: 45/100")
  - Potwierdzenie usunięcia przez `AlertDialog`
  - Skeletony podczas ładowania listy
  - Pusty stan: zachęta do dodania pierwszej potrzeby z wyraźnym CTA
  - Przyciski CRUD zablokowane (`disabled` + komunikat kontekstowy) dla statusów konta ≠ `verified`
- **Dostępność:**
  - Tabela z `role="table"`, nagłówki `th` z `scope="col"`
  - Modale z focus trap, zamykanie Escape, `aria-modal="true"`
  - Przyciski `disabled` z `aria-disabled="true"` i `Tooltip` wyjaśniającym powód
  - Powiadomienia o sukcesie/błędzie operacji przez toast (`aria-live="polite"`)
- **Bezpieczeństwo:**
  - Guard middleware: wymaga sesji (redirect → `/auth/login?return=/dashboard`)
  - Status `pending`/`suspended` — UI blokuje CRUD (disabled buttons), ale API również waliduje status
  - RLS na bazie danych — schronisko edytuje tylko swoje potrzeby

---

### 2.7. Dashboard — Edycja profilu

- **Ścieżka:** `/dashboard/profile`
- **Plik:** `src/pages/dashboard/profile.astro`
- **Główny cel:** Edycja danych profilu schroniska, upload/zmiana dokumentu weryfikacyjnego, geokodowanie adresu.
- **Kluczowe informacje:**
  - Formularz z aktualnymi danymi profilu: nazwa, miasto, adres, telefon, strona www
  - Status weryfikacji i ścieżka do dokumentu
  - Powód odrzucenia zgłoszenia dla statusu `rejected`, jeśli został zapisany
  - Współrzędne lokalizacji
- **Kluczowe komponenty widoku:**
  - `ProfileForm` — wyspa React (`client:load`) z formularzem edycji profilu
  - `VerificationUpload` — komponent uploadu dokumentu weryfikacyjnego (ten sam co w rejestracji, ale w kontekście edycji)
  - Przycisk „Geokoduj adres" uruchamiający `POST /api/profiles/me/geocode`
  - Podgląd aktualnych współrzędnych na mini-mapie (opcjonalnie)
- **Źródła danych API:**
  - `GET /api/profiles/me` — bieżące dane profilu
  - `PATCH /api/profiles/me` — aktualizacja danych
  - `POST /api/profiles/me/verification-document` — upload/zmiana dokumentu
  - `POST /api/profiles/me/geocode` — geokodowanie adresu
- **UX:**
  - Formularz pre-wypełniony aktualnymi danymi
  - Przycisk geokodowania inline obok pola adresu — po kliknięciu wyświetla sformatowany adres i współrzędne
  - Komunikat sukcesu po zapisie (toast Sonner)
  - Informacja o statusie dokumentu weryfikacyjnego (wgrany / brak)
  - Dla statusu `rejected` wyraźny komunikat z powodem odrzucenia nad formularzem
- **Dostępność:** Formularze z pełnymi etykietami, inline errors, `aria-describedby`
- **Bezpieczeństwo:**
  - Guard middleware: wymaga sesji
  - Pola `status` i `role` nie są edytowalne przez użytkownika (API i UI)
  - Upload tylko do prywatnego bucketa (RLS)

---

### 2.8. Panel administracyjny

- **Ścieżka:** `/admin`
- **Plik:** `src/pages/admin/index.astro`
- **Główny cel:** Weryfikacja schronisk oczekujących na aktywację — przegląd danych i dokumentów, zmiana statusu.
- **Kluczowe informacje:**
  - Tabela schronisk ze statusem `pending` (`PendingShelterListItemDTO[]`)
  - Dla każdego schroniska: nazwa, NIP, miasto, email, data rejestracji, status dokumentu
  - Panel szczegółów z podglądem dokumentu weryfikacyjnego
- **Kluczowe komponenty widoku:**
  - `PendingSheltersTable` — wyspa React (`client:load`) z tabelą Shadcn/ui `Table`
  - `ShelterReviewPanel` — panel boczny/modal z detalami schroniska i podglądem dokumentu
  - Przyciski akcji: „Zweryfikuj" i „Odrzuć" z potwierdzeniem (`AlertDialog`)
  - Pole na powód odrzucenia (wymagane przy statusie `rejected`)
- **Źródła danych API:**
  - `GET /api/admin/shelters/pending` — lista oczekujących
  - `PATCH /api/admin/shelters/:id/status` — zmiana statusu (verified/rejected)
  - `GET /api/admin/shelters/:id/verification-document` — pobranie dokumentu
- **UX:**
  - Tabela z paginacją (klasyczne przyciski)
  - Kliknięcie wiersza otwiera panel review z podglądem dokumentu (inline iframe/img lub link do pobrania)
  - Potwierdzenie zmiany statusu przez `AlertDialog` z komunikatem konsekwencji
  - Przy odrzuceniu wymagany jest powód odrzucenia walidowany po stronie klienta i API
  - Po akcji: odświeżenie tabeli przez lokalny `refetch()` hooka administracyjnego
  - Badge statusu i liczba oczekujących w nagłówku
- **Dostępność:**
  - Tabela z prawidłową strukturą semantyczną
  - `AlertDialog` z focus trap i wyraźnym opisem konsekwencji
  - Podgląd dokumentu z `aria-label` i alternatywą tekstową
- **Bezpieczeństwo:**
  - Podwójny guard middleware: sesja + `role === 'super_admin'`
  - Brak dostępu dla roli `shelter` — middleware zwraca redirect/403
  - Dokument weryfikacyjny serwowany z prywatnego bucketa przez API proxy (nie bezpośredni URL Storage)

---

### 2.9. Strona 404

- **Ścieżka:** `/404` (catch-all Astro)
- **Plik:** `src/pages/404.astro`
- **Główny cel:** Informacja o nieznalezieniu strony z nawigacją powrotną.
- **Kluczowe informacje:**
  - Komunikat o braku strony
  - Link powrotny na stronę główną (mapę)
- **Kluczowe komponenty widoku:**
  - Statyczny komponent Astro z ikoną, nagłówkiem i przyciskiem „Wróć na mapę"
- **UX:** Prosty, centrowany układ bez elementów interaktywnych
- **Dostępność:** Semantyczny HTML, jasny nagłówek `h1`
- **Bezpieczeństwo:** Strona publiczna, nie ujawnia informacji o strukturze aplikacji.

---

## 3. Mapa podróży użytkownika

### 3.1. Ścieżka darczyńcy (anonimowy)

```text
1. Wejście na stronę główną (/)
2. Przeglądarka pyta o geolokalizację
   ├── Zgoda → mapa centruje na lokalizacji użytkownika, lista sortowana wg odległości
   └── Odmowa → mapa centruje na DEFAULT_LOCATION (Warszawa), lista sortowana wg pilności, wyświetla LocationBanner
3. Przeglądanie mapy / listy schronisk
   ├── Opcjonalnie: ustawienie filtra "Tylko pilne potrzeby"
   └── Opcjonalnie: wyszukiwanie po mieście
4. Kliknięcie markera na mapie
   ├── Desktop: popup z podstawowymi danymi + przycisk "Zobacz szczegóły"
   └── Mobile: bottom sheet z danymi + przycisk "Zobacz szczegóły"
5. Nawigacja do /shelter/[id]
6. Przeglądanie profilu schroniska i listy potrzeb
   ├── Opcjonalnie: filtrowanie potrzeb po kategorii / pilności
   └── Kliknięcie "Kup online" → otwarcie sklepu w nowej karcie
7. Kontakt ze schroniskiem (telefon, strona www)
```

### 3.2. Ścieżka schroniska (rejestracja → weryfikacja → zarządzanie)

```text
1. Wejście na /auth/register
2. Wypełnienie formularza rejestracji (email, hasło, nazwa, adres, miasto, NIP)
3. Upload dokumentu weryfikacyjnego (PDF/JPG/PNG, max 5MB)
4. Kliknięcie "Zarejestruj" → walidacja → Supabase Auth signup → profil z status=pending
5. Redirect na /auth/pending — komunikat o oczekiwaniu na weryfikację
--- (oczekiwanie na decyzję admina) ---
6. Logowanie na /auth/login
  ├── Status pending → redirect na /dashboard/profile i możliwość uzupełnienia dokumentu
  ├── Status rejected → redirect na /dashboard/profile, komunikat z powodem odrzucenia i możliwość korekty
  ├── Status suspended → wylogowanie i powrót do /auth/login
   └── Status verified → dashboard z pełnym dostępem
7. Wejście na /dashboard
  ├── Status verified → widok zarządzania potrzebami
  └── Status pending/rejected → redirect na /dashboard/profile
8. Dashboard (/) — zarządzanie potrzebami
   a. Dodawanie potrzeby:
      - Kliknięcie "Dodaj potrzebę" → NeedFormDialog modal
      - Wypełnienie: kategoria, tytuł, ilość docelowa, jednostka, pilność
      - Opcjonalnie: kliknięcie "Generuj opis AI" → POST /api/ai/generate-description → tekst wstawiany do pola
      - Opcjonalnie: kliknięcie "Znajdź produkt AI" → POST /api/ai/generate-shopping-link → URL wstawiany do pola
      - Zapisanie → POST /api/needs → odświeżenie listy
   b. Edycja potrzeby:
      - Kliknięcie "Edytuj" przy potrzebie → NeedFormDialog modal z danymi
      - Zmiana pól → PATCH /api/needs/:id → odświeżenie listy
   c. Aktualizacja postępu:
      - Zmiana current_quantity → PATCH /api/needs/:id
   d. Oznaczenie jako zrealizowana:
      - Kliknięcie "Zrealizowane" → POST /api/needs/:id/fulfill → odświeżenie listy
   e. Usunięcie potrzeby:
      - Kliknięcie "Usuń" → AlertDialog z potwierdzeniem → DELETE /api/needs/:id → odświeżenie listy
9. Edycja profilu (/dashboard/profile)
   - Formularz z aktualnymi danymi
  - Dla `rejected`: widoczny powód odrzucenia
   - Opcjonalnie: geokodowanie adresu → POST /api/profiles/me/geocode
   - Opcjonalnie: zmiana dokumentu weryfikacyjnego
   - Zapisanie → PATCH /api/profiles/me
```

### 3.3. Ścieżka administratora

```text
1. Logowanie na /auth/login (konto z role=super_admin)
2. Redirect na /admin
3. Przegląd tabeli schronisk oczekujących na weryfikację
4. Kliknięcie wiersza → otwarcie ShelterReviewPanel
   - Przegląd danych schroniska (nazwa, NIP, miasto, email)
   - Podgląd dokumentu weryfikacyjnego (GET /api/admin/shelters/:id/verification-document)
5. Podjęcie decyzji:
   ├── "Zweryfikuj" → AlertDialog z potwierdzeniem → PATCH status=verified → odświeżenie tabeli
   └── "Odrzuć" → AlertDialog z polem "Powód odrzucenia" (wymagane) → PATCH status=rejected → odświeżenie tabeli
```

---

## 4. Układ i struktura nawigacji

### 4.1. Layouty

Aplikacja wykorzystuje dwa layouty Astro:

**Layout główny (`Layout.astro`):**

- Używany przez: stronę główną, szczegóły schroniska, strony auth, admin, 404
- Struktura: `Navbar` (sticky, 56px) → `<main>` (slot) → opcjonalna stopka
- `<html lang="pl">`, skip-to-content link na początku body

**Layout dashboardu (`DashboardLayout.astro`):**

- Używany przez: `/dashboard`, `/dashboard/profile`
- Struktura: `Navbar` (sticky, 56px) → `StatusBanner` (warunkowy) → sidebar (desktop) + `<main>` (slot)
- `StatusBanner` otrzymuje dane SSR z profilu i może pokazać zapisany `rejection_reason`
- Desktop: sidebar 220px po lewej z pozycjami nawigacji (Potrzeby, Profil)
- Mobile: bottom navigation bar zamiast sidebar
- Header dashboardu: nazwa schroniska, badge statusu konta, licznik AI

### 4.2. Nawigacja główna (Navbar)

Komponent statyczny Astro (`Navbar.astro`), sticky top, h-14 (56px).

**Dla użytkownika anonimowego:**

- Logo „Shelterly" (link do `/`) po lewej
- Linki po prawej: „Zaloguj się" (`/auth/login`), „Zarejestruj schronisko" (`/auth/register`)

**Dla zalogowanego schroniska:**

- Logo „Shelterly" (link do `/`) po lewej
- Po prawej: avatar z `DropdownMenu` (pozycje: Dashboard, Profil, Wyloguj)

**Dla super admina:**

- Logo „Shelterly" (link do `/`) po lewej
- Po prawej: avatar z `DropdownMenu` (pozycje: Panel admina, Wyloguj)

**Mobile (wszystkie role):**

- Logo po lewej
- Hamburger menu po prawej → wysuwane menu z odpowiednimi linkami

Serwer renderuje navbar warunkowo na podstawie `locals.session` i `locals.profile?.role` — brak flashów nieautoryzowanego contentu.

### 4.3. Nawigacja dashboardu

**Desktop (sidebar 220px):**

- Pozycje: Potrzeby (`/dashboard`), Profil (`/dashboard/profile`)
- Aktywna pozycja wyróżniona wizualnie (`aria-current="page"`)

**Mobile (bottom navigation bar):**

- 2 ikony z etykietami: Potrzeby, Profil
- Stały na dole ekranu, h-16 (64px)

### 4.4. Przepływy nawigacji i guardy

| Ścieżka              | Wymaganie auth      | Guard middleware                                                                               | Redirect przy braku dostępu             |
| -------------------- | ------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------- |
| `/`                  | Brak                | —                                                                                              | —                                       |
| `/shelter/[id]`      | Brak                | —                                                                                              | 404 jeśli schronisko nie istnieje       |
| `/auth/login`        | Brak                | Redirect zalogowanego zgodnie z rolą i statusem (`/admin`, `/dashboard`, `/dashboard/profile`) | —                                       |
| `/auth/register`     | Brak                | Redirect zalogowanego zgodnie z rolą i statusem                                                | —                                       |
| `/auth/pending`      | Brak                | —                                                                                              | —                                       |
| `/dashboard`         | Sesja wymagana      | `locals.session` + redirect `pending/rejected` do `/dashboard/profile`                         | `/auth/login?return=/dashboard`         |
| `/dashboard/profile` | Sesja wymagana      | `locals.session`                                                                               | `/auth/login?return=/dashboard/profile` |
| `/admin`             | Sesja + super_admin | `locals.session` + `locals.profile.role`                                                       | `/auth/login` lub 403                   |

---

## 5. Kluczowe komponenty

### 5.1. Komponenty nawigacji i layoutu

| Komponent               | Typ   | Opis                                                                                                                                                   |
| ----------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Navbar.astro`          | Astro | Sticky nawigacja z logo, linkami auth lub avatar dropdown. Renderowany SSR warunkowo wg roli. Zero JS.                                                 |
| `Layout.astro`          | Astro | Layout główny z meta tagami, global CSS, Navbar, slot na content.                                                                                      |
| `DashboardLayout.astro` | Astro | Layout dashboardu z Navbar, StatusBanner, sidebar/bottom nav, slot.                                                                                    |
| `StatusBanner.astro`    | Astro | Warunkowy baner statusu konta (pending/suspended/rejected). Dla `rejected` może wyświetlać zapisany `rejection_reason`. Renderowany SSR — brak flashu. |

### 5.2. Komponenty eksploratora schronisk

| Komponent                | Typ           | Opis                                                                                                          |
| ------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------- |
| `ShelterExplorer`        | React         | Root island strony głównej. Zarządza split-view, stanem mapy i listy. Opakowuje `ShelterExplorerContext`.     |
| `ShelterExplorerContext` | React Context | Współdzielony stan: filtry, geolokalizacja, selected marker, mobile view mode.                                |
| `MapView`                | React         | Mapa Leaflet z OpenStreetMap tiles, klasteringiem markerów, obsługą zoomu i centrowania.                      |
| `ShelterMarker`          | React         | Marker na mapie z popup (nazwa, miasto, odległość, potrzeby, przycisk „Zobacz szczegóły").                    |
| `ShelterList`            | React         | Scrollowalna lista kart schronisk z obsługą loading/empty state.                                              |
| `ShelterCard`            | React         | Karta schroniska w liście: nazwa, miasto, odległość, liczba potrzeb, badge pilności. Link do `/shelter/[id]`. |
| `ShelterFilters`         | React         | Toggle „Tylko pilne potrzeby" (Switch) + opcjonalne pole wyszukiwania miasta.                                 |
| `LocationBanner`         | React         | Baner informacyjny gdy geolokalizacja odrzucona — sugestia wyszukiwania po mieście.                           |
| `MobileViewToggle`       | React         | FAB przełączający widok mapa/lista na mobile.                                                                 |

### 5.3. Komponenty potrzeb (reużywalne)

| Komponent      | Typ   | Opis                                                                                                                                                                                                |
| -------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NeedCard`     | React | Karta potrzeby: `CategoryIcon`, tytuł, opis, `ProgressBar`, `UrgencyBadge`, przycisk „Kup online", opcjonalny slot `actions` (wzorzec composition). Używana na stronie publicznej i w dashboardzie. |
| `ProgressBar`  | React | Wizualny pasek postępu z etykietą „X/Y jednostka". `role="progressbar"` z pełnymi atrybutami ARIA.                                                                                                  |
| `UrgencyBadge` | React | Badge z kolorowym oznaczeniem poziomu pilności: low=szary, normal=niebieski, high=pomarańżowy, urgent=czerwony, critical=czerwony pulsujący. Oparty na Shadcn/ui `Badge`.                           |
| `CategoryIcon` | React | Ikona Lucide mapowana na kategorię: food→Utensils, textiles→Shirt, cleaning→SprayCan, medical→Stethoscope, toys→ToyBrick, other→Package.                                                            |
| `NeedsFilter`  | React | Filtr kategorii i pilności dla listy potrzeb na stronie szczegółów schroniska.                                                                                                                      |

### 5.4. Komponenty dashboardu

| Komponent            | Typ   | Opis                                                                                                                                                                               |
| -------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NeedsManager`       | React | Root island dashboardu. Tabela potrzeb z paginacją, akcjami CRUD i statusowymi blokadami dla kont niezweryfikowanych.                                                              |
| `NeedFormDialog`     | React | Modal (Shadcn/ui Dialog) do tworzenia i edycji potrzeby. Pola: kategoria, tytuł, opis, link zakupowy, pilność, ilość docelowa, ilość obecna, jednostka. Integracja z AI helperami. |
| `AIGenerateButton`   | React | Przycisk inline obok pola formularza. Wywołuje endpoint AI, wstawia wynik do pola. Pokazuje spinner i obsługuje limit/error.                                                       |
| `ProfileForm`        | React | Formularz edycji profilu z lokalnym stanem i helperami walidacji. Pokazuje status konta, opcjonalny `rejection_reason`, geokodowanie i upload dokumentu.                           |
| `VerificationUpload` | React | Komponent uploadu dokumentu z drag & drop, podglądem pliku, walidacją formatu/rozmiaru.                                                                                            |

### 5.5. Komponenty admina

| Komponent              | Typ   | Opis                                                                                                                                |
| ---------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `PendingSheltersTable` | React | Tabela Shadcn/ui z listą schronisk pending. Kolumny: nazwa, NIP, miasto, email, data, dokument. Paginacja.                          |
| `ShelterReviewPanel`   | React | Panel boczny/modal z detalami schroniska, podglądem dokumentu, przyciskami Zweryfikuj/Odrzuć. AlertDialog do potwierdzenia decyzji. |

### 5.6. Komponenty auth

| Komponent      | Typ   | Opis                                                                                      |
| -------------- | ----- | ----------------------------------------------------------------------------------------- |
| `LoginForm`    | React | Formularz logowania z React Hook Form + Zod. Pola: email, hasło. Obsługa błędów auth.     |
| `RegisterForm` | React | Formularz rejestracji z walidacją NIP, siłą hasła, uploadem dokumentu. Wieloetapowy flow. |

### 5.7. Hooki (custom hooks)

| Hook                             | Opis                                                                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `useGeolocation`                 | Jednokrotne pobranie lokalizacji przeglądarki z timeout 5s. Zwraca `{ coords, status, error }`. Status: `loading` → `granted`/`denied`/`error`. |
| `useProfiles`                    | Custom hook pobierający `GET /api/profiles` z parametrami `lat`, `lon`, `urgent_only`.                                                          |
| `useNeeds`                       | Custom hook pobierający `GET /api/needs` oraz obsługujący odświeżanie i paginację lokalną.                                                      |
| `useAdminPendingShelters`        | Custom hook pobierający `GET /api/admin/shelters/pending`, mapujący dane do tabeli i obsługujący `refetch()`.                                   |
| `useUpdateShelterStatus`         | Custom hook wykonujący `PATCH /api/admin/shelters/:id/status` wraz z mapowaniem błędów walidacji.                                               |
| `useShelterVerificationDocument` | Custom hook pobierający dokument weryfikacyjny dla panelu admina i tworzący bezpieczny preview/download.                                        |

### 5.8. Warstwa komunikacji z API

| Moduł                   | Opis                                                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Warstwa request helpers | Zestaw lekkich helperów `fetchWithTimeout`, redirect helpers i mapperów błędów używanych lokalnie przez hooki admin/dashboard/auth. |

### 5.9. Komponenty Shadcn/ui (istniejące i planowane)

Istniejące: `Button`, `Card`, `Avatar`, `Badge`, `Input`, `Textarea`, `Sheet`, `AlertDialog`, `Tooltip`, `Separator`, `DropdownMenu`.

Do ewentualnego dodania w kolejnych iteracjach: `Form`, `Label`, `Select`, dodatkowe `Skeleton` i `Switch` tam, gdzie będą potrzebne nowe widoki.

Wszystkie komponenty w `src/components/ui/`, styl `new-york`, spójne z aktualną konfiguracją `components.json`.
