# Plan eliminacji auto-verify w środowisku deweloperskim

> **📋 TL;DR:** Super admin jest tworzony automatycznie tylko w DEV (seed.sql).  
> W produkcji admin musi być utworzony ręcznie przez Supabase Dashboard.

## Kontekst problemu

Obecnie w `src/pages/api/needs/index.ts` znajduje się obejście (workaround) w postaci automatycznej weryfikacji profili w trybie deweloperskim:

```typescript
// DEV ONLY: Auto-verify pending profiles for easier local testing
if (import.meta.env.DEV && profile.status === "pending") {
  const { error: verifyError } = await supabase.from("profiles").update({ status: "verified" }).eq("id", shelterId);
  // ...
}
```

**Dlaczego to powstało:**

1. Signup przez Supabase Auth tworzy profil ze statusem `pending`
2. Tworzenie potrzeb (`POST /api/needs`) wymaga statusu `verified`
3. Bez tego obejścia flow signup → create need nie działa w testach
4. Próba użycia service_role key w Postman kończyła się błędem 401

**Cel:** Zastąpić to obejście właściwym mechanizmem weryfikacji przez Admin API.

---

## Status obecny (co już mamy)

### ✅ Admin API - zaimplementowane

Endpointy admin już istnieją i są gotowe do użycia:

1. **GET /api/admin/shelters/pending**
   - Plik: `src/pages/api/admin/shelters/pending.ts`
   - Status: ✅ Zaimplementowany
   - Zwraca: Listę schronisk oczekujących na weryfikację

2. **PATCH /api/admin/shelters/:id/status**
   - Plik: `src/pages/api/admin/shelters/[id]/status.ts`
   - Status: ✅ Zaimplementowany
   - Akceptuje: `{ "status": "verified" | "rejected" | "suspended" }`
   - Authorization: Wymaga roli `super_admin`

3. **GET /api/admin/shelters/:id/verification-document**
   - Plik: `src/pages/api/admin/shelters/[id]/verification-document.ts`
   - Status: ✅ Zaimplementowany
   - Zwraca: Plik dokumentu weryfikacyjnego

### ✅ Service Layer

- `src/lib/services/admin.service.ts` - kompletna logika biznesowa
- `src/lib/validation/admin.schemas.ts` - schematy Zod dla walidacji

### ✅ Database

- Migracje RLS są właściwie skonfigurowane (selective deployment)
- Tabela `profiles` ma kolumnę `role` i `status`

---

## Co trzeba zrobić (TODO)

### 1. Seed Super Admin User 🔴 WYMAGANE

**Problem:** Nie ma super admina w bazie danych lokalnej.

**Rozwiązanie:** Utworzyć plik seed z super adminem (tylko DEV).

**Plik:** `supabase/seed.sql`

> **⚠️ DEVELOPMENT ONLY:** Ten plik jest wykonywany TYLKO lokalnie przez `npx supabase db reset`.  
> W produkcji super admin musi być utworzony ręcznie przez Supabase Dashboard.

```sql
-- ============================================================================
-- SEED DATA: Super Admin User (DEVELOPMENT ONLY)
-- ============================================================================
-- Purpose: Create default super admin account for local development/testing
-- Email: admin@shelterly.dev
-- Password: Admin123!
--
-- ⚠️ WARNING: This seed file is ONLY executed in local development.
-- Production super admin must be created manually via Supabase Dashboard.
-- ============================================================================

-- Insert super admin user into auth.users
DO $$
DECLARE
  admin_user_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Check if admin already exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@shelterly.dev') THEN
    -- Insert into auth.users (Supabase Auth)
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      aud,
      role,
      raw_app_meta_data,
      raw_user_meta_data
    ) VALUES (
      admin_user_id,
      '00000000-0000-0000-0000-000000000000',
      'admin@shelterly.dev',
      crypt('Admin123!', gen_salt('bf')), -- hashed password
      NOW(),
      NOW(),
      NOW(),
      'authenticated',
      'authenticated',
      '{"provider":"email","providers":["email"]}',
      '{"role":"super_admin"}'
    );

    -- Insert into profiles (trigger will create it, but we ensure super_admin role)
    INSERT INTO public.profiles (
      id,
      role,
      status,
      name,
      city,
      address,
      created_at,
      updated_at
    ) VALUES (
      admin_user_id,
      'super_admin',
      'verified',
      'System Administrator',
      'Warsaw',
      'Admin Office',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET role = 'super_admin',
        status = 'verified';

    RAISE NOTICE 'Super admin user created: admin@shelterly.dev / Admin123!';
  ELSE
    RAISE NOTICE 'Super admin user already exists';
  END IF;
END $$;
```

**Jak zastosować:**

```bash
# Po utworzeniu pliku, zresetuj bazę lokalną
npx supabase db reset
```

**Credentials:**

- Email: `admin@shelterly.dev`
- Password: `Admin123!`

---

### 2. Przetestować Admin API ręcznie 🟡 WAŻNE

**Test 1: Login jako admin**

```bash
curl -X POST "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@shelterly.dev", "password": "Admin123!"}'
```

**Test 2: GET pending shelters**

```bash
curl "http://localhost:3003/api/admin/shelters/pending" \
  -H "Authorization: Bearer <admin_token>"
```

**Test 3: PATCH verify shelter**

```bash
curl -X PATCH "http://localhost:3003/api/admin/shelters/<shelter_id>/status" \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "verified"}'
```

---

### 3. Aktualizować Postman Collection 🟡 WAŻNE

**Dodać do:** `poc/Shelterly-API.postman_collection.json`

**Nowy folder:** "4. Admin (Verification)"

**Requesty do dodania:**

1. **Login Admin**

   ```json
   {
     "name": "Login Admin",
     "request": {
       "method": "POST",
       "header": [
         { "key": "Content-Type", "value": "application/json" },
         { "key": "apikey", "value": "{{anon_key}}" }
       ],
       "body": {
         "mode": "raw",
         "raw": "{\n  \"email\": \"admin@shelterly.dev\",\n  \"password\": \"Admin123!\"\n}"
       },
       "url": "{{supabase_url}}/auth/v1/token?grant_type=password"
     },
     "event": [
       {
         "listen": "test",
         "script": {
           "exec": [
             "const json = pm.response.json();",
             "if (json.access_token) {",
             "    pm.collectionVariables.set('admin_token', json.access_token);",
             "    console.log('✅ Admin token zapisany');",
             "}"
           ]
         }
       }
     ]
   }
   ```

2. **GET Pending Shelters**

   ```json
   {
     "name": "GET Pending Shelters",
     "request": {
       "method": "GET",
       "header": [{ "key": "Authorization", "value": "Bearer {{admin_token}}" }],
       "url": "{{base_url}}/api/admin/shelters/pending"
     }
   }
   ```

3. **PATCH Verify Shelter**
   ```json
   {
     "name": "PATCH Verify Shelter",
     "request": {
       "method": "PATCH",
       "header": [
         { "key": "Authorization", "value": "Bearer {{admin_token}}" },
         { "key": "Content-Type", "value": "application/json" }
       ],
       "body": {
         "mode": "raw",
         "raw": "{\n  \"status\": \"verified\"\n}"
       },
       "url": "{{base_url}}/api/admin/shelters/{{new_user_id}}/status"
     }
   }
   ```

**Dodać zmienną kolekcji:**

```json
{
  "key": "admin_token",
  "value": ""
}
```

**Nowy flow w newman:**

1. Signup (shelter) → `new_user_id`
2. Login Admin → `admin_token`
3. PATCH Verify Shelter (użyj `new_user_id`)
4. POST /api/needs (teraz działa z zweryfikowanym profilem)

---

### 4. Usunąć auto-verify z kodu 🟢 OSTATNI KROK

**Plik:** `src/pages/api/needs/index.ts`

**Usunąć sekcję:**

```typescript
// DEV ONLY: Auto-verify pending profiles for easier local testing
if (import.meta.env.DEV && profile.status === "pending") {
  const { error: verifyError } = await supabase.from("profiles").update({ status: "verified" }).eq("id", shelterId);

  if (!verifyError) {
    profile.status = "verified";
    // eslint-disable-next-line no-console
    console.log(`[DEV] Auto-verified profile ${shelterId} for testing`);
  }
}
```

**Pozostawić:**

```typescript
// Oryginalna logika biznesowa
if (profile.status === "pending") {
  return createErrorHttpResponse("ACCOUNT_PENDING", "Your account is awaiting verification", 403);
}

if (profile.status !== "verified") {
  return createErrorHttpResponse("FORBIDDEN", "Only verified shelters can create needs", 403);
}
```

---

### 5. Dokumentacja użycia (dla deweloperów) 🟢 OPCJONALNE

**Plik:** `supabase/README.md` (lub aktualizacja głównego README)

````markdown
## Development Workflow - Shelter Verification

### Local Testing (Development Only)

1. **Start Supabase:**
   ```bash
   npx supabase start
   ```
````

2. **Super Admin Credentials (DEV ONLY):**
   - Email: `admin@shelterly.dev`
   - Password: `Admin123!`
   - ⚠️ These credentials are ONLY for local development (seed.sql)

3. **Workflow:**
   - Signup as shelter → creates profile with `status='pending'`
   - Login as admin (using DEV credentials)
   - Call `PATCH /api/admin/shelters/:id/status` with `{"status": "verified"}`
   - Shelter can now create needs

### Production

**Super admin must be created manually via Supabase Dashboard.**
See: `.ai/verification-rls-todo-plan.md` → "Seed vs Production" section.

### Postman Collection

Import `poc/Shelterly-API.postman_collection.json` and run:

1. `1. Auth > Signup` - creates pending shelter
2. `4. Admin > Login Admin` - get admin token (use DEV credentials locally)
3. `4. Admin > PATCH Verify Shelter` - approve shelter
4. `2. Needs > POST /api/needs` - create need (now works!)

```

---

## Seed vs Production - Automatyczne rozdzielenie środowisk

### 🧪 Development (supabase/seed.sql)

**Plik `supabase/seed.sql` jest wykonywany tylko lokalnie:**
- ✅ `npx supabase db reset` - wykonuje migrations + seed
- ✅ `npx supabase start` (przy pierwszym uruchomieniu) - wykonuje seed
- ❌ `npx supabase db push` - **NIE** wykonuje seed (tylko migrations)
- ❌ Supabase Dashboard (produkcja) - **NIE** ma dostępu do seed.sql

**Credentials dla DEV:**
```

Email: admin@shelterly.dev
Password: Admin123!

````

### 🚀 Production

**Super admin w produkcji musi być utworzony ręcznie:**

**Opcja 1: Supabase Dashboard**
1. Wejdź do projektu produkcyjnego
2. Authentication → Users → Add User
3. Email: `admin@your-domain.com`
4. Password: (bezpieczne hasło)
5. User Metadata: `{"role": "super_admin"}`

**Opcja 2: SQL Editor w Dashboard**
```sql
-- Wykonaj w Supabase Dashboard → SQL Editor
INSERT INTO auth.users (...)  -- pełny SQL jak w seed.sql
````

**Opcja 3: Migration (jeśli chcesz committować w repo)**

```sql
-- Uwaga: To zacommituje hasło do repo!
-- Tylko jeśli używasz zmiennych środowiskowych lub vault
CREATE OR REPLACE FUNCTION create_super_admin_if_not_exists()
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'super_admin') THEN
    -- Insert logic here
  END IF;
END;
$$ LANGUAGE plpgsql;

SELECT create_super_admin_if_not_exists();
DROP FUNCTION create_super_admin_if_not_exists();
```

**⚠️ Zalecenie:** Użyj Opcji 1 (Dashboard) dla bezpieczeństwa.

---

## Korzyści po implementacji

### ✅ Produkcyjny flow działa lokalnie

- Testujemy dokładnie ten sam proces co w produkcji
- Brak niespodzianek przy deploymencie

### ✅ Bezpieczeństwo

- Usunięcie auto-verify eliminuje ryzyko przypadkowego pozostawienia tego w produkcji
- RLS policies działają zgodnie z założeniami

### ✅ Testowanie Admin Panel

- Możliwość testowania całego flow weryfikacji
- Przygotowanie do implementacji UI panelu admina

### ✅ Czysty kod

- Brak workaroundów i warunkowych bloków `if (import.meta.env.DEV)`
- Łatwiejsze utrzymanie i rozwój

---

## Checklist implementacji

### Development (Local)

- [ ] **1. Utworzyć `supabase/seed.sql`** z super adminem (DEV only)
- [ ] **2. Zresetować bazę:** `npx supabase db reset`
- [ ] **3. Przetestować login admin** przez curl/Postman (admin@shelterly.dev)
- [ ] **4. Przetestować GET /api/admin/shelters/pending**
- [ ] **5. Przetestować PATCH /api/admin/shelters/:id/status**
- [ ] **6. Dodać requesty Admin do kolekcji Postman**
- [ ] **7. Dodać zmienną `admin_token` do kolekcji**
- [ ] **8. Uruchomić newman** z nowym flow (signup → admin verify → create need)
- [ ] **9. Usunąć auto-verify** z `src/pages/api/needs/index.ts`
- [ ] **10. Uruchomić newman ponownie** - upewnić się że wszystko działa
- [ ] **11. Commit changes:** `git commit -m "feat: implement proper admin verification flow, remove DEV auto-verify"`

### Production (When deploying)

- [ ] **P1. Nie pushować seed.sql** do produkcji (automatyczne - supabase db push pomija seed)
- [ ] **P2. Utworzyć super admina ręcznie** przez Supabase Dashboard
- [ ] **P3. Zweryfikować role** admina: `SELECT role FROM profiles WHERE email = 'admin@...'`
- [ ] **P4. Przetestować Admin API** na środowisku produkcyjnym

---

## Szacowany czas implementacji

- Punkt 1 (seed): **10 min**
- Punkt 2-3 (testy manualne): **15 min**
- Punkt 4 (Postman): **20 min**
- Punkt 5 (usunięcie auto-verify): **5 min**
- **SUMA: ~50 min**

---

## Potencjalne problemy i rozwiązania

### Problem: "Super admin user already exists but has wrong role" (DEV only)

**Rozwiązanie:**

```bash
# Zresetuj bazę lokalną
npx supabase db reset

# LUB ręcznie przez psql:
docker exec -it supabase_db_Shelterly psql -U postgres -d postgres
```

```sql
-- Ręczna aktualizacja roli
UPDATE public.profiles
SET role = 'super_admin', status = 'verified'
WHERE id = '00000000-0000-0000-0000-000000000001';
```

### Problem: "Admin API returns 403 even with admin token"

**Diagnoza:**

```sql
-- Sprawdź rolę użytkownika
SELECT id, email, raw_user_meta_data FROM auth.users WHERE email = 'admin@shelterly.dev';
SELECT id, role, status FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001';
```

**Rozwiązanie:** Upewnij się że `profiles.role = 'super_admin'` (nie `shelter`).

### Problem: "Newman flow breaks after removing auto-verify"

**Rozwiązanie:** Upewnij się że:

1. Request "PATCH Verify Shelter" wykonuje się PRZED "POST /api/needs"
2. `{{new_user_id}}` jest prawidłowo zapisany w test script signup
3. `{{admin_token}}` jest zapisany w test script login admin

---

## Status dokumentu

- **Utworzony:** 2026-02-24
- **Status:** 📋 TODO - gotowy do implementacji
- **Priorytet:** 🔴 HIGH (blokuje clean production flow)
- **Assignee:** -
