# Plan implementacji widoku Dashboard — Edycja profilu

## 1. Przegląd

Widok edycji profilu schroniska umożliwia zalogowanemu użytkownikowi (roli `shelter`) przeglądanie i aktualizowanie danych swojego profilu. Obejmuje formularz z polami edycyjnymi (nazwa, miasto, adres, telefon, strona www), sekcję uploadu dokumentu weryfikacyjnego, przycisk geokodowania adresu oraz wyświetlanie aktualnych współrzędnych geograficznych. Widok jest częścią dashboardu i wymaga aktywnej sesji użytkownika.

## 2. Routing widoku

- **Ścieżka:** `/dashboard/profile`
- **Plik strony:** `src/pages/dashboard/profile.astro`
- **Prerenderowanie:** wyłączone (`export const prerender = false`)
- **Ochrona:** Guard middleware + auth check w `DashboardLayout` (przekierowanie na `/auth/login` jeśli brak sesji)

## 3. Struktura komponentów

```
profile.astro (strona Astro)
└── DashboardLayout.astro
    └── ProfileForm (React island, client:load)
        ├── FormErrorAlert (istniejący, src/components/auth/FormErrorAlert.tsx)
        ├── ProfileInfoSection
        │   ├── Field (sub-komponent wewnętrzny)
        │   ├── Input (shadcn/ui)
        │   └── Button "Zapisz zmiany" (shadcn/ui)
        ├── GeocodeSection
        │   ├── Button "Geokoduj adres" (shadcn/ui)
        │   └── GeocodeResult (wyświetlenie współrzędnych i sformatowanego adresu)
        ├── VerificationDocumentSection
        │   ├── FileUploadDropzone (istniejący, src/components/auth/FileUploadDropzone.tsx)
        │   ├── CurrentDocumentStatus (info o aktualnym dokumencie)
        │   └── Button "Wyślij dokument" (shadcn/ui)
        └── Toaster (sonner — do dodania jako zależność)
```

## 4. Szczegóły komponentów

### 4.1. `profile.astro` (strona Astro)

- **Opis:** Strona Astro opakowująca React island `ProfileForm`. Pobiera dane profilu po stronie serwera i przekazuje je jako propsy do wyspy React.
- **Główne elementy:**
  - Import i użycie `DashboardLayout`
  - Pobranie sesji użytkownika z `Astro.locals.supabase.auth.getUser()`
  - Pobranie profilu przez `ProfileService.getAuthenticatedProfile(user.id)`
  - Renderowanie `<ProfileForm profile={profile} client:load />`
- **Obsługiwane interakcje:** Brak — strona statyczna przekazująca dane do React
- **Walidacja:** Brak — auth guard obsługiwany przez `DashboardLayout`
- **Typy:** `ProfileMeDTO`
- **Propsy:** Brak (strona najwyższego poziomu)

### 4.2. `ProfileForm` (React island)

- **Opis:** Główny komponent formularza edycji profilu. Zarządza stanem formularza, walidacją, komunikacją z API i wyświetlaniem powiadomień. Składa się z trzech logicznych sekcji: dane profilu, geokodowanie i dokument weryfikacyjny.
- **Główne elementy:**
  - `<form>` z atrybutem `noValidate` i `aria-label="Formularz edycji profilu"`
  - Sekcja danych profilu (pola: nazwa, miasto, adres, telefon, strona www)
  - Sekcja informacji tylko do odczytu (rola, status, NIP, data utworzenia)
  - `FormErrorAlert` — dla błędów API
  - Przycisk „Zapisz zmiany"
  - Sekcja geokodowania — przycisk + wynik
  - Sekcja dokumentu weryfikacyjnego — upload + status aktualnego dokumentu
  - `Toaster` z biblioteki sonner
- **Obsługiwane interakcje:**
  - Zmiana wartości pól formularza (onChange)
  - Utrata focusu na polu (onBlur — walidacja inline)
  - Submit formularza (onSubmit — zapis profilu przez PATCH)
  - Kliknięcie „Geokoduj adres" (POST geocode)
  - Wybór/usunięcie pliku weryfikacyjnego
  - Kliknięcie „Wyślij dokument" (POST upload)
- **Walidacja:**
  - `name`: wymagane, 1–255 znaków
  - `city`: wymagane, 1–100 znaków
  - `address`: wymagane, 1–500 znaków
  - `phone_number`: opcjonalne, format E.164 (`/^\+?[1-9]\d{1,14}$/`), maks. 20 znaków
  - `website_url`: opcjonalne, poprawny URL (http/https), maks. 255 znaków
  - Plik: PDF/JPG/PNG, maks. 5 MB
- **Typy:** `ProfileMeDTO`, `ProfileFormData`, `ProfileFieldErrors`, `UpdateProfileCommand`, `ProfileUpdateResponseDTO`, `GeocodeCommand`, `GeocodeResponseDTO`, `VerificationDocumentUploadResponseDTO`, `ErrorResponse`
- **Propsy:**
  ```typescript
  interface ProfileFormProps {
    profile: ProfileMeDTO;
  }
  ```

### 4.3. `ProfileInfoSection` (sekcja wewnętrzna ProfileForm)

- **Opis:** Sekcja wyświetlająca pola do odczytu (status, rola, NIP) oraz edytowalne pola tekstowe profilu. Nie jest osobnym komponentem — logicznie wyodrębniona w ramach `ProfileForm`.
- **Główne elementy:**
  - Pola tylko do odczytu: status (Badge), rola, NIP, data utworzenia — wyświetlane jako tekst/badge
  - Pola edytowalne w komponentach `Field` + `Input`:
    - Nazwa schroniska (pełna szerokość)
    - Miasto + Telefon (2 kolumny na `sm+`)
    - Adres (pełna szerokość, z przyciskiem geokodowania inline)
    - Strona www (pełna szerokość)
  - Przycisk „Zapisz zmiany"
- **Obsługiwane interakcje:** onChange, onBlur, onSubmit
- **Walidacja:** Jak opisano w 4.2
- **Typy:** `ProfileFormData`, `ProfileFieldErrors`

### 4.4. `GeocodeSection` (sekcja wewnętrzna ProfileForm)

- **Opis:** Sekcja z przyciskiem geokodowania i wyświetlaniem wyników. Przycisk pobiera wartość pola `address` z formularza i wysyła zapytanie do API. Po sukcesie wyświetla sformatowany adres i współrzędne.
- **Główne elementy:**
  - Przycisk „Geokoduj adres" z ikoną (obok lub pod polem adresu)
  - Spinner/loading state podczas geokodowania
  - Panel wynikowy: sformatowany adres + współrzędne (lat, lon)
  - Komunikat błędu jeśli adres nie został znaleziony
- **Obsługiwane interakcje:**
  - Kliknięcie przycisku geokoduj
- **Walidacja:**
  - Adres nie może być pusty (walidacja przed wysłaniem)
  - Adres musi mieć 1–500 znaków
- **Typy:** `GeocodeCommand`, `GeocodeResponseDTO`, `Location`
- **Propsy:** Stan komponentu zarządzany przez rodzica `ProfileForm` (address value, isGeocoding, geocodeResult)

### 4.5. `VerificationDocumentSection` (sekcja wewnętrzna ProfileForm)

- **Opis:** Sekcja obsługująca upload dokumentu weryfikacyjnego. Wyświetla informację o aktualnie wgranym dokumencie (jeśli istnieje) oraz umożliwia wgranie nowego.
- **Główne elementy:**
  - Informacja o stanie dokumentu: „Dokument wgrany" (z nazwą ścieżki/datą) lub „Brak dokumentu"
  - `FileUploadDropzone` — istniejący komponent do wyboru pliku
  - Przycisk „Wyślij dokument" (aktywny tylko gdy plik został wybrany)
  - Spinner/loading state podczas uploadu
- **Obsługiwane interakcje:**
  - Wybór pliku (drag & drop lub klik)
  - Usunięcie wybranego pliku
  - Kliknięcie „Wyślij dokument"
- **Walidacja:**
  - Typ pliku: application/pdf, image/jpeg, image/png
  - Rozmiar: maks. 5 MB
- **Typy:** `VerificationDocumentUploadResponseDTO`
- **Propsy:** Stan zarządzany przez rodzica `ProfileForm` (file, isUploading, currentDocPath)

## 5. Typy

### 5.1. Typy istniejące (z `src/types.ts`)

- **`ProfileMeDTO`** — pełne dane profilu użytkownika (id, role, status, name, nip, city, address, location, phone_number, website_url, verification_doc_path, ai_usage_count, created_at, updated_at)
- **`UpdateProfileCommand`** — ciało żądania PATCH (name?, city?, address?, phone_number?, website_url?)
- **`ProfileUpdateResponseDTO`** — odpowiedź po aktualizacji (id, name, city, updated_at)
- **`VerificationDocumentUploadResponseDTO`** — odpowiedź po uploadzie (verification_doc_path, uploaded_at)
- **`GeocodeCommand`** — ciało żądania geokodowania (address: string)
- **`GeocodeResponseDTO`** — odpowiedź geokodowania (location: Location, formatted_address: string)
- **`Location`** — współrzędne (lat: number, lon: number)
- **`ErrorResponse`** — standardowa odpowiedź błędu (error: { code, message, details? })
- **`ErrorDetail`** — szczegół błędu walidacji (field, message)
- **`ShelterStatus`** — enum statusu schroniska
- **`UserRole`** — enum roli użytkownika

### 5.2. Nowe typy (do stworzenia w `src/components/profile/ProfileForm.tsx` lub wyodrębnione)

#### `ProfileFormData`
Dane formularza edycji profilu — odzwierciedlają edytowalne pola:
```typescript
interface ProfileFormData {
  name: string;         // Nazwa schroniska, wymagane, 1–255 znaków
  city: string;         // Miasto, wymagane, 1–100 znaków
  address: string;      // Adres, wymagane, 1–500 znaków
  phone_number: string; // Telefon, opcjonalne, format E.164
  website_url: string;  // Strona www, opcjonalne, poprawny URL
}
```

#### `ProfileFieldErrors`
Błędy walidacji poszczególnych pól:
```typescript
interface ProfileFieldErrors {
  name?: string;
  city?: string;
  address?: string;
  phone_number?: string;
  website_url?: string;
}
```

#### `ProfileFormProps`
Propsy dla głównego komponentu:
```typescript
interface ProfileFormProps {
  profile: ProfileMeDTO;
}
```

## 6. Zarządzanie stanem

Stan jest zarządzany lokalnie w komponencie `ProfileForm` za pomocą hooków React (`useState`, `useCallback`, `useMemo`, `useId`). Nie jest wymagany globalny store ani dedykowany custom hook — logika jest samodzielna i ograniczona do jednego komponentu.

### Zmienne stanu:

| Zmienna | Typ | Cel |
|---------|-----|-----|
| `formData` | `ProfileFormData` | Aktualne wartości pól formularza |
| `fieldErrors` | `ProfileFieldErrors` | Błędy walidacji per pole |
| `apiError` | `string \| null` | Globalny błąd z API |
| `isSaving` | `boolean` | Trwa zapis profilu (PATCH) |
| `isGeocoding` | `boolean` | Trwa geokodowanie |
| `isUploading` | `boolean` | Trwa upload dokumentu |
| `hasSubmitted` | `boolean` | Czy formularz był już raz wysłany (do inline walidacji) |
| `geocodeResult` | `GeocodeResponseDTO \| null` | Wynik geokodowania |
| `currentDocPath` | `string \| null` | Aktualna ścieżka dokumentu weryfikacyjnego |
| `currentLocation` | `Location \| null` | Aktualne współrzędne (z profilu lub geokodowania) |
| `uploadFile` | `File \| null` | Wybrany plik do uploadu |
| `uploadFileError` | `string \| undefined` | Błąd walidacji pliku |

### Inicjalizacja stanu:
`formData` jest inicjalizowane na podstawie `profile` prop:
```typescript
const initialFormData: ProfileFormData = {
  name: profile.name ?? "",
  city: profile.city ?? "",
  address: profile.address ?? "",
  phone_number: profile.phone_number ?? "",
  website_url: profile.website_url ?? "",
};
```

### Przepływ walidacji:
1. **onBlur:** Walidacja pojedynczego pola na utratę focusu
2. **onChange (po pierwszym submicie):** Inline re-walidacja zmienionego pola
3. **onSubmit:** Walidacja wszystkich pól; jeśli błędy — focus na pierwszy błędny element

## 7. Integracja API

### 7.1. Pobranie profilu (server-side w Astro)

- **Moment:** Ładowanie strony `profile.astro`
- **Wywołanie:** `ProfileService.getAuthenticatedProfile(user.id)` (bezpośrednio przez serwis, nie fetch)
- **Typ odpowiedzi:** `ProfileMeDTO`
- **Przekazanie:** Jako prop `profile` do `ProfileForm`

### 7.2. Aktualizacja profilu

- **Moment:** Submit formularza (kliknięcie „Zapisz zmiany")
- **Endpoint:** `PATCH /api/profiles/me`
- **Typ żądania:** `UpdateProfileCommand` (JSON)
- **Typ odpowiedzi:** `ProfileUpdateResponseDTO`
- **Nagłówki:** `Content-Type: application/json` (cookies z sesją wysyłane automatycznie)
- **Akcja po sukcesie:** Toast sukcesu (sonner), aktualizacja stanu formularza
- **Timeout:** 15 000 ms

### 7.3. Upload dokumentu

- **Moment:** Kliknięcie „Wyślij dokument" po wyborze pliku
- **Endpoint:** `POST /api/profiles/me/verification-document`
- **Typ żądania:** `FormData` z polem `file`
- **Typ odpowiedzi:** `VerificationDocumentUploadResponseDTO`
- **Nagłówki:** Automatyczne (multipart/form-data)
- **Akcja po sukcesie:** Toast sukcesu, aktualizacja `currentDocPath`, reset stanu pliku
- **Timeout:** 60 000 ms

### 7.4. Geokodowanie adresu

- **Moment:** Kliknięcie „Geokoduj adres"
- **Endpoint:** `POST /api/profiles/me/geocode`
- **Typ żądania:** `GeocodeCommand` (JSON)
- **Typ odpowiedzi:** `GeocodeResponseDTO`
- **Nagłówki:** `Content-Type: application/json`
- **Akcja po sukcesie:** Wyświetlenie sformatowanego adresu i współrzędnych, aktualizacja `geocodeResult` i `currentLocation`
- **Timeout:** 15 000 ms

### 7.5. Helper do fetch z timeoutem

Reużycie wzorca z `RegisterForm`:
```typescript
function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response>
```

## 8. Interakcje użytkownika

| # | Interakcja | Oczekiwany wynik |
|---|-----------|------------------|
| 1 | Załadowanie strony | Formularz pre-wypełniony aktualnymi danymi profilu, wyświetlony status i rola |
| 2 | Edycja pola tekstowego | Aktualizacja stanu `formData`; jeśli `hasSubmitted=true` — inline walidacja |
| 3 | Opuszczenie pola (blur) | Walidacja pola, wyświetlenie błędu inline jeśli niepoprawne |
| 4 | Kliknięcie „Zapisz zmiany" | Walidacja wszystkich pól → jeśli błędy: focus na pierwszy błąd; jeśli OK: PATCH API → toast sukcesu lub błąd |
| 5 | Kliknięcie „Geokoduj adres" | Walidacja pola adres → POST geocode → wyświetlenie współrzędnych i sformatowanego adresu LUB komunikat o błędzie |
| 6 | Wybór pliku (drag & drop / klik) | Walidacja typu i rozmiaru → wyświetlenie podglądu pliku lub błąd |
| 7 | Usunięcie wybranego pliku | Reset stanu pliku i błędu walidacji pliku |
| 8 | Kliknięcie „Wyślij dokument" | POST upload → toast sukcesu, aktualizacja statusu dokumentu LUB błąd |
| 9 | Próba edycji podczas zapisu | Przyciski i pola wyłączone (`disabled`) podczas operacji asynchronicznych |

## 9. Warunki i walidacja

### 9.1. Walidacja pól formularza (klient)

| Pole | Warunek | Komunikat błędu |
|------|---------|-----------------|
| `name` | Wymagane, niepuste po trim | „Nazwa schroniska jest wymagana." |
| `name` | min 1, maks. 255 znaków | „Nazwa schroniska może mieć maksymalnie 255 znaków." |
| `city` | Wymagane, niepuste po trim | „Miasto jest wymagane." |
| `city` | min 1, maks. 100 znaków | „Nazwa miasta może mieć maksymalnie 100 znaków." |
| `address` | Wymagane, niepuste po trim | „Adres jest wymagany." |
| `address` | min 1, maks. 500 znaków | „Adres może mieć maksymalnie 500 znaków." |
| `phone_number` | Opcjonalne; jeśli podane — regex `/^\+?[1-9]\d{1,14}$/` | „Podaj poprawny numer telefonu." |
| `website_url` | Opcjonalne; jeśli podane — poprawny URL (http/https) | „Podaj poprawny adres URL." |
| `file` | Typ: PDF, JPG, PNG | „Akceptowane formaty: PDF, JPG, PNG." |
| `file` | Rozmiar ≤ 5 MB | „Plik nie może przekraczać 5 MB." |

### 9.2. Walidacja po stronie API (serwer)

- `UpdateProfileCommandSchema` (Zod) — walidacja analogiczna do klienta
- Sprawdzenie chronionych pól: `status`, `role`, `nip`, `location`, `verification_doc_path`, `ai_usage_count` — jeśli wykryte w body → 403
- Minimum jedno pole wymagane do aktualizacji
- `GeocodeCommandSchema` — adres wymagany, 1–500 znaków
- `FileUploadSchema` — typ MIME + rozmiar

### 9.3. Wpływ walidacji na UI

- Błędy inline wyświetlane pod każdym polem (element `<p>` z `role="alert"`)
- Pole z błędem otrzymuje `aria-invalid="true"` i `aria-describedby` wskazujący na komunikat błędu
- Przycisk „Zapisz zmiany" — aktywny zawsze, walidacja na submit
- Przycisk „Geokoduj adres" — wyłączony gdy pole adresu jest puste lub trwa geokodowanie
- Przycisk „Wyślij dokument" — wyłączony gdy nie wybrano pliku, plik ma błąd walidacji, lub trwa upload

## 10. Obsługa błędów

### 10.1. Błędy API profilu (PATCH)

| Kod HTTP | ErrorCode | Obsługa |
|----------|-----------|---------|
| 400 | `VALIDATION_ERROR` | Wyświetlenie `FormErrorAlert` z komunikatem; mapowanie `details` na `fieldErrors` jeśli dostępne |
| 401 | `UNAUTHORIZED` | Przekierowanie na `/auth/login` |
| 403 | `FORBIDDEN` | Wyświetlenie `FormErrorAlert` — „Nie można zmodyfikować chronionych pól" |
| 500 | `INTERNAL_ERROR` | Toast błędu sonner — „Wystąpił problem z serwerem. Spróbuj ponownie." |

### 10.2. Błędy geokodowania (POST geocode)

| Kod HTTP | ErrorCode | Obsługa |
|----------|-----------|---------|
| 400 | `NOT_FOUND` | Komunikat pod sekcją geokodowania — „Nie znaleziono adresu. Sprawdź poprawność." |
| 401 | `UNAUTHORIZED` | Przekierowanie na `/auth/login` |
| 500 | `INTERNAL_ERROR` | Toast błędu — „Nie udało się geokodować adresu." |

### 10.3. Błędy uploadu dokumentu (POST verification-document)

| Kod HTTP | ErrorCode | Obsługa |
|----------|-----------|---------|
| 400 | `VALIDATION_ERROR` | Wyświetlenie błędu pod `FileUploadDropzone` |
| 401 | `UNAUTHORIZED` | Przekierowanie na `/auth/login` |
| 500 | `INTERNAL_ERROR` | Toast błędu — „Nie udało się przesłać dokumentu." |

### 10.4. Błędy sieciowe

- Timeout fetch → komunikat „Przekroczono czas oczekiwania. Sprawdź połączenie i spróbuj ponownie."
- Brak połączenia → komunikat „Nie można połączyć się z serwerem. Sprawdź połączenie internetowe."
- Oba wyświetlane jako `FormErrorAlert` lub toast w zależności od kontekstu operacji

## 11. Kroki implementacji

1. **Instalacja zależności Sonner:**
   - Dodanie `sonner` do `package.json`
   - Dodanie komponentu `Toaster` z sonner do `DashboardLayout.astro` (jako React island)

2. **Utworzenie schematu walidacji formularza edycji profilu:**
   - Plik: `src/lib/validation/profile-form.schemas.ts`
   - Reużycie istniejących walidatorów z `register.schemas.ts` (validateName, validateCity, validateAddress, validatePhone, validateWebsite)
   - Eksport typów `ProfileFormData`, `ProfileFieldErrors`
   - Eksport funkcji: `validateProfileField`, `validateProfileForm`, `hasProfileErrors`

3. **Utworzenie strony Astro:**
   - Plik: `src/pages/dashboard/profile.astro`
   - Pobranie danych profilu server-side (supabase auth + ProfileService)
   - Przekazanie `ProfileMeDTO` do React island

4. **Utworzenie komponentu `ProfileForm`:**
   - Plik: `src/components/profile/ProfileForm.tsx`
   - Implementacja stanu formularza z inicjalizacją z props
   - Implementacja handlera onChange/onBlur z walidacją inline
   - Sekcja pól edytowalnych z komponentami `Field` + `Input` (shadcn/ui)
   - Sekcja pól tylko do odczytu (status, rola, NIP) z komponentem `Badge` (shadcn/ui)

5. **Implementacja zapisu profilu (PATCH):**
   - Handler `handleSubmit` z walidacją → fetch → obsługa odpowiedzi
   - Toast sukcesu (sonner) po udanym zapisie
   - Focus na pierwszy błąd w przypadku walidacji

6. **Implementacja sekcji geokodowania:**
   - Przycisk „Geokoduj adres" z osobnym stanem ładowania
   - Wywołanie `POST /api/profiles/me/geocode` z aktualną wartością adresu
   - Wyświetlenie wyniku: sformatowany adres + współrzędne (lat, lon)
   - Obsługa błędu „adres nie znaleziony"

7. **Implementacja sekcji uploadu dokumentu:**
   - Reużycie `FileUploadDropzone` z `src/components/auth/FileUploadDropzone.tsx`
   - Wyświetlenie statusu aktualnego dokumentu (ścieżka z `verification_doc_path`)
   - Osobny przycisk „Wyślij dokument" z walidacją pliku
   - Upload przez `POST /api/profiles/me/verification-document` (FormData)
   - Aktualizacja stanu po sukcesie

8. **Dostępność:**
   - Etykiety `<label>` z `htmlFor` dla wszystkich pól
   - `aria-invalid` i `aria-describedby` dla pól z błędami
   - `role="alert"` na komunikatach błędów
   - Grupowanie pól w `<fieldset>` z `<legend>`
   - Focus management: focus na pierwszy błąd po nieudanej walidacji
   - `aria-busy` na przyciskach podczas operacji asynchronicznych
   - `aria-live="polite"` na sekcji wyników geokodowania

9. **Stylowanie:**
   - Layout responsywny: pola w 2 kolumnach na `sm+`, pełna szerokość na mobile
   - Użycie klas Tailwind 4 z wariantami `sm:`, `md:`
   - Spójność z istniejącymi komponentami formularza (wzorce z `RegisterForm`)
   - Separacja wizualna sekcji (dane, geokodowanie, dokument) za pomocą `Separator` lub nagłówków

10. **Testowanie manualne:**
    - Weryfikacja pre-wypełnienia formularza danymi profilu
    - Weryfikacja walidacji inline (blur + submit)
    - Weryfikacja zapisu profilu (PATCH) z toastem sukcesu
    - Weryfikacja geokodowania — sukces i błąd
    - Weryfikacja uploadu dokumentu — sukces i błąd
    - Weryfikacja stanów ładowania (disabled, spinner)
    - Weryfikacja obsługi błędów sieciowych
    - Weryfikacja dostępności (nawigacja klawiaturą, czytniki ekranowe)
