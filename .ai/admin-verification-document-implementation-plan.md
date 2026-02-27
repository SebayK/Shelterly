# API Endpoint Implementation Plan: GET /api/admin/shelters/:id/verification-document

## 1. Przegląd punktu końcowego

Endpoint umożliwia super adminowi pobranie dokumentu weryfikacyjnego przesłanego przez schronisko. Dokument jest przechowywany w Supabase Storage (bucket `verification-documents`), a ścieżka do pliku zapisana jest w kolumnie `verification_doc_path` tabeli `profiles`. Endpoint zwraca plik binarny z odpowiednim nagłówkiem `Content-Type` — nie zwraca JSON-a.

## 2. Szczegóły żądania

- **Metoda HTTP:** GET
- **Struktura URL:** `/api/admin/shelters/:id/verification-document`
- **Parametry:**
  - Wymagane: `id` (UUID) — identyfikator schroniska (path param)
  - Opcjonalne: brak
- **Request Body:** brak
- **Nagłówki:** `Authorization: Bearer {access_token}`

## 3. Wykorzystywane typy

### Istniejące typy (bez zmian)

- `ShelterIdParamSchema` z `src/lib/validation/admin.schemas.ts` — walidacja UUID path param
- `SupabaseClient` z `src/db/supabase.client.ts`
- `NotFoundError`, `ForbiddenError`, `InternalError` z `src/lib/errors.ts`
- `APP_CONFIG.STORAGE_BUCKET` z `src/lib/config.ts`

### Nowe typy

Nie są wymagane żadne nowe DTO ani Command Modele. Odpowiedź to plik binarny (`Blob`/`ArrayBuffer`), nie struktura JSON.

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)

- Ciało odpowiedzi: surowe dane pliku (binary)
- Nagłówki:
  - `Content-Type` — wyznaczony na podstawie rozszerzenia pliku (np. `application/pdf`, `image/jpeg`, `image/png`). Domyślnie `application/octet-stream`
  - `Content-Disposition: attachment; filename="<nazwa_pliku>"` — wymusza pobranie pliku przez przeglądarkę
  - `Cache-Control: no-store` — dokument wrażliwy, nie cachować

### Błędy

| Status | Kod błędu          | Warunek                                                                                     |
| ------ | ------------------ | ------------------------------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR` | Parametr `id` nie jest poprawnym UUID                                                       |
| 401    | `UNAUTHORIZED`     | Brak lub niepoprawny token autentykacji                                                     |
| 403    | `FORBIDDEN`        | Zalogowany użytkownik nie ma roli `super_admin`                                             |
| 404    | `NOT_FOUND`        | Schronisko nie istnieje, `verification_doc_path` jest null, lub plik nie istnieje w Storage |
| 500    | `INTERNAL_ERROR`   | Błąd Supabase DB lub Storage                                                                |

## 5. Przepływ danych

```
Klient → [GET /api/admin/shelters/:id/verification-document]
  │
  ├─ 1. Walidacja path param `:id` (ShelterIdParamSchema)
  │     └─ Błąd → 400 VALIDATION_ERROR
  │
  ├─ 2. Autentykacja: supabase.auth.getUser()
  │     └─ Błąd / brak user → 401 UNAUTHORIZED
  │
  ├─ 3. Autoryzacja: pobranie profilu zalogowanego użytkownika z `profiles`
  │     └─ role !== "super_admin" → 403 FORBIDDEN
  │
  ├─ 4. Pobranie profilu schroniska (shelter_id = :id)
  │     ├─ Schronisko nie istnieje → 404 NOT_FOUND
  │     └─ verification_doc_path jest null → 404 NOT_FOUND
  │
  ├─ 5. Pobranie pliku z Supabase Storage
  │     │   supabase.storage.from("verification-documents").download(path)
  │     └─ Plik nie istnieje / błąd Storage → 404 lub 500
  │
  └─ 6. Zwrócenie pliku z odpowiednimi nagłówkami
        → 200 OK (binary data + Content-Type + Content-Disposition)
```

## 6. Względy bezpieczeństwa

1. **Autentykacja** — obowiązkowa; token Bearer walidowany przez `supabase.auth.getUser()`.

2. **Autoryzacja** — wyłącznie super_admin. Sprawdzenie roli w tabeli `profiles` dla zalogowanego użytkownika.

3. **Path Traversal** — wartość `verification_doc_path` pochodzi z bazy danych (nie od użytkownika), ale dla bezpieczeństwa:
   - Walidować, że ścieżka nie zawiera sekwencji `..` ani nie zaczyna się od `/`
   - Zwalidować, że ścieżka wygląda na prawidłową ścieżkę do pliku (np. regex `^[a-zA-Z0-9_\-/\.]+$`)

4. **Nagłówki bezpieczeństwa:**
   - `Cache-Control: no-store` — dokument wrażliwy
   - `Content-Disposition: attachment` — wymuszenie pobrania zamiast renderowania w przeglądarce
   - `X-Content-Type-Options: nosniff` — zapobieganie MIME sniffing

5. **Brak ujawniania wewnętrznych ścieżek** — komunikaty błędów nie powinny zawierać `verification_doc_path` ani szczegółów wewnętrznych Storage.

## 7. Obsługa błędów

| Scenariusz                            | Wyjątek / warunek                      | Kod HTTP | ErrorCode          | Komunikat                                  |
| ------------------------------------- | -------------------------------------- | -------- | ------------------ | ------------------------------------------ |
| Niepoprawny UUID w `:id`              | Zod validation failure                 | 400      | `VALIDATION_ERROR` | Szczegóły walidacji z Zod                  |
| Brak tokenu / niepoprawny token       | `getUser()` error                      | 401      | `UNAUTHORIZED`     | "Authentication required"                  |
| Brak profilu zalogowanego użytkownika | profile query returns null             | 403      | `FORBIDDEN`        | "Insufficient permissions"                 |
| Rola != super_admin                   | profile.role check                     | 403      | `FORBIDDEN`        | "Insufficient permissions"                 |
| Schronisko nie istnieje               | profile query for shelter returns null | 404      | `NOT_FOUND`        | "Shelter not found"                        |
| `verification_doc_path` jest null     | field check                            | 404      | `NOT_FOUND`        | "Verification document not found"          |
| Plik nie istnieje w Storage           | storage.download() error               | 404      | `NOT_FOUND`        | "Verification document file not found"     |
| Błąd DB przy pobieraniu profilu       | Supabase query error                   | 500      | `INTERNAL_ERROR`   | "Failed to retrieve shelter data"          |
| Błąd Storage przy pobieraniu pliku    | storage.download() error (nie 404)     | 500      | `INTERNAL_ERROR`   | "Failed to download verification document" |

Logowanie błędów za pomocą `logErrorWithContext()` z kontekstem:

- `endpoint`: `"GET /api/admin/shelters/:id/verification-document"`
- `user_id`: ID zalogowanego admina
- `shelter_id`: ID schroniska z parametru URL

## 8. Rozważania dotyczące wydajności

1. **Minimalne zapytania do DB** — endpoint wykonuje tylko 2 zapytania:
   - Pobranie profilu zalogowanego użytkownika (auth + rola)
   - Pobranie profilu schroniska (ścieżka do dokumentu)

   Można je zoptymalizować do jednego zapytania łączącego oba profile, ale dla czytelności kodu i spójności z istniejącymi endpointami lepiej zachować dwa osobne zapytania.

2. **Streaming** — Supabase Storage `download()` zwraca `Blob`. Dla dużych plików warto bezpośrednio przekazać dane do odpowiedzi bez dodatkowego buforowania. Ponieważ dokumenty weryfikacyjne to zazwyczaj pliki PDF/obrazy o rozsądnych rozmiarach, nie wymaga to specjalnej optymalizacji.

3. **Brak cache** — ze względów bezpieczeństwa dokumenty wrażliwe nie powinny być cache'owane (`Cache-Control: no-store`).

## 9. Etapy wdrożenia

### Krok 1: Rozszerzenie `AdminService` o metodę pobierania dokumentu

**Plik:** `src/lib/services/admin.service.ts`

Dodać metodę `getVerificationDocument(shelterId: string)` która:

1. Pobiera profil schroniska z tabeli `profiles` — SELECT `id`, `verification_doc_path` WHERE `id = shelterId`
2. Jeśli profil nie istnieje → rzuca `NotFoundError("Shelter not found")`
3. Jeśli `verification_doc_path` jest `null` → rzuca `NotFoundError("Verification document not found")`
4. Waliduje ścieżkę pod kątem bezpieczeństwa (brak `..`, poprawny format)
5. Pobiera plik z Supabase Storage: `supabase.storage.from(APP_CONFIG.STORAGE_BUCKET).download(verification_doc_path)`
6. Jeśli Storage zwróci błąd → rzuca `NotFoundError` (plik nie istnieje) lub `InternalError` (inny błąd)
7. Zwraca obiekt `{ data: Blob, fileName: string }` — gdzie `fileName` to ostatni segment ścieżki

```typescript
interface VerificationDocumentResult {
  data: Blob;
  fileName: string;
  contentType: string;
}
```

**Wyznaczanie Content-Type na podstawie rozszerzenia pliku:**

- `.pdf` → `application/pdf`
- `.jpg`, `.jpeg` → `image/jpeg`
- `.png` → `image/png`
- `.webp` → `image/webp`
- pozostałe → `application/octet-stream`

Wydzielić helper `getContentTypeFromFileName(fileName: string): string` w AdminService lub jako prywatną funkcję w pliku.

### Krok 2: Utworzenie pliku endpointu

**Plik:** `src/pages/api/admin/shelters/[id]/verification-document.ts`

Struktura:

```typescript
export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  // 1. Walidacja path param
  // 2. Autentykacja
  // 3. Autoryzacja (super_admin)
  // 4. Wywołanie AdminService.getVerificationDocument()
  // 5. Zwrócenie pliku binarnego z nagłówkami
};
```

Wzorzec implementacji powinien być spójny z `status.ts`:

- Inline autentykacja i autoryzacja (getUser + profil role check)
- Walidacja `:id` przez `ShelterIdParamSchema`
- Blok try/catch z mapowaniem wyjątków na kody HTTP
- Logowanie za pomocą `logErrorWithContext()`

**Szczegóły zwracania odpowiedzi z plikiem:**

```typescript
return new Response(result.data, {
  status: 200,
  headers: {
    "Content-Type": result.contentType,
    "Content-Disposition": `attachment; filename="${result.fileName}"`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  },
});
```

### Krok 3: Testy jednostkowe serwisu

**Plik:** `src/lib/services/admin.service.test.ts` (rozszerzenie istniejącego pliku)

Scenariusze testowe:

1. **Happy path** — profil istnieje, `verification_doc_path` ustawiony, Storage zwraca plik → zwraca `VerificationDocumentResult`
2. **Schronisko nie istnieje** → rzuca `NotFoundError`
3. **`verification_doc_path` jest null** → rzuca `NotFoundError`
4. **Błąd DB przy pobieraniu profilu** → rzuca `InternalError`
5. **Plik nie istnieje w Storage** → rzuca `NotFoundError`
6. **Inny błąd Storage** → rzuca `InternalError`
7. **Poprawne wyznaczanie Content-Type** — testy dla `.pdf`, `.jpg`, `.png`, `.webp`, nieznane rozszerzenie

Mockowanie:

- `supabase.from("profiles").select().eq().maybeSingle()` — mock łańcucha zapytań DB
- `supabase.storage.from().download()` — mock Storage API

### Krok 4: Testy jednostkowe endpointu

**Plik:** `src/pages/api/admin/shelters/[id]/verification-document.test.ts`

Scenariusze testowe (wzorowane na `status.test.ts`):

| #   | Scenariusz                                        | Oczekiwany status |
| --- | ------------------------------------------------- | ----------------- |
| 1   | Niepoprawny UUID w `:id`                          | 400               |
| 2   | Brak autentykacji (getUser zwraca error)          | 401               |
| 3   | Rola != super_admin                               | 403               |
| 4   | Profil zalogowanego użytkownika to null           | 403               |
| 5   | Schronisko nie istnieje (NotFoundError z service) | 404               |
| 6   | Brak dokumentu (NotFoundError z service)          | 404               |
| 7   | Błąd wewnętrzny (InternalError z service)         | 500               |
| 8   | Nieoczekiwany błąd (Error z service)              | 500               |
| 9   | Happy path — zwraca plik z poprawnymi nagłówkami  | 200               |
| 10  | Happy path — Content-Type odpowiada typowi pliku  | 200               |
| 11  | Happy path — Content-Disposition z nazwą pliku    | 200               |
| 12  | Happy path — Cache-Control: no-store              | 200               |

Wzorzec testowy: `vi.doMock` na `AdminService` z dynamicznym importem, zgodny z `status.test.ts`.

### Krok 5: Weryfikacja i integracja

1. Upewnić się, że bucket `verification-documents` jest skonfigurowany w Supabase (zgodnie z `APP_CONFIG.STORAGE_BUCKET`)
2. Zweryfikować, że linter i TypeScript nie zgłaszają błędów
3. Uruchomić pełny zestaw testów (`vitest`)
4. Sprawdzić spójność z pozostałymi endpointami admina
