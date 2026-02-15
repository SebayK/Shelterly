# Mock API Endpoints

Mock endpoints returning static data - use them for frontend testing without database connection.

## Available Endpoints

| Real API | Mock API | Status |
|----------|----------|--------|
| `GET /api/profiles` | `GET /api/mocks/profiles` | ✅ |
| `GET /api/profiles/:id` | `GET /api/mocks/profiles/:id` | ✅ |
| `GET /api/profiles/me` | `GET /api/mocks/profiles/me` | ✅ |
| `PATCH /api/profiles/me` | `PATCH /api/mocks/profiles/me` | ✅ |
| `POST /api/profiles/me/geocode` | `POST /api/mocks/profiles/me/geocode` | ✅ |
| `POST /api/profiles/me/verification-document` | `POST /api/mocks/profiles/me/verification-document` | ✅ |
| `GET /api/needs` | `GET /api/mocks/needs` | ✅ |

## How to Use

### 1. Start dev server

```bash
npm run dev
```

### 2. Use mock endpoints instead of real ones

**Instead of:**
```bash
GET http://localhost:4321/api/profiles
```

**Use:**
```bash
GET http://localhost:4321/api/mocks/profiles
```

### 3. Test all functionalities

Mock endpoints provide:
- ✅ Support for common query parameters (lat, lon, urgent_only, limit, offset, category, urgency, fulfilled)
- ✅ Basic input data validation (aims to be similar to the real API but may not enforce every rule)
- ✅ Error handling (400, 403, 404) for common scenarios
- ✅ Network delay simulation (200-800ms)
- ✅ Data filtering and sorting

## Usage Examples

### GET /api/mocks/profiles

```bash
# Basic query
curl http://localhost:4321/api/mocks/profiles

# With geolocation
curl "http://localhost:4321/api/mocks/profiles?lat=52.2297&lon=21.0122"

# Only urgent needs
curl "http://localhost:4321/api/mocks/profiles?urgent_only=true"
```

### GET /api/mocks/profiles/:id

```bash
curl http://localhost:4321/api/mocks/profiles/550e8400-e29b-41d4-a716-446655440000
```

### PATCH /api/mocks/profiles/me

```bash
curl -X PATCH http://localhost:4321/api/mocks/profiles/me \
  -H "Content-Type: application/json" \
  -d '{"name": "New name", "city": "Warsaw"}'
```

### POST /api/mocks/profiles/me/geocode

```bash
curl -X POST http://localhost:4321/api/mocks/profiles/me/geocode \
  -H "Content-Type: application/json" \
  -d '{"address": "ul. Marszałkowska 1, Warszawa"}'
```

### POST /api/mocks/profiles/me/verification-document

```bash
curl -X POST http://localhost:4321/api/mocks/profiles/me/verification-document \
  -F "file=@document.pdf"
```

## Special Behaviors

### Geocoding
Mock endpoint recognizes the following addresses:
- `ul. Marszałkowska 1, Warszawa` → Returns exact coordinates
- `ul. Floriańska 1, 31-019 Kraków` → Returns exact coordinates
- `ul. Długa 1, Gdańsk` → Returns exact coordinates
- Other addresses → Returns Warsaw city center
- Addresses containing "nieistniejąc" → Error 400 NOT_FOUND

### Validation
Mock endpoints implement validation for common scenarios:
- File type checking (PDF, JPEG, PNG only)
- File size limit (max 5MB)
- JSON validation
- Protected fields protection in PATCH
- Query parameter validation (using the same Zod schemas as real API where applicable)

## REST Client (VS Code)

You can use an HTTP REST client (for example, the VS Code REST Client extension) with a `.http` file pointing to these mock endpoints:

```http
@baseUrl = http://localhost:4321/api/mocks

GET {{baseUrl}}/profiles
```

## Switching Between Mock and Real API

In frontend use environment variable:

```typescript
const API_BASE = import.meta.env.DEV 
  ? '/api/mocks'  // Development - mocks
  : '/api';       // Production - real API
```

## Data Sources

Mock endpoints use data from:
- `__mocks__/data/profiles.json` - Shelter profiles
- `__mocks__/data/needs.json` - Shelter needs

You can edit these files to customize test data.

## Usage Examples - GET /api/mocks/needs

```bash
# All needs (default 20 per page)
curl "http://localhost:3000/api/mocks/needs"

# Filter by category
curl "http://localhost:3000/api/mocks/needs?category=food"
curl "http://localhost:3000/api/mocks/needs?category=medical"

# Filter by urgency
curl "http://localhost:3000/api/mocks/needs?urgency=critical"
curl "http://localhost:3000/api/mocks/needs?urgency=urgent"

# Only fulfilled/unfulfilled
curl "http://localhost:3000/api/mocks/needs?fulfilled=true"
curl "http://localhost:3000/api/mocks/needs?fulfilled=false"

# Filter by shelter ID
curl "http://localhost:3000/api/mocks/needs?shelter_id=650e8400-e29b-41d4-a716-446655440002"

# Pagination
curl "http://localhost:3000/api/mocks/needs?limit=5&offset=10"

# Combined filters
curl "http://localhost:3000/api/mocks/needs?category=food&urgency=critical&fulfilled=false&limit=10"
```
