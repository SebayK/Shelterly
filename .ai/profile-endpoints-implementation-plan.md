# API Endpoints Implementation Plan: Profile Endpoints

## 1. Przegląd punktów końcowych

Ten plan obejmuje implementację 6 endpointów REST API związanych z zarządzaniem profilami schronisk w aplikacji Shelterly:

1. **GET /api/profiles** - Publiczna lista zweryfikowanych schronisk dla widoku mapy
2. **GET /api/profiles/:id** - Publiczny szczegółowy widok konkretnego schroniska
3. **GET /api/profiles/me** - Pełny profil zalogowanego użytkownika (ze wszystkimi danymi)
4. **PATCH /api/profiles/me** - Aktualizacja profilu zalogowanego użytkownika
5. **POST /api/profiles/me/verification-document** - Upload dokumentu weryfikacyjnego
6. **POST /api/profiles/me/geocode** - Geokodowanie adresu na współrzędne

Endpointy służą do:

- Wyświetlania zweryfikowanych schronisk na mapie z filtrowaniem i obliczaniem odległości
- Prezentacji szczegółowych informacji o schronisku dla potencjalnych darczyńców
- Zarządzania własnym profilem przez schronisko (edycja, weryfikacja, geolokalizacja)

---

## 2. Szczegóły żądań

### 2.1. GET /api/profiles

**Metoda HTTP:** GET  
**Struktura URL:** `/api/profiles`  
**Typ dostępu:** Publiczny (bez uwierzytelniania)

**Parametry zapytania (Query Parameters):**

- **Opcjonalne:**
  - `lat` (number): Szerokość geograficzna użytkownika do obliczenia odległości (-90 do 90)
  - `lon` (number): Długość geograficzna użytkownika do obliczenia odległości (-180 do 180)
  - `urgent_only` (boolean): Filtruj tylko schroniska z pilnymi potrzebami
  - `limit` (number): Liczba wyników na stronę (domyślnie 50, max 100)
  - `offset` (number): Offset dla paginacji (domyślnie 0)

**Request Body:** Brak

---

### 2.2. GET /api/profiles/:id

**Metoda HTTP:** GET  
**Struktura URL:** `/api/profiles/:id`  
**Typ dostępu:** Publiczny (bez uwierzytelniania)

**Parametry:**

- **Wymagane (path):**
  - `id` (UUID): Identyfikator schroniska

**Request Body:** Brak

---

### 2.3. GET /api/profiles/me

**Metoda HTTP:** GET  
**Struktura URL:** `/api/profiles/me`  
**Typ dostępu:** Wymaga uwierzytelnienia

**Headers:**

```
Authorization: Bearer {access_token}
```

**Parametry:** Brak  
**Request Body:** Brak

---

### 2.4. PATCH /api/profiles/me

**Metoda HTTP:** PATCH  
**Struktura URL:** `/api/profiles/me`  
**Typ dostępu:** Wymaga uwierzytelnienia

**Headers:**

```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request Body:**

```typescript
{
  name?: string;          // Nazwa schroniska (1-255 znaków)
  city?: string;          // Miasto (1-100 znaków)
  address?: string;       // Adres (1-500 znaków)
  phone_number?: string;  // Numer telefonu (format: +48123456789)
  website_url?: string;   // URL strony WWW (prawidłowy URL)
}
```

**Uwaga:** Wszystkie pola są opcjonalne. Pola `status`, `role`, `nip`, `location`, `verification_doc_path`, `ai_usage_count` NIE MOGĄ być modyfikowane przez ten endpoint.

---

### 2.5. POST /api/profiles/me/verification-document

**Metoda HTTP:** POST  
**Struktura URL:** `/api/profiles/me/verification-document`  
**Typ dostępu:** Wymaga uwierzytelnienia

**Headers:**

```
Authorization: Bearer {access_token}
Content-Type: multipart/form-data
```

**Request Body (Form Data):**

- **Wymagane:**
  - `file`: Plik dokumentu weryfikacyjnego
    - Dozwolone formaty: PDF, JPG, JPEG, PNG
    - Maksymalny rozmiar: 5MB

---

### 2.6. POST /api/profiles/me/geocode

**Metoda HTTP:** POST  
**Struktura URL:** `/api/profiles/me/geocode`  
**Typ dostępu:** Wymaga uwierzytelnienia

**Headers:**

```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request Body:**

```typescript
{
  address: string;  // Adres do geokodowania (1-500 znaków)
}
```

---

## 3. Wykorzystywane typy

### 3.1. DTOs (Data Transfer Objects)

Z pliku `src/types.ts`:

```typescript
// Odpowiedź dla GET /api/profiles
interface ProfileListResponseDTO {
  data: ProfileListItemDTO[];
  pagination: Pagination;
}

interface ProfileListItemDTO {
  id: string;
  name: string;
  city: string;
  location: Location;
  distance_km?: number;
  has_urgent_needs: boolean;
  needs_count: number;
  urgent_needs_count: number;
}

// Odpowiedź dla GET /api/profiles/:id
interface ProfileDetailDTO {
  id: string;
  name: string;
  city: string;
  address: string;
  location: Location;
  phone_number: string | null;
  website_url: string | null;
  created_at: string;
  needs_summary: NeedsSummary;
}

// Odpowiedź dla GET /api/profiles/me
interface ProfileMeDTO {
  id: string;
  role: UserRole;
  status: ShelterStatus;
  name: string;
  nip: string | null;
  city: string;
  address: string;
  location: Location | null;
  phone_number: string | null;
  website_url: string | null;
  verification_doc_path: string | null;
  ai_usage_count: number;
  created_at: string;
  updated_at: string | null;
}

// Odpowiedź dla PATCH /api/profiles/me
interface ProfileUpdateResponseDTO {
  id: string;
  name: string;
  city: string;
  updated_at: string;
}

// Odpowiedź dla POST /api/profiles/me/verification-document
interface VerificationDocumentUploadResponseDTO {
  verification_doc_path: string;
  uploaded_at: string;
}

// Odpowiedź dla POST /api/profiles/me/geocode
interface GeocodeResponseDTO {
  location: Location;
  formatted_address: string;
}
```

### 3.2. Command Models (Request Bodies)

```typescript
// Request body dla PATCH /api/profiles/me
interface UpdateProfileCommand {
  name?: string;
  city?: string;
  address?: string;
  phone_number?: string;
  website_url?: string;
}

// Request body dla POST /api/profiles/me/geocode
interface GeocodeCommand {
  address: string;
}

// Query params dla GET /api/profiles
interface ProfilesQueryParams {
  lat?: number;
  lon?: number;
  urgent_only?: boolean;
  limit?: number;
  offset?: number;
}
```

### 3.3. Helper Types

```typescript
interface Location {
  lat: number;
  lon: number;
}

interface Pagination {
  total: number;
  limit: number;
  offset: number;
}

interface NeedsSummary {
  total: number;
  urgent: number;
  fulfilled: number;
}

interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
  };
}
```

### 3.4. Schematy walidacji Zod

Należy utworzyć plik `src/lib/validation/profile.schemas.ts`:

```typescript
import { z } from 'zod';

export const ProfilesQueryParamsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
  urgent_only: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const ProfileIdParamsSchema = z.object({
  id: z.string().uuid('Invalid profile ID format'),
});

export const UpdateProfileCommandSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  city: z.string().min(1).max(100).optional(),
  address: z.string().min(1).max(500).optional(),
  phone_number: z.string().regex(/^\+?[0-9\s\-()]+$/, 'Invalid phone number format').optional(),
  website_url: z.string().url('Invalid URL format').optional(),
});

export const GeocodeCommandSchema = z.object({
  address: z.string().min(1).max(500),
});

export const FileUploadSchema = z.object({
  type: z.enum(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']),
  size: z.number().max(5 * 1024 * 1024, 'File size must not exceed 5MB'),
});
```

---

## 4. Szczegóły odpowiedzi

### 4.1. GET /api/profiles

**Sukces (200 OK):**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Schronisko Warszawa",
      "city": "Warszawa",
      "location": {
        "lat": 52.2297,
        "lon": 21.0122
      },
      "distance_km": 5.2,
      "has_urgent_needs": true,
      "needs_count": 12,
      "urgent_needs_count": 3
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0
  }
}
```

**Błędy:**

- **400 Bad Request**: Nieprawidłowe parametry zapytania (np. lat poza zakresem)
- **500 Internal Server Error**: Błąd bazy danych

---

### 4.2. GET /api/profiles/:id

**Sukces (200 OK):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Schronisko dla Zwierząt w Warszawie",
  "city": "Warszawa",
  "address": "ul. Przykładowa 123",
  "location": {
    "lat": 52.2297,
    "lon": 21.0122
  },
  "phone_number": "+48123456789",
  "website_url": "https://example.com",
  "created_at": "2026-01-15T10:00:00Z",
  "needs_summary": {
    "total": 12,
    "urgent": 3,
    "fulfilled": 2
  }
}
```

**Błędy:**

- **400 Bad Request**: Nieprawidłowy format UUID
- **404 Not Found**: Schronisko nie istnieje lub nie jest zweryfikowane
- **500 Internal Server Error**: Błąd bazy danych

---

### 4.3. GET /api/profiles/me

**Sukces (200 OK):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "role": "shelter",
  "status": "verified",
  "name": "Schronisko dla Zwierząt w Warszawie",
  "nip": "1234567890",
  "city": "Warszawa",
  "address": "ul. Przykładowa 123",
  "location": {
    "lat": 52.2297,
    "lon": 21.0122
  },
  "phone_number": "+48123456789",
  "website_url": "https://example.com",
  "verification_doc_path": "verification-docs/uuid/document.pdf",
  "ai_usage_count": 45,
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-20T14:30:00Z"
}
```

**Błędy:**

- **401 Unauthorized**: Brak tokenu uwierzytelniającego lub token nieprawidłowy
- **404 Not Found**: Profil użytkownika nie istnieje
- **500 Internal Server Error**: Błąd bazy danych

---

### 4.4. PATCH /api/profiles/me

**Sukces (200 OK):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Updated Shelter Name",
  "city": "Warszawa",
  "updated_at": "2026-01-21T09:15:00Z"
}
```

**Błędy:**

- **401 Unauthorized**: Brak tokenu lub token nieprawidłowy
- **400 Bad Request**: Nieprawidłowe dane wejściowe (np. za długa nazwa, nieprawidłowy URL)
- **403 Forbidden**: Próba modyfikacji chronionych pól (status, role, nip)
- **500 Internal Server Error**: Błąd bazy danych

---

### 4.5. POST /api/profiles/me/verification-document

**Sukces (200 OK):**

```json
{
  "verification_doc_path": "verification-docs/550e8400-e29b-41d4-a716-446655440000/1737456000-document.pdf",
  "uploaded_at": "2026-01-21T10:00:00Z"
}
```

**Błędy:**

- **401 Unauthorized**: Brak tokenu lub token nieprawidłowy
- **400 Bad Request**:
  - Brak pliku
  - Nieprawidłowy format pliku (dozwolone: PDF, JPG, PNG)
  - Plik zbyt duży (max 5MB)
- **500 Internal Server Error**: Błąd uploadu do Supabase Storage lub błąd bazy danych

---

### 4.6. POST /api/profiles/me/geocode

**Sukces (200 OK):**

```json
{
  "location": {
    "lat": 52.2297,
    "lon": 21.0122
  },
  "formatted_address": "ul. Przykładowa 123, 00-000 Warszawa, Poland"
}
```

**Błędy:**

- **401 Unauthorized**: Brak tokenu lub token nieprawidłowy
- **400 Bad Request**:
  - Pusty adres
  - Adres nie został znaleziony przez serwis geokodowania
- **500 Internal Server Error**: Błąd serwisu geokodowania

---

## 5. Przepływ danych

### 5.1. GET /api/profiles

```
Client Request (Query params: lat, lon, urgent_only, limit, offset)
    ↓
[Validation Layer] → Validate query params with Zod
    ↓
[Service Layer] → ProfileService.getVerifiedProfiles()
    ↓
[Database] → Query profiles table:
    - Filter: status = 'verified'
    - Calculate distance if lat/lon provided (PostGIS ST_Distance)
    - Sort by distance or created_at
    ↓
[Database] → For each profile, query needs table:
    - Count total needs (deleted_at IS NULL)
    - Count urgent needs (urgency IN ('urgent', 'critical'))
    - Check if any urgent needs exist
    ↓
[Transformation] → Transform ProfileEntity[] to ProfileListItemDTO[]
    ↓
[Response] → Return ProfileListResponseDTO with pagination
```

**PostGIS Query dla odległości:**

```sql
SELECT 
  *,
  ST_Distance(
    location,
    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
  ) / 1000 AS distance_km
FROM profiles
WHERE status = 'verified'
  AND ST_DWithin(
    location,
    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
    50000  -- 50km radius
  )
ORDER BY distance_km ASC
LIMIT :limit OFFSET :offset;
```

---

### 5.2. GET /api/profiles/:id

```
Client Request (Path param: id)
    ↓
[Validation Layer] → Validate UUID format
    ↓
[Service Layer] → ProfileService.getProfileById(id)
    ↓
[Database] → Query profiles table:
    - WHERE id = :id AND status = 'verified'
    ↓
[Guard Clause] → If not found, return 404
    ↓
[Database] → Query needs table for summary:
    - Count total needs
    - Count urgent needs (urgency IN ('urgent', 'critical'))
    - Count fulfilled needs (is_fulfilled = true)
    ↓
[Transformation] → Transform to ProfileDetailDTO
    ↓
[Response] → Return ProfileDetailDTO (200 OK)
```

---

### 5.3. GET /api/profiles/me

```
Client Request (Header: Authorization Bearer token)
    ↓
[Auth Middleware] → Extract and verify access_token
    ↓
[Auth Layer] → Get user from Supabase Auth (auth.getUser())
    ↓
[Guard Clause] → If no user, return 401
    ↓
[Service Layer] → ProfileService.getAuthenticatedProfile(userId)
    ↓
[Database] → Query profiles table:
    - WHERE id = :userId
    ↓
[Guard Clause] → If not found, return 404
    ↓
[Transformation] → Transform to ProfileMeDTO (includes all fields)
    ↓
[Response] → Return ProfileMeDTO (200 OK)
```

---

### 5.4. PATCH /api/profiles/me

```
Client Request (Header: Authorization, Body: UpdateProfileCommand)
    ↓
[Auth Middleware] → Verify access_token and get userId
    ↓
[Validation Layer] → Validate request body with Zod
    ↓
[Guard Clause] → Check if protected fields (status, role, nip) in request
    - If yes, return 403 Forbidden
    ↓
[Service Layer] → ProfileService.updateProfile(userId, data)
    ↓
[Database] → UPDATE profiles table:
    - SET fields from request body
    - SET updated_at = now()
    - WHERE id = :userId
    ↓
[Guard Clause] → If no rows affected, return 404
    ↓
[Transformation] → Transform to ProfileUpdateResponseDTO
    ↓
[Response] → Return ProfileUpdateResponseDTO (200 OK)
```

---

### 5.5. POST /api/profiles/me/verification-document

```
Client Request (Header: Authorization, Form Data: file)
    ↓
[Auth Middleware] → Verify access_token and get userId
    ↓
[Validation Layer] → Validate file:
    - Check file exists
    - Check file type (PDF, JPG, PNG)
    - Check file size (max 5MB)
    ↓
[Service Layer] → ProfileService.uploadVerificationDocument(userId, file)
    ↓
[File Processing] → Generate unique file path:
    - verification-docs/{userId}/{timestamp}-{filename}
    ↓
[Supabase Storage] → Upload file to bucket 'verification-documents':
    - supabase.storage.from('verification-documents').upload(path, file)
    ↓
[Guard Clause] → If upload fails, return 500
    ↓
[Database] → UPDATE profiles table:
    - SET verification_doc_path = :path
    - WHERE id = :userId
    ↓
[Transformation] → Create VerificationDocumentUploadResponseDTO
    ↓
[Response] → Return VerificationDocumentUploadResponseDTO (200 OK)
```

**Storage Bucket Configuration:**

- Bucket name: `verification-documents`
- Public: false (tylko właściciel i admin mogą pobierać)
- Max file size: 5MB
- Allowed MIME types: `application/pdf`, `image/jpeg`, `image/png`

---

### 5.6. POST /api/profiles/me/geocode

```
Client Request (Header: Authorization, Body: GeocodeCommand)
    ↓
[Auth Middleware] → Verify access_token and get userId
    ↓
[Validation Layer] → Validate request body (address not empty)
    ↓
[Service Layer] → ProfileService.geocodeAddress(address)
    ↓
[External API] → Call Geocoding Service (np. Nominatim OSM):
    - GET https://nominatim.openstreetmap.org/search
    - Params: q={address}, format=json, limit=1
    ↓
[Guard Clause] → If no results, return 400 "Address not found"
    ↓
[Parse Response] → Extract lat, lon, formatted_address
    ↓
[Optional] → Update profile location:
    - UPDATE profiles SET location = ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)
    - WHERE id = :userId
    ↓
[Transformation] → Create GeocodeResponseDTO
    ↓
[Response] → Return GeocodeResponseDTO (200 OK)
```

**Opcje serwisu geokodowania:**

1. **Nominatim (OpenStreetMap)** - Darmowy, open source, wymaga rate limiting
2. **Google Maps Geocoding API** - Płatny, wysoka jakość, wymaga API key
3. **Mapbox Geocoding** - Płatny, darmowy tier

---

## 6. Względy bezpieczeństwa

### 6.1. Uwierzytelnianie i autoryzacja

**Endpointy publiczne (bez uwierzytelniania):**

- GET /api/profiles
- GET /api/profiles/:id

**Endpointy chronione (wymagają uwierzytelniania):**

- GET /api/profiles/me
- PATCH /api/profiles/me
- POST /api/profiles/me/verification-document
- POST /api/profiles/me/geocode

**Weryfikacja tokenu:**

```typescript
// W każdym chronionym endpoincie:
const { data: { user }, error } = await context.locals.supabase.auth.getUser();

if (error || !user) {
  return new Response(JSON.stringify({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication required'
    }
  }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### 6.2. Kontrola dostępu do danych

**Zasada:** Użytkownik może modyfikować tylko swój własny profil.

```typescript
// Weryfikacja właściciela:
const profile = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .single();

if (!profile.data) {
  return new Response(JSON.stringify({
    error: {
      code: 'NOT_FOUND',
      message: 'Profile not found'
    }
  }), { status: 404 });
}
```

**Row Level Security (RLS):**

- Supabase RLS policies zapewniają dodatkową warstwę bezpieczeństwa
- Profile publiczne: SELECT dozwolony dla wszystkich (tylko zweryfikowane)
- Profile prywatne: UPDATE dozwolony tylko dla właściciela (auth.uid() = id)

### 6.3. Walidacja danych wejściowych

**Wszystkie dane wejściowe muszą być zwalidowane:**

1. **Query parameters:** Użyj Zod do konwersji typów i walidacji zakresów
2. **Path parameters:** Waliduj format UUID
3. **Request body:** Waliduj strukturę, typy, długości stringów, formaty (URL, telefon)
4. **Pliki:** Waliduj MIME type, rozmiar, rozszerzenie

**Przykład walidacji:**

```typescript
const validation = ProfilesQueryParamsSchema.safeParse(queryParams);

if (!validation.success) {
  return new Response(JSON.stringify({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid query parameters',
      details: validation.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
    }
  }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### 6.4. Ochrona przed atakami

**SQL Injection:**

- Supabase używa parameteryzowanych zapytań - zabezpieczone domyślnie
- NIE KONKATENUJ stringów w zapytaniach SQL

**XSS (Cross-Site Scripting):**

- Zwracaj dane w formacie JSON z odpowiednim Content-Type
- Framework (React) automatycznie escapuje dane w UI

**CSRF (Cross-Site Request Forgery):**

- Supabase tokeny są weryfikowane po stronie serwera
- Endpointy API nie używają cookies dla auth (tylko Bearer token)

**File Upload Security:**

- Ograniczenie rozmiaru pliku (5MB)
- Walidacja MIME type po stronie serwera
- Generowanie unikalnych nazw plików (timestamp + UUID)
- Przechowywanie plików w dedykowanym buckecie z ograniczonym dostępem

### 6.5. Ochrona danych wrażliwych

**Dane NIE MOGĄ być zwracane w publicznych endpointach:**

- `nip` (Numer Identyfikacji Podatkowej)
- `verification_doc_path` (ścieżka do dokumentu weryfikacyjnego)
- `ai_usage_count` (dane wewnętrzne)

**Tylko właściciel widzi te dane:**

- GET /api/profiles/me zwraca pełny profil z danymi wrażliwymi
- GET /api/profiles/:id zwraca tylko dane publiczne

### 6.6. Rate Limiting

**Zalecenia:**

- Geocoding endpoint: Max 10 requestów/minutę/użytkownika (koszty zewnętrznego API)
- File upload: Max 5 uploadów/godzinę/użytkownika
- Implementacja: Middleware Astro lub Supabase Edge Functions

---

## 7. Obsługa błędów

### 7.1. Standardowy format odpowiedzi błędu

```typescript
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
```

### 7.2. Kody błędów i scenariusze

#### **400 Bad Request**

**Scenariusze:**

1. Nieprawidłowe parametry zapytania (lat/lon poza zakresem, limit > 100)
2. Nieprawidłowy format UUID
3. Nieprawidłowe dane w request body (za długie stringi, nieprawidłowy URL/telefon)
4. Nieprawidłowy typ pliku (nie PDF/JPG/PNG)
5. Plik zbyt duży (> 5MB)
6. Adres nie został znaleziony przez geocoding

**Przykład odpowiedzi:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "lat",
        "message": "Latitude must be between -90 and 90"
      },
      {
        "field": "website_url",
        "message": "Invalid URL format"
      }
    ]
  }
}
```

#### **401 Unauthorized**

**Scenariusze:**

1. Brak tokenu Authorization w headerze
2. Token nieprawidłowy lub wygasły
3. Token należy do usuniętego użytkownika

**Przykład odpowiedzi:**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

#### **403 Forbidden**

**Scenariusze:**

1. Próba modyfikacji chronionych pól (status, role, nip) przez PATCH /api/profiles/me

**Przykład odpowiedzi:**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Cannot modify protected fields: status, role"
  }
}
```

#### **404 Not Found**

**Scenariusze:**

1. Profil o danym ID nie istnieje
2. Profil istnieje, ale nie jest zweryfikowany (status != 'verified')
3. Użytkownik nie ma profilu w tabeli profiles

**Przykład odpowiedzi:**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Profile not found or not verified"
  }
}
```

#### **500 Internal Server Error**

**Scenariusze:**

1. Błąd połączenia z bazą danych
2. Błąd uploadu do Supabase Storage
3. Błąd zewnętrznego API (geocoding)
4. Nieobsłużony wyjątek w kodzie

**Przykład odpowiedzi:**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred. Please try again later."
  }
}
```

**Logowanie błędów:**

- Błędy 500 muszą być logowane do systemu (console.error + monitoring)
- Nie ujawniaj szczegółów technicznych użytkownikowi
- Loguj stack trace, request ID, user ID dla debugging

### 7.3. Guard Clauses - Wczesne zwracanie błędów

**Przykład implementacji w endpoincie:**

```typescript
export const GET = async ({ request, url, locals }: APIContext) => {
  // Guard 1: Walidacja parametrów
  const validation = ProfilesQueryParamsSchema.safeParse(
    Object.fromEntries(url.searchParams)
  );
  
  if (!validation.success) {
    return new Response(JSON.stringify({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid query parameters',
        details: validation.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      }
    }), { status: 400 });
  }

  // Guard 2: Sprawdzenie kombinacji lat/lon
  const { lat, lon } = validation.data;
  if ((lat && !lon) || (!lat && lon)) {
    return new Response(JSON.stringify({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Both lat and lon are required for distance calculation'
      }
    }), { status: 400 });
  }

  try {
    const result = await ProfileService.getVerifiedProfiles(validation.data);
    
    // Guard 3: Sprawdzenie czy query się powiodło
    if (!result) {
      throw new Error('Failed to fetch profiles');
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching profiles:', error);
    
    return new Response(JSON.stringify({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve profiles'
      }
    }), { status: 500 });
  }
};
```

---

## 8. Rozważania dotyczące wydajności

### 8.1. Optymalizacja zapytań do bazy danych

**Indeksy:**

```sql
-- Już zdefiniowane w db-plan.md:
CREATE INDEX idx_profiles_status ON profiles(status);
CREATE INDEX idx_profiles_location ON profiles USING GIST(location);
CREATE INDEX idx_needs_shelter_id ON needs(shelter_id);
CREATE INDEX idx_needs_is_fulfilled ON needs(is_fulfilled);
CREATE INDEX idx_needs_urgency ON needs(urgency);
```

**N+1 Query Problem:**

- Unikaj pobierania potrzeb dla każdego schroniska osobno
- Użyj JOIN lub GROUP BY dla agregacji (needs_count, urgent_needs_count)

**Zoptymalizowane zapytanie:**

```sql
SELECT 
  p.id,
  p.name,
  p.city,
  p.location,
  COUNT(n.id) AS needs_count,
  COUNT(n.id) FILTER (WHERE n.urgency IN ('urgent', 'critical')) AS urgent_needs_count,
  BOOL_OR(n.urgency IN ('urgent', 'critical')) AS has_urgent_needs
FROM profiles p
LEFT JOIN needs n ON n.shelter_id = p.id AND n.deleted_at IS NULL
WHERE p.status = 'verified'
GROUP BY p.id
LIMIT :limit OFFSET :offset;
```

### 8.2. Paginacja

**Best Practices:**

- Domyślny limit: 50 wyników
- Maksymalny limit: 100 wyników
- Zwracaj `total` dla UI (liczba wszystkich wyników)
- Użyj OFFSET/LIMIT dla prostoty (dla MVP wystarczy)

**Dla skalowalności w przyszłości:**

- Cursor-based pagination (używa `id` lub `created_at` jako cursor)
- Lepsza wydajność dla dużych offsetów

### 8.3. Caching

**Strategie dla MVP:**

1. **GET /api/profiles (lista schronisk):**
   - Cache na 5 minut (dane rzadko się zmieniają)
   - Invalidacja: po dodaniu/aktualizacji schroniska
   - Implementacja: HTTP Cache-Control headers

2. **GET /api/profiles/:id (szczegóły):**
   - Cache na 10 minut
   - Invalidacja: po aktualizacji profilu lub potrzeb

3. **Geocoding results:**
   - Cache wyników geokodowania w tabeli (nowa kolumna lub osobna tabela)
   - Jeśli ten sam adres już był geokodowany, zwróć z cache

**Przykład Cache-Control header:**

```typescript
return new Response(JSON.stringify(data), {
  status: 200,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300, s-maxage=300', // 5 minut
  }
});
```

### 8.4. Optymalizacja Upload plików

**Best Practices:**

- Stream pliku bezpośrednio do Supabase Storage (nie zapisuj na dysku serwera)
- Kompresja obrazów po stronie klienta przed uploadem
- Generuj thumbnails asynchronicznie (jeśli potrzebne w przyszłości)

### 8.5. Monitoring wydajności

**Metryki do śledzenia:**

- Czas odpowiedzi endpointów (< 200ms dla GET, < 500ms dla POST/PATCH)
- Liczba zapytań do bazy na request
- Rozmiar odpowiedzi (pagination zapobiega zbyt dużym payloadom)
- Błędy geocoding API (rate limits, timeouts)

---

## 9. Etapy wdrożenia

### Krok 1: Przygotowanie struktury projektu

**1.1. Utwórz katalogi:**

```bash
mkdir -p src/pages/api/profiles/me
mkdir -p src/lib/services
mkdir -p src/lib/validation
mkdir -p src/lib/utils
```

**1.2. Utwórz pliki serwisów:**

```bash
touch src/lib/services/profile.service.ts
touch src/lib/validation/profile.schemas.ts
touch src/lib/utils/error.ts
touch src/lib/utils/response.ts
```

---

### Krok 2: Implementacja walidacji (Zod schemas)

**Plik: `src/lib/validation/profile.schemas.ts`**

Zaimplementuj wszystkie schematy:

- `ProfilesQueryParamsSchema`
- `ProfileIdParamsSchema`
- `UpdateProfileCommandSchema`
- `GeocodeCommandSchema`
- `FileUploadSchema`

**Testowanie:**

- Przetestuj każdy schemat z prawidłowymi i nieprawidłowymi danymi
- Sprawdź error messages dla walidacji

---

### Krok 3: Implementacja utility funkcji

**Plik: `src/lib/utils/error.ts`**

```typescript
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: ErrorDetail[],
  status: number = 400
): Response {
  return new Response(JSON.stringify({
    error: { code, message, details }
  }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

**Plik: `src/lib/utils/response.ts`**

```typescript
export function createSuccessResponse<T>(
  data: T,
  status: number = 200,
  cacheSeconds?: number
): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  if (cacheSeconds) {
    headers['Cache-Control'] = `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`;
  }
  
  return new Response(JSON.stringify(data), { status, headers });
}
```

---

### Krok 4: Implementacja ProfileService

**Plik: `src/lib/services/profile.service.ts`**

**4.1. Metoda `getVerifiedProfiles(params)`:**

- Buduj zapytanie Supabase z filtrami
- Jeśli `lat` i `lon`, użyj PostGIS dla odległości
- Jeśli `urgent_only`, filtruj schroniska z pilnymi potrzebami
- Agreguj needs_count i urgent_needs_count
- Transform do ProfileListItemDTO[]
- Zwróć ProfileListResponseDTO

**4.2. Metoda `getProfileById(id)`:**

- Query profiles WHERE id = :id AND status = 'verified'
- Jeśli nie znaleziono, rzuć błąd
- Query needs dla summary (total, urgent, fulfilled)
- Transform do ProfileDetailDTO

**4.3. Metoda `getAuthenticatedProfile(userId)`:**

- Query profiles WHERE id = :userId (bez filtra status)
- Transform do ProfileMeDTO (wszystkie pola)

**4.4. Metoda `updateProfile(userId, data)`:**

- Waliduj, że data nie zawiera protected fields
- UPDATE profiles SET ...fields, updated_at = now() WHERE id = :userId
- Return updated profile

**4.5. Metoda `uploadVerificationDocument(userId, file)`:**

- Generuj path: `verification-docs/${userId}/${Date.now()}-${file.name}`
- Upload do Supabase Storage
- UPDATE profiles SET verification_doc_path
- Return path

**4.6. Metoda `geocodeAddress(address)`:**

- Call Nominatim API lub inny geocoding service
- Parse response (lat, lon, formatted_address)
- Opcjonalnie: cache wyników

**Helper methods:**

- `calculateDistance(lat1, lon1, lat2, lon2)` - Haversine formula lub PostGIS
- `getNeedsSummary(shelterId)` - Agregacja z tabeli needs

---

### Krok 5: Implementacja endpointów API

**5.1. Plik: `src/pages/api/profiles/index.ts`**

Endpoint: **GET /api/profiles**

```typescript
import type { APIRoute } from 'astro';
import { ProfilesQueryParamsSchema } from '@/lib/validation/profile.schemas';
import { ProfileService } from '@/lib/services/profile.service';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/response';

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  // Walidacja query params
  const validation = ProfilesQueryParamsSchema.safeParse(
    Object.fromEntries(url.searchParams)
  );
  
  if (!validation.success) {
    return createErrorResponse('VALIDATION_ERROR', 'Invalid query parameters', 
      validation.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      })), 400);
  }

  // Guard: lat i lon muszą być razem
  const { lat, lon } = validation.data;
  if ((lat && !lon) || (!lat && lon)) {
    return createErrorResponse('VALIDATION_ERROR', 
      'Both lat and lon are required for distance calculation', undefined, 400);
  }

  try {
    const result = await ProfileService.getVerifiedProfiles(
      locals.supabase,
      validation.data
    );
    
    return createSuccessResponse(result, 200, 300); // Cache 5 minut
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return createErrorResponse('INTERNAL_ERROR', 
      'Failed to retrieve profiles', undefined, 500);
  }
};
```

**5.2. Plik: `src/pages/api/profiles/[id].ts`**

Endpoint: **GET /api/profiles/:id**

```typescript
import type { APIRoute } from 'astro';
import { ProfileIdParamsSchema } from '@/lib/validation/profile.schemas';
import { ProfileService } from '@/lib/services/profile.service';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/response';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  // Walidacja UUID
  const validation = ProfileIdParamsSchema.safeParse(params);
  
  if (!validation.success) {
    return createErrorResponse('VALIDATION_ERROR', 'Invalid profile ID', 
      validation.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      })), 400);
  }

  try {
    const profile = await ProfileService.getProfileById(
      locals.supabase,
      validation.data.id
    );
    
    if (!profile) {
      return createErrorResponse('NOT_FOUND', 
        'Profile not found or not verified', undefined, 404);
    }
    
    return createSuccessResponse(profile, 200, 600); // Cache 10 minut
  } catch (error) {
    console.error('Error fetching profile:', error);
    return createErrorResponse('INTERNAL_ERROR', 
      'Failed to retrieve profile', undefined, 500);
  }
};
```

**5.3. Plik: `src/pages/api/profiles/me/index.ts`**

Endpoints: **GET /api/profiles/me** i **PATCH /api/profiles/me**

```typescript
import type { APIRoute } from 'astro';
import { UpdateProfileCommandSchema } from '@/lib/validation/profile.schemas';
import { ProfileService } from '@/lib/services/profile.service';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/response';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  // Auth guard
  const { data: { user }, error } = await locals.supabase.auth.getUser();
  
  if (error || !user) {
    return createErrorResponse('UNAUTHORIZED', 
      'Authentication required', undefined, 401);
  }

  try {
    const profile = await ProfileService.getAuthenticatedProfile(
      locals.supabase,
      user.id
    );
    
    if (!profile) {
      return createErrorResponse('NOT_FOUND', 
        'Profile not found', undefined, 404);
    }
    
    return createSuccessResponse(profile, 200);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return createErrorResponse('INTERNAL_ERROR', 
      'Failed to retrieve profile', undefined, 500);
  }
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  // Auth guard
  const { data: { user }, error: authError } = await locals.supabase.auth.getUser();
  
  if (authError || !user) {
    return createErrorResponse('UNAUTHORIZED', 
      'Authentication required', undefined, 401);
  }

  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse('VALIDATION_ERROR', 
      'Invalid JSON body', undefined, 400);
  }

  // Walidacja
  const validation = UpdateProfileCommandSchema.safeParse(body);
  
  if (!validation.success) {
    return createErrorResponse('VALIDATION_ERROR', 'Invalid input data', 
      validation.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      })), 400);
  }

  // Guard: protected fields
  const protectedFields = ['status', 'role', 'nip', 'location', 
    'verification_doc_path', 'ai_usage_count'];
  const hasProtectedFields = Object.keys(body).some(key => 
    protectedFields.includes(key)
  );
  
  if (hasProtectedFields) {
    return createErrorResponse('FORBIDDEN', 
      'Cannot modify protected fields', undefined, 403);
  }

  try {
    const updated = await ProfileService.updateProfile(
      locals.supabase,
      user.id,
      validation.data
    );
    
    if (!updated) {
      return createErrorResponse('NOT_FOUND', 
        'Profile not found', undefined, 404);
    }
    
    return createSuccessResponse(updated, 200);
  } catch (error) {
    console.error('Error updating profile:', error);
    return createErrorResponse('INTERNAL_ERROR', 
      'Failed to update profile', undefined, 500);
  }
};
```

**5.4. Plik: `src/pages/api/profiles/me/verification-document.ts`**

Endpoint: **POST /api/profiles/me/verification-document**

```typescript
import type { APIRoute } from 'astro';
import { ProfileService } from '@/lib/services/profile.service';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/response';

export const prerender = false;

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const POST: APIRoute = async ({ request, locals }) => {
  // Auth guard
  const { data: { user }, error: authError } = await locals.supabase.auth.getUser();
  
  if (authError || !user) {
    return createErrorResponse('UNAUTHORIZED', 
      'Authentication required', undefined, 401);
  }

  // Parse form data
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return createErrorResponse('VALIDATION_ERROR', 
      'Invalid form data', undefined, 400);
  }

  const file = formData.get('file') as File;
  
  // Guard: file exists
  if (!file) {
    return createErrorResponse('VALIDATION_ERROR', 
      'File is required', undefined, 400);
  }

  // Guard: file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return createErrorResponse('VALIDATION_ERROR', 
      'Invalid file type. Allowed: PDF, JPG, PNG', undefined, 400);
  }

  // Guard: file size
  if (file.size > MAX_FILE_SIZE) {
    return createErrorResponse('VALIDATION_ERROR', 
      'File size must not exceed 5MB', undefined, 400);
  }

  try {
    const result = await ProfileService.uploadVerificationDocument(
      locals.supabase,
      user.id,
      file
    );
    
    return createSuccessResponse(result, 200);
  } catch (error) {
    console.error('Error uploading verification document:', error);
    return createErrorResponse('INTERNAL_ERROR', 
      'Failed to upload document', undefined, 500);
  }
};
```

**5.5. Plik: `src/pages/api/profiles/me/geocode.ts`**

Endpoint: **POST /api/profiles/me/geocode**

```typescript
import type { APIRoute } from 'astro';
import { GeocodeCommandSchema } from '@/lib/validation/profile.schemas';
import { ProfileService } from '@/lib/services/profile.service';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/response';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  // Auth guard
  const { data: { user }, error: authError } = await locals.supabase.auth.getUser();
  
  if (authError || !user) {
    return createErrorResponse('UNAUTHORIZED', 
      'Authentication required', undefined, 401);
  }

  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse('VALIDATION_ERROR', 
      'Invalid JSON body', undefined, 400);
  }

  // Walidacja
  const validation = GeocodeCommandSchema.safeParse(body);
  
  if (!validation.success) {
    return createErrorResponse('VALIDATION_ERROR', 'Invalid input data', 
      validation.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      })), 400);
  }

  try {
    const result = await ProfileService.geocodeAddress(
      validation.data.address
    );
    
    if (!result) {
      return createErrorResponse('VALIDATION_ERROR', 
        'Address not found', undefined, 400);
    }
    
    // Opcjonalnie: zaktualizuj lokalizację w profilu
    // await ProfileService.updateLocation(locals.supabase, user.id, result.location);
    
    return createSuccessResponse(result, 200);
  } catch (error) {
    console.error('Error geocoding address:', error);
    return createErrorResponse('INTERNAL_ERROR', 
      'Geocoding service error', undefined, 500);
  }
};
```

---

### Krok 6: Konfiguracja Supabase Storage

**6.1. Utwórz bucket dla dokumentów weryfikacyjnych:**

W Supabase Dashboard:

1. Przejdź do Storage
2. Utwórz nowy bucket: `verification-documents`
3. Ustaw jako Private (tylko autoryzowani użytkownicy)

**6.2. Ustaw RLS policies dla Storage:**

```sql
-- Pozwól użytkownikom uploadować do własnego folderu
CREATE POLICY "Users can upload their own verification documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verification-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Pozwól użytkownikom czytać własne dokumenty
CREATE POLICY "Users can read their own verification documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Pozwól super_admin czytać wszystkie dokumenty
CREATE POLICY "Super admins can read all verification documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-documents' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
  )
);
```

---

### Krok 7: Testowanie

**7.1. Unit testy dla serwisów:**

- Testuj każdą metodę ProfileService z mock data
- Testuj edge cases (puste wyniki, błędy bazy danych)

**7.2. Integration testy dla endpointów:**

- Testuj każdy endpoint z prawidłowymi danymi
- Testuj każdy endpoint z nieprawidłowymi danymi
- Testuj autoryzację (brak tokenu, nieprawidłowy token)
- Testuj scenariusze błędów (404, 500)

**7.3. E2E testy:**

- Pełny flow: rejestracja → upload dokumentu → geocoding → aktualizacja profilu
- Testuj listę schronisk z filtrowaniem
- Testuj obliczanie odległości

**7.4. Checklist testowania:**

✅ GET /api/profiles:

- [ ] Zwraca tylko zweryfikowane schroniska
- [ ] Paginacja działa poprawnie
- [ ] Obliczanie odległości działa (z lat/lon)
- [ ] Filtr urgent_only działa
- [ ] Zwraca 400 dla nieprawidłowych parametrów

✅ GET /api/profiles/:id:

- [ ] Zwraca szczegóły zweryfikowanego schroniska
- [ ] Zwraca 404 dla nie istniejącego ID
- [ ] Zwraca 404 dla nie zweryfikowanego schroniska
- [ ] Zwraca 400 dla nieprawidłowego UUID

✅ GET /api/profiles/me:

- [ ] Zwraca pełny profil zalogowanego użytkownika
- [ ] Zwraca 401 bez tokenu
- [ ] Zwraca wszystkie wrażliwe pola

✅ PATCH /api/profiles/me:

- [ ] Aktualizuje dozwolone pola
- [ ] Zwraca 403 przy próbie aktualizacji chronionych pól
- [ ] Zwraca 400 dla nieprawidłowych danych
- [ ] Zwraca 401 bez tokenu
- [ ] Ustawia updated_at

✅ POST /api/profiles/me/verification-document:

- [ ] Uploaduje plik do Storage
- [ ] Aktualizuje verification_doc_path w bazie
- [ ] Zwraca 400 dla nieprawidłowego typu pliku
- [ ] Zwraca 400 dla zbyt dużego pliku
- [ ] Zwraca 401 bez tokenu

✅ POST /api/profiles/me/geocode:

- [ ] Zwraca współrzędne dla prawidłowego adresu
- [ ] Zwraca 400 dla nie znalezionego adresu
- [ ] Zwraca 401 bez tokenu

---

### Krok 8: Dokumentacja i deployment

**8.1. Dokumentacja API:**

- Zaktualizuj plik `.ai/api-plan.md` z przykładami requestów/responses
- Dodaj przykłady curl dla każdego endpointu
- Dodaj kody błędów i ich znaczenie

**8.2. Konfiguracja zmiennych środowiskowych:**

Plik `.env`:

```env
# Supabase
PUBLIC_SUPABASE_URL=your-supabase-url
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Geocoding (opcjonalnie)
GEOCODING_API_KEY=your-api-key  # Jeśli używasz Google Maps
```

**8.3. Deployment checklist:**

- [ ] Wszystkie zmienne środowiskowe ustawione w Vercel
- [ ] Migracje bazy danych wykonane
- [ ] Storage bucket utworzony
- [ ] RLS policies włączone
- [ ] Indeksy utworzone
- [ ] Monitoring włączony (Sentry, LogRocket)

**8.4. Monitoring i alerty:**

- Skonfiguruj alerty dla błędów 500
- Monitoruj czas odpowiedzi endpointów
- Śledź użycie geocoding API (koszty)
- Monitoruj rozmiar Storage bucket

---

## 10. Podsumowanie

Ten plan implementacji obejmuje:

✅ **6 endpointów** REST API dla zarządzania profilami schronisk  
✅ **Walidację** wszystkich danych wejściowych z Zod  
✅ **Bezpieczeństwo** - uwierzytelnianie, autoryzacja, RLS  
✅ **Obsługę błędów** - guard clauses, standardowe formaty  
✅ **Wydajność** - indeksy, paginacja, caching  
✅ **Upload plików** - Supabase Storage z walidacją  
✅ **Geokodowanie** - integracja z zewnętrznym API  
✅ **Testowanie** - unit, integration, E2E  

**Kolejność implementacji:**

1. Validation schemas (Zod)
2. Utility funkcje (error, response)
3. ProfileService (logika biznesowa)
4. Endpointy API (routes)
5. Storage configuration
6. Testowanie
7. Deployment

**Szacowany czas implementacji:** 2-3 dni dla doświadczonego dewelopera.

**Następne kroki po implementacji:**

- Zaimplementuj Needs endpoints (analogiczna struktura)
- Dodaj Admin endpoints (zarządzanie weryfikacją)
- Zaimplementuj AI endpoints (generowanie opisów, linków)
