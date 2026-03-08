# Plan implementacji widoku Rejestracji

## 1. Przegląd

Widok rejestracji (`/auth/register`) umożliwia pracownikowi schroniska utworzenie nowego konta w systemie Shelterly. Formularz składa się z trzech sekcji: dane logowania (email, hasło), dane schroniska (nazwa, NIP, miasto, adres, telefon, strona www) oraz upload dokumentu weryfikacyjnego. Po pomyślnej rejestracji użytkownik jest przekierowywany na stronę `/auth/pending` z informacją o oczekiwaniu na weryfikację przez administratora.

Widok adresuje historię użytkownika **US.1 — Rejestracja i Weryfikacja**: pracownik schroniska rejestruje placówkę i wgrywa dokumenty potwierdzające, aby móc oficjalnie zbierać dary. Konto po rejestracji otrzymuje status `pending`.

## 2. Routing widoku

- **Ścieżka:** `/auth/register`
- **Plik strony Astro:** `src/pages/auth/register.astro`
- **Prerender:** `false` (dynamiczna strona SSR)
- **Guard serwerowy:** Jeśli użytkownik jest już zalogowany (sesja Supabase w cookies), natychmiastowy redirect na `/dashboard`

## 3. Struktura komponentów

```
register.astro (strona Astro)
└── Layout (title="Zarejestruj się — Shelterly")
    └── <main>
        └── RegisterForm (client:load) — wyspa React
            ├── Card (Shadcn)
            │   ├── CardHeader (tytuł, opis)
            │   ├── <form>
            │   │   ├── CardContent
            │   │   │   ├── FormErrorAlert (błąd API, jeśli istnieje)
            │   │   │   ├── <fieldset> "Dane logowania"
            │   │   │   │   ├── EmailField
            │   │   │   │   ├── PasswordField + PasswordStrengthIndicator
            │   │   │   │   └── ConfirmPasswordField
            │   │   │   ├── <fieldset> "Dane schroniska"
            │   │   │   │   ├── NameField
            │   │   │   │   ├── NipField
            │   │   │   │   ├── CityField
            │   │   │   │   ├── AddressField
            │   │   │   │   ├── PhoneField (opcjonalne)
            │   │   │   │   └── WebsiteField (opcjonalne)
            │   │   │   └── <fieldset> "Dokument weryfikacyjny"
            │   │   │       └── FileUploadDropzone
            │   │   └── CardFooter
            │   │       ├── Button "Zarejestruj się"
            │   │       └── Link do /auth/login
```

## 4. Szczegóły komponentów

### 4.1. Strona `register.astro`

- **Opis:** Strona Astro działająca jako kontener routingu. Sprawdza sesję po stronie serwera i renderuje layout z wyspą React.
- **Główne elementy:**
  - Import `Layout` oraz `RegisterForm`
  - Guard sesji: `Astro.locals.supabase.auth.getUser()` — jeśli użytkownik zalogowany → `Astro.redirect("/dashboard")`
  - `<Layout title="Zarejestruj się — Shelterly">`
  - `<main class="flex min-h-screen items-center justify-center bg-background px-4 py-8">`
  - `<RegisterForm client:load />`
- **Obsługiwane interakcje:** Brak (logika delegowana do `RegisterForm`)
- **Walidacja:** Brak (delegowana do komponentu React)
- **Typy:** Brak
- **Propsy:** Brak

### 4.2. Komponent `RegisterForm`

- **Opis:** Główny formularz rejestracji — wyspa React (`client:load`). Zarządza stanem formularza, walidacją, wysyłką danych do API signup oraz uploadem dokumentu weryfikacyjnego. Zawiera trzy sekcje grupowane w `<fieldset>` z `<legend>`.
- **Główne elementy:**
  - `Card`, `CardHeader`, `CardContent`, `CardFooter` (Shadcn)
  - `FormErrorAlert` — wyświetla błąd API na górze formularza
  - Trzy `<fieldset>` z `<legend>`: „Dane logowania", „Dane schroniska", „Dokument weryfikacyjny"
  - Pola `Input` (Shadcn) z `<label>`, komunikatami walidacji (`aria-describedby`)
  - `PasswordStrengthIndicator` — wizualny wskaźnik siły hasła
  - `FileUploadDropzone` — obszar upload z drag & drop
  - `Button` submit z loading spinner
  - Link „Masz już konto? Zaloguj się" do `/auth/login`
- **Obsługiwane interakcje:**
  - Zmiana wartości pól (`onChange`) — aktualizacja stanu, walidacja inline po pierwszym submicie
  - Utrata focusu na polu (`onBlur`) — walidacja pojedynczego pola
  - Kliknięcie przycisków pokaż/ukryj hasło
  - Przeciągnięcie pliku na dropzone lub kliknięcie w dropzone → otwarcie natywnego file pickera
  - Usunięcie wybranego pliku (przycisk × przy nazwie pliku)
  - Submit formularza → pełna walidacja → wywołanie API → przekierowanie
- **Obsługiwana walidacja:**
  - Email: wymagany, format email, max 255 znaków
  - Hasło: wymagane, min 8 znaków, max 128 znaków, mała litera, wielka litera, cyfra, znak specjalny
  - Powtórzenie hasła: wymagane, musi być identyczne z hasłem
  - Nazwa schroniska: wymagana, min 2 znaki, max 255 znaków
  - NIP: wymagany, dokładnie 10 cyfr, walidacja sumy kontrolnej (algorytm wag: 6,5,7,2,3,4,5,6,7)
  - Miasto: wymagane, min 2 znaki, max 100 znaków
  - Adres: wymagany, min 5 znaków, max 255 znaków
  - Telefon (opcjonalny): format `+?[0-9\s-]{7,20}`
  - Strona www (opcjonalna): poprawny URL
  - Plik: wymagany, typy PDF/JPEG/PNG, max 5 MB
- **Typy:** `RegisterFormData`, `RegisterFieldErrors`, `PasswordStrength`, `SignupCommand`, `SignupResponseDTO`, `VerificationDocumentUploadResponseDTO`, `ErrorResponse`
- **Propsy:** Brak (komponent samodzielny)

### 4.3. Komponent `PasswordStrengthIndicator`

- **Opis:** Wizualny wskaźnik siły hasła wyświetlany pod polem hasła. Pokazuje pasek postępu z kolorami (czerwony → żółty → zielony) oraz listę wymagań z ikonami spełnione/niespełnione.
- **Główne elementy:**
  - Pasek postępu (`Progress` z Shadcn lub własny `<div>` z dynamiczną szerokością i kolorem)
  - Tekst opisowy siły: „Słabe" / „Średnie" / „Silne"
  - Lista wymagań z ikonami ✓/✗:
    - Min. 8 znaków
    - Mała litera
    - Wielka litera
    - Cyfra
    - Znak specjalny
- **Obsługiwane interakcje:** Brak — komponent prezentacyjny
- **Walidacja:** Brak — otrzymuje dane od rodzica
- **Typy:** `PasswordStrength`
- **Propsy:**
  - `password: string` — aktualne hasło do analizy
  - `visible: boolean` — czy wskaźnik jest widoczny (pokaż po wpisaniu pierwszego znaku)

### 4.4. Komponent `FileUploadDropzone`

- **Opis:** Obszar upload pliku z obsługą drag & drop i przycisku „Wybierz plik". Wyświetla podgląd nazwy wybranego pliku z możliwością usunięcia oraz informację o akceptowanych formatach i limicie rozmiaru.
- **Główne elementy:**
  - `<div>` z obsługą `onDragOver`, `onDragLeave`, `onDrop` i kliknięciem → ukryty `<input type="file">`
  - Ikona upload (SVG) + tekst „Przeciągnij plik lub kliknij, aby wybrać"
  - Tekst informacyjny: „PDF, JPG lub PNG, max 5 MB"
  - Po wybraniu pliku: nazwa pliku + rozmiar + przycisk usunięcia (×)
  - Komunikat błędu pod dropzone (powiązany `aria-describedby`)
- **Obsługiwane interakcje:**
  - Drag & Drop pliku na dropzone
  - Kliknięcie dropzone → otwarcie natywnego dialogu file
  - Kliknięcie przycisku „×" → usunięcie wybranego pliku
- **Walidacja:**
  - Typ pliku: `application/pdf`, `image/jpeg`, `image/png`
  - Rozmiar: max 5 MB (5 _ 1024 _ 1024 bytes)
  - Wymagane: plik musi być wybrany przed submitem
- **Typy:** Brak typów niestandardowych (operuje na natywnym `File`)
- **Propsy:**
  - `file: File | null` — aktualnie wybrany plik
  - `onFileSelect: (file: File | null) => void` — callback zmiany pliku
  - `error?: string` — komunikat błędu walidacji
  - `disabled?: boolean` — blokada podczas wysyłki

## 5. Typy

### 5.1. Istniejące typy (z `src/types.ts`)

- **`SignupCommand`** — body żądania POST `/api/auth/signup`:

  ```typescript
  interface SignupCommand {
    email: string;
    password: string;
    profile: {
      name: string;
      nip: string;
      city: string;
      address: string;
      phone_number?: string;
      website_url?: string;
    };
  }
  ```

- **`SignupResponseDTO`** — odpowiedź 201 z API signup:

  ```typescript
  interface SignupResponseDTO {
    message: string;
    user: { id: string; email: string };
    profile: { id: string; status: ShelterStatus; name: string };
  }
  ```

- **`VerificationDocumentUploadResponseDTO`** — odpowiedź z API uploadu dokumentu:

  ```typescript
  interface VerificationDocumentUploadResponseDTO {
    verification_doc_path: string;
    uploaded_at: string;
  }
  ```

- **`ErrorResponse`** — standardowa odpowiedź błędu API:
  ```typescript
  interface ErrorResponse {
    error: { code: ErrorCode; message: string; details?: ErrorDetail[] };
  }
  ```

### 5.2. Nowe typy (do zdefiniowania w `RegisterForm.tsx`)

- **`RegisterFormData`** — stan formularza rejestracji:

  ```typescript
  interface RegisterFormData {
    email: string;
    password: string;
    confirmPassword: string;
    name: string;
    nip: string;
    city: string;
    address: string;
    phone_number: string;
    website_url: string;
    file: File | null;
  }
  ```

- **`RegisterFieldErrors`** — błędy walidacji poszczególnych pól:

  ```typescript
  interface RegisterFieldErrors {
    email?: string;
    password?: string;
    confirmPassword?: string;
    name?: string;
    nip?: string;
    city?: string;
    address?: string;
    phone_number?: string;
    website_url?: string;
    file?: string;
  }
  ```

- **`PasswordStrength`** — wynik analizy siły hasła:
  ```typescript
  interface PasswordStrength {
    score: 0 | 1 | 2 | 3 | 4 | 5; // 0-5 na podstawie spełnionych kryteriów
    checks: {
      minLength: boolean; // min 8 znaków
      hasLowercase: boolean; // zawiera małą literę
      hasUppercase: boolean; // zawiera wielką literę
      hasDigit: boolean; // zawiera cyfrę
      hasSpecialChar: boolean; // zawiera znak specjalny
    };
    label: "Słabe" | "Średnie" | "Silne";
  }
  ```

## 6. Zarządzanie stanem

### 6.1. Stan komponentu `RegisterForm`

Stan zarządzany lokalnie w `RegisterForm` za pomocą hooków `useState`:

| Zmienna stanu         | Typ                   | Cel                                                             |
| --------------------- | --------------------- | --------------------------------------------------------------- |
| `formData`            | `RegisterFormData`    | Wartości wszystkich pól formularza                              |
| `fieldErrors`         | `RegisterFieldErrors` | Błędy walidacji per pole                                        |
| `apiError`            | `string \| null`      | Komunikat błędu z API (wyświetlany na górze)                    |
| `isSubmitting`        | `boolean`             | Blokada UI podczas wysyłki (spinner, disabled)                  |
| `hasSubmitted`        | `boolean`             | Flaga czy formularz był już submitted (włącza walidację inline) |
| `showPassword`        | `boolean`             | Przełącznik widoczności hasła                                   |
| `showConfirmPassword` | `boolean`             | Przełącznik widoczności powtórzenia hasła                       |

### 6.2. Custom hook — nie jest wymagany

Stan jest wystarczająco prosty do zarządzania bezpośrednio w komponencie. Funkcje walidacji będą wyekstrahowane jako czyste funkcje pomocnicze w tym samym pliku (wzorzec z `LoginForm.tsx`). Ewentualnie, jeśli komponent się rozrośnie, logika formularza może zostać wyekstrahowana do hooka `useRegisterForm`, ale nie jest to konieczne na start.

### 6.3. Funkcje pomocnicze (czyste funkcje)

- `validateEmail(value: string): string | undefined`
- `validatePassword(value: string): string | undefined`
- `validateConfirmPassword(password: string, confirm: string): string | undefined`
- `validateName(value: string): string | undefined`
- `validateNip(value: string): string | undefined` — walidacja formatu (10 cyfr) + suma kontrolna (wagi: 6,5,7,2,3,4,5,6,7)
- `validateCity(value: string): string | undefined`
- `validateAddress(value: string): string | undefined`
- `validatePhone(value: string): string | undefined` — opcjonalne pole
- `validateWebsite(value: string): string | undefined` — opcjonalne pole
- `validateFile(file: File | null): string | undefined`
- `validateAll(data: RegisterFormData): RegisterFieldErrors`
- `hasErrors(errors: RegisterFieldErrors): boolean`
- `computePasswordStrength(password: string): PasswordStrength`
- `mapApiError(errorData: ErrorResponse): string`

## 7. Integracja API

Rejestracja obejmuje dwa kolejne wywołania API:

### 7.1. Krok 1: Rejestracja konta — `POST /api/auth/signup`

- **Typ żądania:** `SignupCommand` (JSON)
- **Typ odpowiedzi sukcesu (201):** `SignupResponseDTO`
- **Typ odpowiedzi błędu:** `ErrorResponse`
- **Mapowanie danych formularza na `SignupCommand`:**
  ```typescript
  const command: SignupCommand = {
    email: formData.email,
    password: formData.password,
    profile: {
      name: formData.name,
      nip: formData.nip,
      city: formData.city,
      address: formData.address,
      ...(formData.phone_number ? { phone_number: formData.phone_number } : {}),
      ...(formData.website_url ? { website_url: formData.website_url } : {}),
    },
  };
  ```
- **Wywołanie:**
  ```typescript
  const response = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  ```

### 7.2. Krok 2: Upload dokumentu — `POST /api/profiles/me/verification-document`

- **Typ żądania:** `FormData` z polem `file`
- **Typ odpowiedzi sukcesu (200):** `VerificationDocumentUploadResponseDTO`
- **Typ odpowiedzi błędu:** `ErrorResponse`
- **Uwaga:** Endpoint wymaga autentykacji — po signup Supabase ustawia sesję w cookies, więc kolejne żądanie z przeglądarki będzie zawierało token.
- **Wywołanie:**
  ```typescript
  const uploadFormData = new FormData();
  uploadFormData.append("file", formData.file);
  const uploadResponse = await fetch("/api/profiles/me/verification-document", {
    method: "POST",
    body: uploadFormData,
  });
  ```

### 7.3. Sekwencja po submit

1. Walidacja wszystkich pól po stronie klienta
2. Jeśli walidacja OK → `setIsSubmitting(true)`, wyczyść `apiError`
3. Wywołanie `POST /api/auth/signup`
4. Jeśli signup sukces (201) i plik istnieje → wywołanie `POST /api/profiles/me/verification-document`
5. Jeśli upload sukces → `window.location.href = "/auth/pending"`
6. Jeśli upload fail → wyświetl ostrzeżenie, ale i tak przekieruj na `/auth/pending` (konto zostało już utworzone; dokument można dodać później)
7. Jeśli signup fail → mapowanie błędu i wyświetlenie w `FormErrorAlert`
8. `setIsSubmitting(false)` w `finally`

## 8. Interakcje użytkownika

| Interakcja                        | Oczekiwany rezultat                                                                                                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Wpisanie tekstu w pole formularza | Aktualizacja stanu `formData`, walidacja inline jeśli `hasSubmitted === true`                                                      |
| Opuszczenie pola (blur)           | Walidacja pojedynczego pola, wyświetlenie ewentualnego błędu                                                                       |
| Wpisanie hasła                    | Aktualizacja `PasswordStrengthIndicator` w czasie rzeczywistym                                                                     |
| Kliknięcie ikony oka przy haśle   | Toggle widoczności hasła (type text/password)                                                                                      |
| Przeciągnięcie pliku na dropzone  | Wizualne podświetlenie dropzone (border highlight), po upuszczeniu: walidacja typu/rozmiaru, wyświetlenie nazwy pliku              |
| Kliknięcie dropzone               | Otwarcie natywnego file pickera, po wybraniu: walidacja, wyświetlenie nazwy                                                        |
| Kliknięcie × przy nazwie pliku    | Usunięcie wybranego pliku, powrót do stanu pustego dropzone                                                                        |
| Kliknięcie „Zarejestruj się"      | Pełna walidacja → jeśli błędy: wyświetlenie, focus na pierwsze pole z błędem; jeśli OK: spinner, disable formularza, wywołanie API |
| Kliknięcie „Zaloguj się" (link)   | Nawigacja na `/auth/login`                                                                                                         |
| Pomyślna rejestracja              | Przekierowanie na `/auth/pending`                                                                                                  |

## 9. Warunki i walidacja

### 9.1. Walidacja po stronie klienta (synchroniczna)

| Pole            | Warunek                 | Komunikat błędu                                         | Komponent          |
| --------------- | ----------------------- | ------------------------------------------------------- | ------------------ |
| email           | Niepuste                | „Adres e-mail jest wymagany."                           | RegisterForm       |
| email           | Format email            | „Podaj poprawny adres e-mail."                          | RegisterForm       |
| email           | Max 255 znaków          | „Adres e-mail może mieć maksymalnie 255 znaków."        | RegisterForm       |
| password        | Niepuste                | „Hasło jest wymagane."                                  | RegisterForm       |
| password        | Min 8 znaków            | „Hasło musi mieć co najmniej 8 znaków."                 | RegisterForm       |
| password        | Max 128 znaków          | „Hasło może mieć maksymalnie 128 znaków."               | RegisterForm       |
| password        | Mała litera             | „Hasło musi zawierać co najmniej jedną małą literę."    | RegisterForm       |
| password        | Wielka litera           | „Hasło musi zawierać co najmniej jedną wielką literę."  | RegisterForm       |
| password        | Cyfra                   | „Hasło musi zawierać co najmniej jedną cyfrę."          | RegisterForm       |
| password        | Znak specjalny          | „Hasło musi zawierać co najmniej jeden znak specjalny." | RegisterForm       |
| confirmPassword | Niepuste                | „Powtórzenie hasła jest wymagane."                      | RegisterForm       |
| confirmPassword | Zgodność z hasłem       | „Hasła nie są identyczne."                              | RegisterForm       |
| name            | Niepuste                | „Nazwa schroniska jest wymagana."                       | RegisterForm       |
| name            | Min 2 znaki             | „Nazwa schroniska musi mieć co najmniej 2 znaki."       | RegisterForm       |
| name            | Max 255 znaków          | „Nazwa schroniska może mieć maksymalnie 255 znaków."    | RegisterForm       |
| nip             | Niepuste                | „NIP jest wymagany."                                    | RegisterForm       |
| nip             | Dokładnie 10 cyfr       | „NIP musi składać się z dokładnie 10 cyfr."             | RegisterForm       |
| nip             | Suma kontrolna          | „Podany NIP jest nieprawidłowy (błąd sumy kontrolnej)." | RegisterForm       |
| city            | Niepuste                | „Miasto jest wymagane."                                 | RegisterForm       |
| city            | Min 2 znaki             | „Miasto musi mieć co najmniej 2 znaki."                 | RegisterForm       |
| city            | Max 100 znaków          | „Nazwa miasta może mieć maksymalnie 100 znaków."        | RegisterForm       |
| address         | Niepusty                | „Adres jest wymagany."                                  | RegisterForm       |
| address         | Min 5 znaków            | „Adres musi mieć co najmniej 5 znaków."                 | RegisterForm       |
| address         | Max 255 znaków          | „Adres może mieć maksymalnie 255 znaków."               | RegisterForm       |
| phone_number    | Format (opcjonalne)     | „Podaj poprawny numer telefonu."                        | RegisterForm       |
| website_url     | Format URL (opcjonalne) | „Podaj poprawny adres URL."                             | RegisterForm       |
| file            | Niepusty (wymagany)     | „Dokument weryfikacyjny jest wymagany."                 | FileUploadDropzone |
| file            | Typ: PDF, JPEG, PNG     | „Akceptowane formaty: PDF, JPG, PNG."                   | FileUploadDropzone |
| file            | Max 5 MB                | „Plik nie może przekraczać 5 MB."                       | FileUploadDropzone |

### 9.2. Algorytm walidacji NIP (suma kontrolna)

```
Wagi: [6, 5, 7, 2, 3, 4, 5, 6, 7]
Suma = sum(digit[i] * weight[i]) dla i = 0..8
NIP jest poprawny jeśli: suma % 11 === digit[9]
```

### 9.3. Strategia walidacji

- **Przed pierwszym submitem:** walidacja tylko na `onBlur` (pojedyncze pole)
- **Po pierwszym submicie (`hasSubmitted = true`):** walidacja inline na każdy `onChange` + `onBlur`
- **Przy submit:** pełna walidacja wszystkich pól. Jeśli są błędy — focus na pierwszym polu z błędem
- Hasło jest walidowane z jednym komunikatem (pierwszy niespełniony warunek), ale `PasswordStrengthIndicator` pokazuje wszystkie wymagania jednocześnie

## 10. Obsługa błędów

### 10.1. Błędy walidacji klienta

Wyświetlane inline pod polem formularza (element `<p>` z `role="alert"`, powiązany z polem przez `aria-describedby`). Pole otrzymuje `aria-invalid={true}`.

### 10.2. Błędy API signup

| Kod HTTP | `ErrorCode`                       | Komunikat dla użytkownika                                            |
| -------- | --------------------------------- | -------------------------------------------------------------------- |
| 400      | `VALIDATION_ERROR`                | „Nieprawidłowe dane. Sprawdź formularz i spróbuj ponownie."          |
| 400      | `INVALID_REQUEST`                 | „Nieprawidłowe żądanie. Sprawdź dane i spróbuj ponownie."            |
| 409      | `CONFLICT`                        | „Konto z podanym adresem e-mail lub NIP już istnieje."               |
| 429      | `RATE_LIMIT_EXCEEDED`             | „Zbyt wiele prób. Spróbuj ponownie za chwilę."                       |
| 500      | `INTERNAL_ERROR`                  | „Wystąpił problem z serwerem. Spróbuj ponownie za chwilę."           |
| 503      | `SERVICE_UNAVAILABLE`             | „Serwis jest chwilowo niedostępny. Spróbuj ponownie później."        |
| —        | (brak odpowiedzi / network error) | „Nie można połączyć się z serwerem. Sprawdź połączenie internetowe." |

Błędy API wyświetlane w `FormErrorAlert` na górze formularza (wzorzec z `LoginForm`).

### 10.3. Błędy uploadu dokumentu

Jeśli rejestracja (signup) się powiodła, ale upload dokumentu nie:

- Wyświetl informację ostrzegawczą, ale **przekieruj na `/auth/pending`** — konto zostało utworzone, dokument można dodać później
- Nie blokuj procesu rejestracji z powodu błędu uploadu

### 10.4. Scenariusze brzegowe

- **Podwójne kliknięcie submit:** Blokowane przez `isSubmitting` (przycisk `disabled`, `aria-busy`)
- **Duży plik:** Walidacja rozmiaru przed submitem; w dropzone wyświetlany komunikat błędu
- **Nieprawidłowy typ pliku:** Dropzone filtruje przez `accept` na `<input>`, ale walidacja klienta dodatkowo sprawdza `file.type`
- **Utrata połączenia podczas uploadu:** Catch w `try/catch`, komunikat o braku połączenia; konto już istnieje → redirect
- **Przeglądarka bez JS:** Strona wymaga JavaScript (React island `client:load`); brak fallbacku — zgodne z architekturą aplikacji

## 11. Kroki implementacji

1. **Utworzenie pliku strony `src/pages/auth/register.astro`**
   - Import `Layout` i `RegisterForm`
   - Dodanie `export const prerender = false`
   - Implementacja guardu sesji (redirect zalogowanego użytkownika na `/dashboard`)
   - Renderowanie `<Layout>` z `<main>` i `<RegisterForm client:load />`

2. **Implementacja funkcji walidacji w `src/components/auth/RegisterForm.tsx`**
   - Zdefiniowanie typów `RegisterFormData`, `RegisterFieldErrors`, `PasswordStrength`
   - Implementacja wszystkich funkcji walidacji jako czystych funkcji:
     - `validateEmail`, `validatePassword`, `validateConfirmPassword`
     - `validateName`, `validateNip` (z sumą kontrolną), `validateCity`, `validateAddress`
     - `validatePhone`, `validateWebsite`, `validateFile`
     - `validateAll`, `hasErrors`
   - Implementacja `computePasswordStrength`
   - Implementacja `mapApiError`

3. **Implementacja komponentu `PasswordStrengthIndicator`**
   - Pasek postępu z dynamicznym kolorem i szerokością opartym na `score`
   - Lista wymagań z ikonami ✓/✗
   - Komponent ukryty gdy `password` jest puste

4. **Implementacja komponentu `FileUploadDropzone`**
   - Ukryty `<input type="file" accept=".pdf,.jpg,.jpeg,.png">`
   - Obsługa drag & drop (`onDragOver`, `onDragLeave`, `onDrop`)
   - Wizualne podświetlenie dropzone przy dragover
   - Wyświetlenie nazwy pliku i rozmiaru po wyborze
   - Przycisk usunięcia pliku
   - Komunikat o akceptowanych formatach i limicie
   - Atrybuty `aria-label`, `aria-describedby`

5. **Implementacja komponentu `RegisterForm`**
   - Zdefiniowanie stanu: `formData`, `fieldErrors`, `apiError`, `isSubmitting`, `hasSubmitted`, `showPassword`, `showConfirmPassword`
   - Generowanie unikalnych ID dla pól (`useId`)
   - Implementacja handlerów: `handleFieldChange`, `handleFieldBlur`, `handleFileSelect`, `handleTogglePassword`, `handleToggleConfirmPassword`
   - Konstruowanie trzech sekcji `<fieldset>` z `<legend>`
   - Implementacja `handleSubmit`:
     a. Walidacja klienta
     b. Wywołanie `POST /api/auth/signup`
     c. Jeśli sukces i plik istnieje → `POST /api/profiles/me/verification-document`
     d. Redirect na `/auth/pending`
   - Obsługa błędów API z mapowaniem komunikatów
   - Renderowanie pól z odpowiednimi atrybutami dostępności

6. **Stylowanie komponentów**
   - Wykorzystanie Tailwind CSS i komponentów Shadcn/ui
   - Responsywność: formularz max-width na desktopie, pełna szerokość na mobile
   - Spójna kolorystyka z resztą aplikacji (card, input, button z Shadcn)
   - Pasek siły hasła: czerwony (score 0-1), żółty (2-3), zielony (4-5)

7. **Testowanie a11y i UX**
   - Sprawdzenie nawigacji klawiaturą (Tab/Shift+Tab przez wszystkie pola)
   - Walidacja komunikatów `aria-describedby`, `aria-invalid`, `aria-label`
   - Testowanie drag & drop i file picker na różnych przeglądarkach
   - Testowanie flow: rejestracja → upload → redirect na `/auth/pending`
   - Testowanie scenariuszy błędów: duplikat email/NIP, nieprawidłowy plik, brak sieci
