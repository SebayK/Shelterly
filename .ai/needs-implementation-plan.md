# API Endpoint Implementation Plan: GET /api/needs

## 1. Przegląd punktu końcowego

Endpoint `GET /api/needs` służy do pobierania listy potrzeb zgłoszonych przez zweryfikowane schroniska. Jest to publiczny endpoint umożliwiający użytkownikom przeglądanie i filtrowanie potrzeb w systemie. Endpoint wspiera zaawansowane filtrowanie po schronisku, kategorii, pilności oraz statusie realizacji, a także implementuje mechanizm paginacji dla efektywnego zarządzania dużymi zbiorami danych.

**Kluczowe funkcjonalności:**

- Pobieranie listy potrzeb z informacjami o schronisku
- Filtrowanie wielokryteriowe (schronisko, kategoria, pilność, status)
- Paginacja wyników (limit/offset)
- Automatyczne wykluczanie usuniętych potrzeb (soft delete)
- Kalkulacja procentowego postępu realizacji potrzeby
- Zwracanie tylko potrzeb ze zweryfikowanych schronisk

## 2. Szczegóły żądania

**Metoda HTTP:** GET

**Struktura URL:** `/api/needs`

**Query Parameters:**

| Parametr | Typ | Wymagany | Default | Opis |
|----------|-----|----------|---------|------|
| `shelter_id` | UUID | Nie | - | Identyfikator schroniska do filtrowania |
| `category` | Enum | Nie | - | Kategoria potrzeby (food, textiles, cleaning, medical, toys, other) |
| `urgency` | Enum | Nie | - | Poziom pilności (low, normal, high, urgent, critical) |
| `fulfilled` | Boolean | Nie | - | Czy zawierać zrealizowane potrzeby (true/false) |
| `limit` | Number | Nie | 20 | Liczba wyników na stronę (1-100) |
| `offset` | Number | Nie | 0 | Offset dla paginacji (>= 0) |

**Przykładowe żądania:**

```
GET /api/needs
GET /api/needs?shelter_id=123e4567-e89b-12d3-a456-426614174000
GET /api/needs?category=food&urgency=urgent&limit=10
GET /api/needs?fulfilled=false&offset=20
```

**Request Body:** Brak (GET endpoint)

## 3. Wykorzystywane typy

### DTO (Data Transfer Objects)

**NeedListItemDTO** - pojedynczy element listy potrzeb:

```typescript
{
  id: string;
  shelter: ShelterInfo;
  category: NeedCategory;
  title: string;
  description: string | null;
  urgency: UrgencyLevel;
  target_quantity: number;
  current_quantity: number;
  unit: NeedUnit;
  progress_percentage: number;
  is_fulfilled: boolean;
  created_at: string;
}
```

**ShelterInfo** - informacje o schronisku:

```typescript
{
  id: string;
  name: string;
  city: string;
}
```

**NeedListResponseDTO** - wrapper odpowiedzi:

```typescript
{
  data: NeedListItemDTO[];
  pagination: Pagination;
}
```

**Pagination** - metadane paginacji:

```typescript
{
  total: number;
  limit: number;
  offset: number;
}
```

### Query Parameters Type

**NeedsQueryParams** - parametry zapytania:

```typescript
{
  shelter_id?: string;
  category?: NeedCategory;
  urgency?: UrgencyLevel;
  fulfilled?: boolean;
  limit?: number;
  offset?: number;
}
```

### Error Response Type

**ErrorResponse** - standardowa odpowiedź błędu:

```typescript
{
  code: ErrorCode;
  message: string;
  details?: ErrorDetail[];
}
```

## 4. Szczegóły odpowiedzi

### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "shelter": {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "name": "Schronisko Warszawa",
        "city": "Warszawa"
      },
      "category": "food",
      "title": "Karma mokra dla kotów",
      "description": "Pilnie potrzebujemy karmy mokrej dla naszych kotów...",
      "urgency": "urgent",
      "target_quantity": 50.00,
      "current_quantity": 12.00,
      "unit": "kg",
      "progress_percentage": 24,
      "is_fulfilled": false,
      "created_at": "2026-01-20T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 234,
    "limit": 20,
    "offset": 0
  }
}
```

### Error Responses

**400 Bad Request** - Nieprawidłowe parametry zapytania:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid query parameters",
  "details": [
    {
      "field": "limit",
      "message": "Limit must be between 1 and 100"
    }
  ]
}
```

**500 Internal Server Error** - Błąd serwera:

```json
{
  "code": "INTERNAL_ERROR",
  "message": "An unexpected error occurred"
}
```

## 5. Przepływ danych

### Architektura warstw

```
API Route (src/pages/api/needs/index.ts)
    ↓
Validation (Zod Schema - src/lib/validation/needs.schemas.ts)
    ↓
Service Layer (src/lib/services/needs.service.ts)
    ↓
Supabase Client (src/db/supabase.client.ts)
    ↓
PostgreSQL Database (needs + profiles tables)
```

### Szczegółowy przepływ

1. **Przyjęcie żądania**
   - Endpoint odbiera żądanie GET z query parameters
   - Ekstrakcja parametrów z `Astro.url.searchParams`

2. **Walidacja danych wejściowych**
   - Użycie Zod schema do walidacji parametrów
   - Konwersja typów (string → number dla limit/offset, string → boolean dla fulfilled)
   - Walidacja UUID dla shelter_id
   - Walidacja enum dla category i urgency
   - Walidacja zakresów (limit: 1-100, offset: >= 0)

3. **Wywołanie service**
   - Przekazanie zwalidowanych parametrów do `getNeeds()`
   - Service używa Supabase Query Builder

4. **Zapytanie do bazy danych**
   - SELECT z tabeli `needs`
   - INNER JOIN z tabelą `profiles` dla informacji o schronisku
   - Filtrowanie:
     - `deleted_at IS NULL` (wykluczenie soft-deleted)
     - `profiles.status = 'verified'` (tylko zweryfikowane schroniska)
     - Opcjonalne filtry z parametrów (shelter_id, category, urgency, fulfilled)
   - Sortowanie: `created_at DESC` (najnowsze najpierw)
   - Paginacja: LIMIT i OFFSET

5. **Obliczenie total count**
   - Osobne zapytanie COUNT z tymi samymi filtrami (bez LIMIT/OFFSET)
   - Potrzebne dla metadanych paginacji

6. **Transformacja danych**
   - Mapowanie wyników bazy danych na `NeedListItemDTO[]`
   - Kalkulacja `progress_percentage = target_quantity > 0 ? (current_quantity / target_quantity) * 100 : 0` (z zabezpieczeniem przed dzieleniem przez zero)
   - Formatowanie zagnieżdżonego obiektu `ShelterInfo`

7. **Konstruowanie odpowiedzi**
   - Utworzenie `NeedListResponseDTO` z `data` i `pagination`
   - Zwrócenie JSON z kodem 200

8. **Obsługa błędów**
   - Błędy walidacji → 400 Bad Request
   - Błędy bazy danych → 500 Internal Server Error
   - Logowanie błędów do konsoli

## 6. Względy bezpieczeństwa

### Uwierzytelnianie i autoryzacja

- **Typ dostępu:** Publiczny (brak wymagania uwierzytelnienia)
- **Uzasadnienie:** Zgodnie z RLS policy dla tabeli `needs` - SELECT jest publiczny
- **Ograniczenia:**
  - Zwracane są tylko potrzeby ze zweryfikowanych schronisk (`status = 'verified'`)
  - Automatyczne wykluczenie soft-deleted potrzeb (`deleted_at IS NULL`)

### Walidacja danych wejściowych

1. **Zod Schema Validation**
   - Wszystkie parametry query są walidowane przed użyciem
   - Zapobiega SQL injection (parametryzowane zapytania)
   - Zapobiega type coercion attacks

2. **UUID Validation**
   - `shelter_id` musi być poprawnym UUID v4
   - Użycie `z.string().uuid()` w Zod

3. **Enum Validation**
   - `category` i `urgency` są walidowane względem zdefiniowanych enum
   - Tylko dozwolone wartości są akceptowane

4. **Range Validation**
   - `limit`: min 1, max 100 (zapobiega DoS przez duże limity)
   - `offset`: min 0 (zapobiega błędom logicznym)

### Ochrona przed atakami

1. **SQL Injection**
   - Użycie Supabase Query Builder (parametryzowane zapytania)
   - Brak bezpośredniego SQL z interpolacją zmiennych

2. **DoS (Denial of Service)**
   - Maksymalny limit ustawiony na 100
   - Paginacja wymusza pobieranie danych częściami

3. **Information Disclosure**
   - Nie zwracamy wrażliwych danych (NIP, verification_doc_path)
   - Tylko publiczne pola profilu schroniska

4. **Mass Assignment**
   - Nie dotyczy (GET endpoint, brak modyfikacji danych)

### Rate Limiting

- **Zalecenie:** Implementacja rate limiting na poziomie middleware/CDN
- **Sugerowane limity:** 100 requests/minute per IP dla publicznych endpointów

## 7. Obsługa błędów

### Tabela scenariuszy błędów

| Scenariusz | Kod HTTP | Error Code | Message | Przykład |
|------------|----------|------------|---------|----------|
| Nieprawidłowy UUID | 400 | VALIDATION_ERROR | Invalid UUID format for shelter_id | `shelter_id=invalid-uuid` |
| Nieznana kategoria | 400 | VALIDATION_ERROR | Invalid category value | `category=unknown` |
| Nieznana pilność | 400 | VALIDATION_ERROR | Invalid urgency value | `urgency=super-urgent` |
| Limit < 1 | 400 | VALIDATION_ERROR | Limit must be between 1 and 100 | `limit=0` |
| Limit > 100 | 400 | VALIDATION_ERROR | Limit must be between 1 and 100 | `limit=1000` |
| Offset < 0 | 400 | VALIDATION_ERROR | Offset must be non-negative | `offset=-5` |
| Nieprawidłowy boolean | 400 | VALIDATION_ERROR | Fulfilled must be a boolean | `fulfilled=maybe` |
| Błąd połączenia z DB | 500 | INTERNAL_ERROR | An unexpected error occurred | - |
| Timeout bazy danych | 500 | SERVICE_UNAVAILABLE | Service temporarily unavailable | - |

### Implementacja obsługi błędów

```typescript
try {
  // Walidacja
  const validatedParams = needsQuerySchema.parse(rawParams);
  
  // Service call
  const result = await getNeeds(validatedParams, supabase);
  
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
} catch (error) {
  if (error instanceof z.ZodError) {
    // Validation errors
    return new Response(JSON.stringify({
      code: 'VALIDATION_ERROR',
      message: 'Invalid query parameters',
      details: error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Server errors
  console.error('Error fetching needs:', error);
  return new Response(JSON.stringify({
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred'
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### Logowanie błędów

- **Błędy walidacji:** Nie logować (są oczekiwane)
- **Błędy serwera:** Logować do konsoli z pełnym stack trace
- **Produkcja:** Integracja z systemem monitoringu (np. Sentry)

## 8. Rozważania dotyczące wydajności

### Optymalizacje zapytań

1. **Indeksy bazy danych**
   - `needs.created_at` - BTREE (sortowanie)
   - `needs.urgency` - BTREE (filtrowanie)
   - `needs.is_fulfilled` - BTREE (filtrowanie)
   - `needs.shelter_id` - BTREE (JOIN i filtrowanie)
   - `profiles.status` - BTREE (filtrowanie verified)

2. **Selective Field Loading**
   - Pobieranie tylko niezbędnych kolumn
   - Unikanie `SELECT *`
   - Minimalizacja transferu danych

3. **Pagination**
   - Limit default: 20 (rozsądny balans)
   - Max limit: 100 (ochrona przed nadmiernym obciążeniem)
   - Cursor-based pagination można rozważyć w przyszłości

### Caching

**Strategie cache:**

1. **CDN/Edge Caching**
   - Cache-Control header: `public, max-age=60, s-maxage=120`
   - Max-age: 60 sekund dla przeglądarek (1 minuta)
   - S-maxage: 120 sekund dla shared cache/CDN (2 minuty)
   - Uzasadnienie: Dane zmieniają się rzadko, ale muszą być relatywnie aktualne

2. **Application-level Caching**
   - Redis cache dla popularnych query (np. bez filtrów)
   - TTL: 5 minut
   - Invalidacja przy UPDATE/INSERT/DELETE needs

3. **Database Query Caching**
   - PostgreSQL automatycznie cache'uje query plans
   - Materialized views można rozważyć dla popularnych agregatów

### Potencjalne wąskie gardła

1. **COUNT query**
   - Rozwiązanie: Cache total count per filter combination
   - Alternatywa: Approximate count dla dużych zbiorów

2. **JOIN z profiles**
   - Rozwiązanie: Właściwe indeksy + selective fields
   - Monitorowanie query performance

3. **Limit wysoki (100)**
   - Rozwiązanie: Monitoring i ewentualne obniżenie max limit
   - Rate limiting dla ochrony

### Monitoring

- **Metryki do śledzenia:**
  - Średni czas odpowiedzi
  - 95th/99th percentile response time
  - Częstość używania różnych filtrów
  - Cache hit ratio
  - Błędy 4xx/5xx

## 9. Etapy wdrożenia

### Etap 1: Przygotowanie walidacji i typów

**Pliki do utworzenia/modyfikacji:**

- `src/lib/validation/needs.schemas.ts`

**Zadania:**

1. Utworzyć plik `needs.schemas.ts`
2. Zaimportować wymagane typy z `src/types.ts` i `src/db/database.types.ts`
3. Utworzyć Zod schema dla query parameters:

   ```typescript
   export const needsQuerySchema = z.object({
     shelter_id: z.string().uuid().optional(),
     category: z.enum(['food', 'textiles', 'cleaning', 'medical', 'toys', 'other']).optional(),
     urgency: z.enum(['low', 'normal', 'high', 'urgent', 'critical']).optional(),
     fulfilled: z.coerce.boolean().optional(),
     limit: z.coerce.number().int().min(1).max(100).default(20),
     offset: z.coerce.number().int().min(0).default(0)
   });
   ```

4. Eksportować typy dla TypeScript inference

**Testy jednostkowe:**

- Walidacja poprawnych parametrów
- Odrzucenie nieprawidłowych UUID
- Odrzucenie nieprawidłowych enum values
- Walidacja zakresów limit i offset

### Etap 2: Implementacja warstwy service

**Pliki do utworzenia/modyfikacji:**

- `src/lib/services/needs.service.ts`

**Zadania:**

1. Utworzyć plik `needs.service.ts`
2. Zaimportować typy i Supabase client type
3. Zaimplementować klasę `NeedsService` z metodą `getNeeds()`:
   - Konstruktor przyjmuje: `(supabase: SupabaseClient)`
   - Metoda `getNeeds()` przyjmuje: `(params: NeedsQueryParams)`
   - Zwraca: `Promise<NeedListResponseDTO>`
4. Budowanie query z filtrami:

   ```typescript
   let query = supabase
     .from('needs')
     .select(`
       id,
       category,
       title,
       description,
       urgency,
       target_quantity,
       current_quantity,
       unit,
       is_fulfilled,
       created_at,
       profiles!inner (
         id,
         name,
         city,
         status
       )
     `, { count: 'exact' })
     .is('deleted_at', null)
     .eq('profiles.status', 'verified')
     .order('created_at', { ascending: false });
   ```

   **Uwaga:** 
   - Użycie `profiles!inner` zamiast `shelter:profiles!shelter_id` - INNER JOIN automatycznie przez foreign key
   - Dodanie pola `status` do select jest konieczne, aby móc filtrować po `profiles.status`
   - INNER JOIN zapewnia, że zwracane są tylko needs z powiązanymi profilami schronisk

5. Aplikowanie opcjonalnych filtrów (if statements)
6. Aplikowanie paginacji (range)
7. Transformacja wyników do DTO format
8. Kalkulacja `progress_percentage`
9. Obsługa błędów bazy danych

**Testy jednostkowe:**

- Query bez filtrów
- Query z każdym filtrem osobno
- Query z wieloma filtrami
- Paginacja
- Kalkulacja progress_percentage
- Obsługa pustych wyników

### Etap 3: Implementacja API endpoint

**Pliki do utworzenia/modyfikacji:**

- `src/pages/api/needs/index.ts`

**Zadania:**

1. Utworzyć plik `index.ts` w `src/pages/api/needs/`
2. Dodać `export const prerender = false`
3. Zaimplementować handler GET:
   - Ekstrakcja query parameters z `Astro.url.searchParams`
   - Walidacja przez Zod schema z użyciem `.safeParse()`
   - Obsługa błędów walidacji przez `createValidationErrorResponse()`
   - Pobranie Supabase client z `context.locals.supabase`
   - Utworzenie instancji `NeedsService` z Supabase client
   - Wywołanie `needsService.getNeeds()` 
   - Zwrócenie odpowiedzi JSON
4. Implementacja obsługi błędów:
   - Try-catch block
   - Użycie helper functions z `src/lib/errors.ts`:
     - `createValidationErrorResponse()` dla błędów walidacji
     - `createErrorHttpResponse()` dla błędów ogólnych
     - `logError()` dla logowania z kontekstem
   - Odpowiednie kody HTTP (400, 500)
5. Ustawienie headers:
   - `Content-Type: application/json`
   - `Cache-Control: public, max-age=60, s-maxage=120`

**Struktura pliku:**

```typescript
import type { APIRoute } from 'astro';
import { NeedsService } from '../../../lib/services/needs.service';
import { needsQuerySchema } from '../../../lib/validation/needs.schemas';
import { createValidationErrorResponse, createErrorHttpResponse, logError } from '../../../lib/errors';

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    // Extract and validate query parameters
    const shelter_id = url.searchParams.get('shelter_id');
    const category = url.searchParams.get('category');
    const urgency = url.searchParams.get('urgency');
    const fulfilled = url.searchParams.get('fulfilled');
    const limit = url.searchParams.get('limit');
    const offset = url.searchParams.get('offset');

    const validationResult = needsQuerySchema.safeParse({
      shelter_id,
      category,
      urgency,
      fulfilled,
      limit,
      offset,
    });

    if (!validationResult.success) {
      return createValidationErrorResponse(validationResult.error.errors);
    }

    const params = validationResult.data;
    
    // Get Supabase client
    const supabase = locals.supabase;
    if (!supabase) {
      return createErrorHttpResponse('INTERNAL_ERROR', 'Database connection not available', 500);
    }
    
    // Fetch needs
    const needsService = new NeedsService(supabase);
    const result = await needsService.getNeeds(params);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=120'
      }
    });
  } catch (error) {
    // Log and handle unexpected errors
    logError('[GET /api/needs]', error);
    return createErrorHttpResponse(
      'INTERNAL_ERROR',
      'An unexpected error occurred while fetching needs',
      500
    );
  }
};
```

### Etap 4: Testy integracyjne

**Pliki do utworzenia/modyfikacji:**

- `src/pages/api/__mocks__/needs/index.ts` (opcjonalnie dla mockowania)

**Zadania:**

1. Testy pozytywne:
   - GET bez parametrów (default pagination)
   - GET z każdym filtrem osobno
   - GET z wieloma filtrami
   - GET z różnymi wartościami paginacji
2. Testy negatywne:
   - Nieprawidłowy UUID
   - Nieprawidłowe enum values
   - Limit poza zakresem
   - Offset ujemny
3. Testy brzegowe:
   - Pusta lista wyników
   - Limit = 1 i limit = 100
   - Offset większy niż total
4. Weryfikacja formatu odpowiedzi:
   - Struktura JSON zgodna z DTO
   - Poprawność progress_percentage
   - Poprawność zagnieżdżonych obiektów (shelter)

**Narzędzia:**

- Vitest do unit/integration tests
- Supertest lub fetch do testów HTTP
- Mock Supabase client

### Etap 5: Dokumentacja i deployment

**Zadania:**

1. Aktualizacja dokumentacji API:
   - Przykłady użycia
   - Wszystkie możliwe error responses
2. Code review:
   - Zgodność z coding standards
   - Bezpieczeństwo
   - Performance
3. Testy manualne w środowisku dev:
   - Testowanie z rzeczywistymi danymi
   - Weryfikacja performance
4. Deployment do staging:
   - Weryfikacja w środowisku staging
   - Load testing (opcjonalnie)
5. Monitoring setup:
   - Konfiguracja alertów dla błędów 5xx
   - Dashboard dla metryk endpoint
6. Production deployment:
   - Deploy przez CI/CD pipeline
   - Smoke tests po deployment

### Etap 6: Monitoring i optymalizacja

**Zadania:**

1. Monitorowanie metryk przez pierwsze 48h:
   - Response times
   - Error rates
   - Cache hit ratios
2. Analiza query performance:
   - Slow query log w PostgreSQL
   - Identyfikacja bottlenecków
3. Optymalizacje (jeśli potrzebne):
   - Dodanie/modyfikacja indeksów
   - Dostosowanie cache TTL
   - Optymalizacja query
4. Dokumentacja lessons learned:
   - Co działa dobrze
   - Co wymaga poprawy
   - Rekomendacje dla przyszłych endpointów

## 10. Checklist wdrożenia

### Implementacja kodu
- [x] Utworzono `src/lib/validation/needs.schemas.ts` z Zod schemas
- [x] Utworzono `src/lib/services/needs.service.ts` z klasą NeedsService
- [x] Rozszerzono `src/lib/errors.ts` o helper functions (createErrorResponse, createErrorHttpResponse, createValidationErrorResponse, logError)
- [x] Utworzono `src/pages/api/needs/index.ts` z handlerem GET
- [x] Dodano `export const prerender = false` w API route
- [x] Zaimplementowano walidację wszystkich query parameters
- [x] Zaimplementowano obsługę błędów (400, 500) z użyciem helper functions
- [x] Zaimplementowano kalkulację progress_percentage z zabezpieczeniem przed dzieleniem przez zero
- [x] Dodano odpowiednie headers (Content-Type, Cache-Control: public, max-age=60, s-maxage=120)

### Mock endpoints i dane testowe
- [x] Utworzono mock endpoint `src/pages/api/mocks/needs/index.ts`
- [x] Utworzono dane testowe `__mocks__/data/needs.json`
- [x] Zaktualizowano README.md w `src/pages/api/mocks/` z przykładami użycia

### Testy
- [ ] Napisano testy jednostkowe dla schema validation
- [ ] Napisano testy jednostkowe dla needs service
- [ ] Napisano testy integracyjne dla endpoint

### Przegląd i dokumentacja
- [x] Zweryfikowano zgodność z TypeScript types
- [x] Przeprowadzono code review
- [x] Zaktualizowano dokumentację API (plan implementacji + Changelog)

### Testowanie i deployment
- [ ] Przetestowano manualnie w środowisku dev
- [ ] Skonfigurowano monitoring i alerty
- [ ] Wdrożono na staging
- [ ] Przeprowadzono testy akceptacyjne
- [ ] Wdrożono na production
- [ ] Zweryfikowano metryki po 24h działania

## 11. Zależności między komponentami

```
needs.schemas.ts
    ↓ (używa)
index.ts (API route)
    ↓ (wywołuje)
needs.service.ts
    ↓ (używa)
supabase.client.ts
    ↓ (łączy się)
PostgreSQL Database
```

## 12. Potencjalne rozszerzenia (Future Enhancements)

1. **Cursor-based pagination**
   - Lepsza wydajność dla dużych offsetów
   - Stabilność przy równoczesnych zmianach danych

2. **Full-text search**
   - Wyszukiwanie w title i description
   - PostgreSQL Full-Text Search lub Algolia

3. **Geolocation filtering**
   - Filtrowanie po odległości od użytkownika
   - Integracja z funkcjami PostGIS

4. **Advanced sorting**
   - Sortowanie po różnych polach (urgency, progress, created_at)
   - Multiple sort criteria

5. **GraphQL endpoint**
   - Elastyczność w pobieraniu danych
   - Redukcja over-fetching

6. **Webhook notifications**
   - Powiadomienia o nowych pilnych potrzebach
   - Integracja z systemami zewnętrznymi

## 13. Poprawki względem pierwotnego planu (Changelog)

**Data aktualizacji:** 12.02.2026

### Poprawki techniczne:

1. **Składnia Supabase Query (Etap 2, punkt 4)**
   - ❌ **Poprzednio:** `shelter:profiles!shelter_id (...)`
   - ✅ **Poprawiono na:** `profiles!inner (..., status)`
   - **Uzasadnienie:** Poprawna składnia INNER JOIN w Supabase. Dodano pole `status` do select, aby umożliwić filtrowanie `.eq('profiles.status', 'verified')`

2. **Typ JOIN (Sekcja 5.4)**
   - ❌ **Poprzednio:** LEFT JOIN
   - ✅ **Poprawiono na:** INNER JOIN
   - **Uzasadnienie:** INNER JOIN zapewnia, że zwracane są tylko needs z istniejącymi profilami schronisk

3. **Kalkulacja progress_percentage (Sekcja 5.6)**
   - ❌ **Poprzednio:** `(current_quantity / target_quantity) * 100`
   - ✅ **Poprawiono na:** `target_quantity > 0 ? (current_quantity / target_quantity) * 100 : 0`
   - **Uzasadnienie:** Zabezpieczenie przed dzieleniem przez zero

### Usprawnienia:

4. **Error Handling**
   - ✅ **Dodano:** Helper functions w `src/lib/errors.ts`
     - `createErrorResponse()` - Standaryzacja obiektów błędów
     - `createErrorHttpResponse()` - Tworzenie HTTP Response z błędem
     - `createValidationErrorResponse()` - Specjalna funkcja dla błędów Zod
     - `logError()` - Ujednolicone logowanie
   - **Uzasadnienie:** DRY principle, eliminacja duplikacji kodu

5. **Cache Headers (Sekcja 8.1 i Etap 3)**
   - ❌ **Poprzednio:** `Cache-Control: public, max-age=60`
   - ✅ **Poprawiono na:** `Cache-Control: public, max-age=60, s-maxage=120`
   - **Uzasadnienie:** Osobne TTL dla shared cache (CDN) - lepsza optymalizacja

6. **Struktura kodu (Etap 2)**
   - ❌ **Poprzednio:** Funkcja `getNeeds()`
   - ✅ **Poprawiono na:** Klasa `NeedsService` z metodą `getNeeds()`
   - **Uzasadnienie:** Lepsza organizacja kodu, zgodność z OOP principles

7. **Walidacja parametrów (Etap 3)**
   - ✅ **Dodano:** Użycie `.safeParse()` zamiast `.parse()`
   - **Uzasadnienie:** Lepsze zarządzanie błędami, brak zbędnego try-catch dla ZodError

Wszystkie poprawki są zgodne z best practices i dokumentacją Supabase.
