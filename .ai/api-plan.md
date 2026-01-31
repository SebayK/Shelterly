# REST API Plan – Shelterly MVP

## 1. Resources

| Resource | Database Table | Description |
|----------|---------------|-------------|
| **Profiles** | `profiles` | Represents shelter accounts with verification status, location, and contact details |
| **Needs** | `needs` | Represents specific resource needs posted by verified shelters |
| **Auth** | `auth.users` (Supabase) | Handles user authentication and session management |

---

## 2. Endpoints

### 2.2. Profile Endpoints

#### **GET /api/profiles**

Retrieve list of verified shelters for map display.

**Query Parameters:**

- `lat` (optional): User latitude for distance calculation
- `lon` (optional): User longitude for distance calculation
- `urgent_only` (optional, boolean): Filter shelters with urgent needs
- `limit` (optional, default: 50): Number of results
- `offset` (optional, default: 0): Pagination offset

**Success Response (200 OK):**

```json
{
  "data": [
    {
      "id": "uuid",
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

**Error Responses:**

- `400 Bad Request` - Invalid query parameters
- `500 Internal Server Error` - Server error

---

#### **GET /api/profiles/:id**

Retrieve detailed information about a specific shelter.

**Success Response (200 OK):**

```json
{
  "id": "uuid",
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

**Error Responses:**

- `404 Not Found` - Shelter not found
- `500 Internal Server Error` - Server error

---

#### **GET /api/profiles/me**

Retrieve authenticated user's profile.

**Headers:**

```
Authorization: Bearer {access_token}
```

**Success Response (200 OK):**

```json
{
  "id": "uuid",
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

**Error Responses:**

- `401 Unauthorized` - Not authenticated
- `500 Internal Server Error` - Server error

---

#### **PATCH /api/profiles/me**

Update authenticated user's profile.

**Headers:**

```
Authorization: Bearer {access_token}
```

**Request Body:**

```json
{
  "name": "Updated Shelter Name",
  "city": "Warszawa",
  "address": "ul. Nowa 456",
  "phone_number": "+48987654321",
  "website_url": "https://newshelter.com"
}
```

**Success Response (200 OK):**

```json
{
  "id": "uuid",
  "name": "Updated Shelter Name",
  "city": "Warszawa",
  "updated_at": "2026-01-21T09:15:00Z"
}
```

**Error Responses:**

- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Cannot update status or role fields
- `400 Bad Request` - Invalid data
- `500 Internal Server Error` - Server error

---

#### **POST /api/profiles/me/verification-document**

Upload verification document.

**Headers:**

```
Authorization: Bearer {access_token}
Content-Type: multipart/form-data
```

**Request Body (Form Data):**

- `file`: Document file (PDF, JPG, PNG, max 5MB)

**Success Response (200 OK):**

```json
{
  "verification_doc_path": "verification-docs/uuid/document.pdf",
  "uploaded_at": "2026-01-21T10:00:00Z"
}
```

**Error Responses:**

- `401 Unauthorized` - Not authenticated
- `400 Bad Request` - Invalid file format or size
- `500 Internal Server Error` - Upload failed

---

#### **POST /api/profiles/me/geocode**

Geocode shelter's address to coordinates.

**Headers:**

```
Authorization: Bearer {access_token}
```

**Request Body:**

```json
{
  "address": "ul. Przykładowa 123, Warszawa"
}
```

**Success Response (200 OK):**

```json
{
  "location": {
    "lat": 52.2297,
    "lon": 21.0122
  },
  "formatted_address": "ul. Przykładowa 123, 00-000 Warszawa, Poland"
}
```

**Error Responses:**

- `401 Unauthorized` - Not authenticated
- `400 Bad Request` - Address not found
- `500 Internal Server Error` - Geocoding service error

---

### 2.3. Needs Endpoints

#### **GET /api/needs**

Retrieve list of needs (optionally filtered by shelter).

**Query Parameters:**

- `shelter_id` (optional): Filter by specific shelter
- `category` (optional): Filter by category (food, textiles, cleaning, medical, toys, other)
- `urgency` (optional): Filter by urgency level (low, normal, high, urgent, critical)
- `fulfilled` (optional, boolean): Include/exclude fulfilled needs
- `limit` (optional, default: 20): Number of results
- `offset` (optional, default: 0): Pagination offset

**Success Response (200 OK):**

```json
{
  "data": [
    {
      "id": "uuid",
      "shelter": {
        "id": "uuid",
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

**Error Responses:**

- `400 Bad Request` - Invalid query parameters
- `500 Internal Server Error` - Server error

---

#### **GET /api/needs/:id**

Retrieve details of a specific need.

**Success Response (200 OK):**

```json
{
  "id": "uuid",
  "shelter": {
    "id": "uuid",
    "name": "Schronisko Warszawa",
    "city": "Warszawa",
    "phone_number": "+48123456789"
  },
  "category": "food",
  "title": "Karma mokra dla kotów",
  "description": "Pilnie potrzebujemy karmy mokrej dla naszych kotów. Preferujemy marki premium bez zbóż.",
  "shopping_url": "https://www.ceneo.pl/search?q=karma+mokra+koty",
  "urgency": "urgent",
  "target_quantity": 50.00,
  "current_quantity": 12.00,
  "unit": "kg",
  "progress_percentage": 24,
  "is_fulfilled": false,
  "created_at": "2026-01-20T10:00:00Z",
  "updated_at": "2026-01-21T08:00:00Z"
}
```

**Error Responses:**

- `404 Not Found` - Need not found or deleted
- `500 Internal Server Error` - Server error

---

#### **POST /api/needs**

Create a new need (verified shelter only).

**Headers:**

```
Authorization: Bearer {access_token}
```

**Request Body:**

```json
{
  "category": "food",
  "title": "Karma sucha dla psów",
  "urgency": "normal",
  "target_quantity": 100.00,
  "unit": "kg"
}
```

**Success Response (201 Created):**

```json
{
  "id": "uuid",
  "shelter_id": "uuid",
  "category": "food",
  "title": "Karma sucha dla psów",
  "description": null,
  "shopping_url": null,
  "urgency": "normal",
  "target_quantity": 100.00,
  "current_quantity": 0.00,
  "unit": "kg",
  "is_fulfilled": false,
  "created_at": "2026-01-21T10:30:00Z"
}
```

**Error Responses:**

- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Account not verified or suspended
- `400 Bad Request` - Invalid data (missing required fields, invalid quantity)
- `500 Internal Server Error` - Server error

---

#### **PATCH /api/needs/:id**

Update an existing need (owner only).

**Headers:**

```
Authorization: Bearer {access_token}
```

**Request Body:**

```json
{
  "title": "Updated title",
  "description": "Updated description",
  "urgency": "high",
  "current_quantity": 25.00
}
```

**Success Response (200 OK):**

```json
{
  "id": "uuid",
  "title": "Updated title",
  "description": "Updated description",
  "urgency": "high",
  "current_quantity": 25.00,
  "progress_percentage": 50,
  "updated_at": "2026-01-21T11:00:00Z"
}
```

**Error Responses:**

- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not the owner or account not verified
- `404 Not Found` - Need not found
- `400 Bad Request` - Invalid data (current_quantity > target_quantity, cannot modify shelter_id)
- `500 Internal Server Error` - Server error

---

#### **DELETE /api/needs/:id**

Soft delete a need (owner only).

**Headers:**

```
Authorization: Bearer {access_token}
```

**Success Response (200 OK):**

```json
{
  "message": "Need successfully deleted",
  "deleted_at": "2026-01-21T11:15:00Z"
}
```

**Error Responses:**

- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not the owner
- `404 Not Found` - Need not found
- `500 Internal Server Error` - Server error

---

#### **POST /api/needs/:id/fulfill**

Mark a need as fulfilled (owner only).

**Headers:**

```
Authorization: Bearer {access_token}
```

**Success Response (200 OK):**

```json
{
  "id": "uuid",
  "is_fulfilled": true,
  "updated_at": "2026-01-21T11:20:00Z"
}
```

**Error Responses:**

- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not the owner
- `404 Not Found` - Need not found
- `500 Internal Server Error` - Server error

---

### 2.4. AI-Powered Endpoints

#### **POST /api/ai/generate-description**

Generate AI-powered description for a need.

**Headers:**

```
Authorization: Bearer {access_token}
```

**Request Body:**

```json
{
  "need_id": "uuid",
  "category": "food",
  "title": "Karma mokra dla kotów",
  "target_quantity": 50.00,
  "unit": "kg"
}
```

**Success Response (200 OK):**

```json
{
  "description": "Pilnie potrzebujemy karmy mokrej dla naszych kotów. Pomóż nam zapewnić im zbilansowane posiłki. Każda puszka się liczy!",
  "ai_usage_incremented": true
}
```

**Error Responses:**

- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - AI usage limit exceeded or not the need owner
- `404 Not Found` - Need not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - AI service error

---

#### **POST /api/ai/generate-shopping-link**

Generate product search link for a need.

**Headers:**

```
Authorization: Bearer {access_token}
```

**Request Body:**

```json
{
  "need_id": "uuid",
  "title": "Karma mokra dla kotów",
  "category": "food"
}
```

**Success Response (200 OK):**

```json
{
  "shopping_url": "https://www.ceneo.pl/search?q=karma+mokra+koty+premium",
  "ai_usage_incremented": true
}
```

**Error Responses:**

- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - AI usage limit exceeded or not the need owner
- `404 Not Found` - Need not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - AI service error

---

### 2.5. Admin Endpoints

#### **GET /api/admin/shelters/pending**

Retrieve list of shelters pending verification (super admin only).

**Headers:**

```
Authorization: Bearer {access_token}
```

**Query Parameters:**

- `limit` (optional, default: 20)
- `offset` (optional, default: 0)

**Success Response (200 OK):**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Schronisko XYZ",
      "nip": "1234567890",
      "city": "Kraków",
      "email": "shelter@example.com",
      "verification_doc_path": "verification-docs/uuid/doc.pdf",
      "created_at": "2026-01-20T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 20,
    "offset": 0
  }
}
```

**Error Responses:**

- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not a super admin
- `500 Internal Server Error` - Server error

---

#### **PATCH /api/admin/shelters/:id/status**

Update shelter verification status (super admin only).

**Headers:**

```
Authorization: Bearer {access_token}
```

**Request Body:**

```json
{
  "status": "verified",
  "rejection_reason": null
}
```

**Success Response (200 OK):**

```json
{
  "id": "uuid",
  "status": "verified",
  "updated_at": "2026-01-21T12:00:00Z"
}
```

**Error Responses:**

- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not a super admin
- `404 Not Found` - Shelter not found
- `400 Bad Request` - Invalid status value
- `500 Internal Server Error` - Server error

---

#### **GET /api/admin/shelters/:id/verification-document**

Download verification document (super admin only).

**Headers:**

```
Authorization: Bearer {access_token}
```

**Success Response (200 OK):**
Returns the file with appropriate Content-Type header.

**Error Responses:**

- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not a super admin
- `404 Not Found` - Shelter or document not found
- `500 Internal Server Error` - Server error

---

## 3. Authentication and Authorization

### 3.1. Authentication Mechanism

**Supabase Auth with JWT Tokens:**

- Authentication is handled by Supabase Auth service
- Access tokens (JWT) are included in the `Authorization: Bearer {token}` header
- Tokens expire after a configurable period (default: 1 hour)
- Refresh tokens are used to obtain new access tokens without re-authentication

### 3.2. Authorization Levels

| Role | Permissions |
|------|-------------|
| **Anonymous** | Read public shelter and needs data |
| **Shelter (pending)** | Read own profile, cannot create/edit needs |
| **Shelter (verified)** | Full CRUD on own profile and needs, AI generation |
| **Shelter (suspended)** | Read-only access, cannot create/edit needs |
| **Super Admin** | Full access to all resources, verification workflows |

### 3.3. Row Level Security (RLS)

All database operations are protected by Supabase RLS policies:

**Profiles Table:**

- `SELECT`: Public read access for verified shelters
- `UPDATE`: Users can only update their own profile (excluding `status` and `role`)
- `INSERT`: Triggered automatically on registration

**Needs Table:**

- `SELECT`: Public read access (excluding soft-deleted records)
- `INSERT`: Only verified shelters can create needs
- `UPDATE`: Only need owner with verified status
- `DELETE`: Soft delete by owner only (sets `deleted_at`)

---

## 4. Validation and Business Logic

### 4.1. Profile Validation

| Field | Validation Rules |
|-------|-----------------|
| `email` | Valid email format, unique |
| `password` | Min 8 characters, must include uppercase, lowercase, number |
| `name` | Required, min 3 characters, max 200 characters |
| `nip` | Required, exactly 10 digits, unique, matches regex `^\d{10}$` |
| `city` | Required, min 2 characters |
| `address` | Required, min 5 characters |
| `phone_number` | Optional, valid Polish phone format |
| `website_url` | Optional, valid URL format |

### 4.2. Needs Validation

| Field | Validation Rules |
|-------|-----------------|
| `category` | Required, must be one of enum values |
| `title` | Required, min 3 characters, max 200 characters |
| `urgency` | Required, must be one of enum values |
| `target_quantity` | Required, must be > 0 |
| `current_quantity` | Must be >= 0 and <= target_quantity |
| `unit` | Required, must be one of enum values |

### 4.3. Business Logic Implementation

#### **Registration Flow:**

1. User submits registration form
2. System validates input (NIP format, email uniqueness)
3. Supabase Auth creates user account
4. Trigger creates profile record with `status: pending`
5. System returns success message with pending status
6. User cannot create needs until verified

#### **Verification Flow:**

1. Shelter uploads verification document to Supabase Storage
2. Document path is stored in `verification_doc_path`
3. Super Admin reviews document and profile data
4. Admin changes status to `verified` or `rejected`
5. If verified, shelter can now create and manage needs

#### **Need Creation with AI:**

1. Verified shelter creates basic need (title, category, quantity)
2. Optionally clicks "Generate Description" button
3. System checks `ai_usage_count` against limit (e.g., 100/month)
4. If within limit, calls OpenRouter API with prompt
5. AI returns description, system saves it and increments counter
6. Similarly for "Generate Shopping Link" feature

#### **Map Recommendation Logic:**

1. User provides geolocation (lat, lon) or denies
2. If location provided:
   - Query uses PostGIS `ST_DWithin` to find nearby shelters
   - Calculate distance using `ST_Distance(geography)`
   - Sort by: distance ASC, urgency DESC
3. If location denied:
   - Show all shelters sorted by urgency DESC, created_at DESC
4. Apply filters (urgent_only, category)
5. Return paginated results

#### **Soft Delete:**

- Needs are never hard-deleted from database
- DELETE operation sets `deleted_at = now()`
- All queries filter `WHERE deleted_at IS NULL`
- Allows for potential recovery and audit trail

#### **Progress Calculation:**

```
progress_percentage = (current_quantity / target_quantity) * 100
```

- Calculated on read, not stored in database
- Used for visual progress bars in UI
- Auto-fulfill trigger when current >= target (optional)

---

## 5. Error Handling Standards

### 5.1. Error Response Format

All error responses follow a consistent structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "nip",
        "message": "NIP must be exactly 10 digits"
      }
    ]
  }
}
```

### 5.2. Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `VALIDATION_ERROR` | Input validation failed |
| 400 | `INVALID_REQUEST` | Malformed request |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 403 | `ACCOUNT_PENDING` | Account awaiting verification |
| 403 | `ACCOUNT_SUSPENDED` | Account has been suspended |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Resource already exists |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |
| 503 | `SERVICE_UNAVAILABLE` | External service (AI, Storage) unavailable |

---

## 6. Performance and Security Considerations

### 6.1. Rate Limiting

- **AI Endpoints:** 10 requests per minute per user
- **Authentication:** 5 login attempts per 15 minutes per IP
- **General API:** 100 requests per minute per user

### 6.2. Caching Strategy

- **GET /api/profiles:** Cache for 5 minutes (shelters rarely update)
- **GET /api/needs:** Cache for 1 minute (more dynamic data)
- **AI generated content:** Stored in database, no re-generation needed

### 6.3. Security Measures

1. **Input Sanitization:** All inputs sanitized to prevent XSS and SQL injection
2. **HTTPS Only:** All API calls must use HTTPS in production
3. **CORS:** Configured to allow only approved frontend domains
4. **File Upload:** Validation of file types, size limits, virus scanning
5. **AI Usage Limits:** Hard caps to prevent abuse and cost overruns
6. **RLS Policies:** Database-level security enforced by Supabase

### 6.4. Monitoring and Logging

- Log all authentication attempts (success and failures)
- Track AI API usage and costs
- Monitor response times for performance optimization
- Alert on repeated failed verification attempts

---

## 7. API Versioning

Current version: **v1**

Future versions will be accessible via path prefix:

- v1: `/api/*`
- v2: `/api/v2/*` (when breaking changes are introduced)

---

## 8. Implementation Notes

### 8.1. Astro API Routes Structure

```
src/pages/api/
├── auth/
│   ├── signup.ts (POST)
│   ├── login.ts (POST)
│   ├── logout.ts (POST)
│   └── refresh.ts (POST)
├── profiles/
│   ├── index.ts (GET)
│   ├── [id].ts (GET)
│   └── me/
│       ├── index.ts (GET, PATCH)
│       ├── verification-document.ts (POST)
│       └── geocode.ts (POST)
├── needs/
│   ├── index.ts (GET, POST)
│   └── [id]/
│       ├── index.ts (GET, PATCH, DELETE)
│       └── fulfill.ts (POST)
├── ai/
│   ├── generate-description.ts (POST)
│   └── generate-shopping-link.ts (POST)
└── admin/
    └── shelters/
        ├── pending.ts (GET)
        └── [id]/
            ├── status.ts (PATCH)
            └── verification-document.ts (GET)
```

### 8.2. Middleware Chain

1. **CORS Handler:** Set appropriate headers
2. **Rate Limiter:** Check request limits
3. **Auth Validator:** Verify JWT token if required
4. **RLS Context:** Set Supabase client with user context
5. **Route Handler:** Execute business logic
6. **Error Handler:** Catch and format errors
7. **Response Formatter:** Standardize response structure

### 8.3. Supabase Client Usage

```typescript
// In Astro endpoints, use supabase from context.locals
export const GET: APIRoute = async ({ locals }) => {
  const supabase = locals.supabase; // Pre-configured with auth context
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('status', 'verified');
    
  // ... handle response
};
```

### 8.4. Zod Schema Validation

All request bodies should be validated using Zod schemas:

```typescript
import { z } from 'zod';

const createNeedSchema = z.object({
  category: z.enum(['food', 'textiles', 'cleaning', 'medical', 'toys', 'other']),
  title: z.string().min(3).max(200),
  urgency: z.enum(['low', 'normal', 'high', 'urgent', 'critical']),
  target_quantity: z.number().positive(),
  unit: z.enum(['pcs', 'kg', 'g', 'l', 'ml', 'pack'])
});
```

---

## 9. Future Enhancements (Post-MVP)

- **WebSocket Support:** Real-time updates for need progress
- **Batch Operations:** Bulk update/delete needs
- **Analytics Endpoints:** Aggregate data for dashboards
- **Notification System:** Email/SMS alerts for urgent needs
- **Public API Keys:** Allow third-party integrations
- **GraphQL Gateway:** Alternative to REST for complex queries
