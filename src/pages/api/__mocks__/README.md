# Mock API Endpoints

Mock endpoints zwracające statyczne dane - użyj ich do testowania frontendu bez połączenia z bazą danych.

## Dostępne endpointy

| Real API | Mock API | Status |
|----------|----------|--------|
| `GET /api/profiles` | `GET /api/__mocks__/profiles` | ✅ |
| `GET /api/profiles/:id` | `GET /api/__mocks__/profiles/:id` | ✅ |
| `GET /api/profiles/me` | `GET /api/__mocks__/profiles/me` | ✅ |
| `PATCH /api/profiles/me` | `PATCH /api/__mocks__/profiles/me` | ✅ |
| `POST /api/profiles/me/geocode` | `POST /api/__mocks__/profiles/me/geocode` | ✅ |
| `POST /api/profiles/me/verification-document` | `POST /api/__mocks__/profiles/me/verification-document` | ✅ |

## Jak używać

### 1. Uruchom dev server

```bash
npm run dev
```

### 2. Użyj mock endpoints zamiast prawdziwych

**Zamiast:**
```bash
GET http://localhost:4321/api/profiles
```

**Użyj:**
```bash
GET http://localhost:4321/api/__mocks__/profiles
```

### 3. Testuj wszystkie funkcjonalności

Mock endpoints implementują:
- ✅ Wszystkie parametry zapytania (lat, lon, urgent_only, limit, offset)
- ✅ Walidację danych wejściowych
- ✅ Obsługę błędów (400, 403, 404)
- ✅ Symulację opóźnień sieciowych (200-800ms)
- ✅ Filtrowanie i sortowanie danych

## Przykłady użycia

### GET /api/__mocks__/profiles

```bash
# Podstawowe zapytanie
curl http://localhost:4321/api/__mocks__/profiles

# Z geolokalizacją
curl "http://localhost:4321/api/__mocks__/profiles?lat=52.2297&lon=21.0122"

# Tylko pilne potrzeby
curl "http://localhost:4321/api/__mocks__/profiles?urgent_only=true"
```

### GET /api/__mocks__/profiles/:id

```bash
curl http://localhost:4321/api/__mocks__/profiles/550e8400-e29b-41d4-a716-446655440000
```

### PATCH /api/__mocks__/profiles/me

```bash
curl -X PATCH http://localhost:4321/api/__mocks__/profiles/me \
  -H "Content-Type: application/json" \
  -d '{"name": "Nowa nazwa", "city": "Warszawa"}'
```

### POST /api/__mocks__/profiles/me/geocode

```bash
curl -X POST http://localhost:4321/api/__mocks__/profiles/me/geocode \
  -H "Content-Type: application/json" \
  -d '{"address": "ul. Marszałkowska 1, Warszawa"}'
```

### POST /api/__mocks__/profiles/me/verification-document

```bash
curl -X POST http://localhost:4321/api/__mocks__/profiles/me/verification-document \
  -F "file=@document.pdf"
```

## Specjalne zachowania

### Geocoding
Mock endpoint rozpoznaje następujące adresy:
- `ul. Marszałkowska 1, Warszawa` → Zwraca dokładne współrzędne
- `ul. Floriańska 1, 31-019 Kraków` → Zwraca dokładne współrzędne
- `ul. Długa 1, Gdańsk` → Zwraca dokładne współrzędne
- Inne adresy → Zwraca centrum Warszawy
- Adresy zawierające "nieistniejąc" → Błąd 400 NOT_FOUND

### Walidacja
Wszystkie endpointy implementują pełną walidację:
- Sprawdzanie typów plików (tylko PDF, JPEG, PNG)
- Limit rozmiaru pliku (max 5MB)
- Walidacja JSON
- Ochrona chronionych pól w PATCH

## REST Client (VS Code)

Użyj pliku `__mocks__/api-tests.http` i zmień URL na mock endpoints:

```http
@baseUrl = http://localhost:4321/api/__mocks__

GET {{baseUrl}}/profiles
```

## Przełączanie między mock a real API

W frontendzie użyj zmiennej środowiskowej:

```typescript
const API_BASE = import.meta.env.DEV 
  ? '/api/__mocks__'  // Development - mocki
  : '/api';           // Production - prawdziwe API
```

## Dane źródłowe

Mock endpoints używają danych z:
- `__mocks__/data/profiles.json` - Profile schronisk

Możesz edytować te pliki aby dostosować dane testowe.
