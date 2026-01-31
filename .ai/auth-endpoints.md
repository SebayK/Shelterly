### 2.1. Authentication Endpoints

#### **POST /api/auth/signup**
Register a new shelter account.

**Request Body:**
```json
{
  "email": "shelter@example.com",
  "password": "SecureP@ssw0rd",
  "profile": {
    "name": "Schronisko dla Zwierząt w Warszawie",
    "nip": "1234567890",
    "city": "Warszawa",
    "address": "ul. Przykładowa 123",
    "phone_number": "+48123456789",
    "website_url": "https://example.com"
  }
}
```

**Success Response (201 Created):**
```json
{
  "message": "Registration successful. Please wait for verification.",
  "user": {
    "id": "uuid",
    "email": "shelter@example.com"
  },
  "profile": {
    "id": "uuid",
    "status": "pending",
    "name": "Schronisko dla Zwierząt w Warszawie"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input data (missing fields, invalid NIP format)
- `409 Conflict` - Email or NIP already exists
- `500 Internal Server Error` - Server error

---

#### **POST /api/auth/login**
Authenticate an existing user.

**Request Body:**
```json
{
  "email": "shelter@example.com",
  "password": "SecureP@ssw0rd"
}
```

**Success Response (200 OK):**
```json
{
  "user": {
    "id": "uuid",
    "email": "shelter@example.com"
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_at": 1234567890
  },
  "profile": {
    "id": "uuid",
    "status": "verified",
    "role": "shelter"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Missing credentials
- `401 Unauthorized` - Invalid credentials
- `403 Forbidden` - Account pending verification or suspended
- `500 Internal Server Error` - Server error

---

#### **POST /api/auth/logout**
End user session.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Success Response (200 OK):**
```json
{
  "message": "Logout successful"
}
```

---

#### **POST /api/auth/refresh**
Refresh access token.

**Request Body:**
```json
{
  "refresh_token": "refresh_token"
}
```

**Success Response (200 OK):**
```json
{
  "access_token": "new_jwt_token",
  "expires_at": 1234567890
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or expired refresh token

---
